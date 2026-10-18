/* Real offline index, original recording, autoplay and launch lifecycle.
   Install Playwright outside the repo; media playback is never stubbed. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results/browser-demo-music');
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(root, 'demo/index.html')).href, selector = '#menu-music-player audio';
const errors = [], requests = []; let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; console.log('PASS', message); }
function observe(page) {
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => requests.push(request.url().split(',')[0]));
}
async function playing(page) {
  await page.waitForFunction(() => {
    const p = document.querySelector('#menu-music-player audio');
    return p && (p.error || (!p.paused && p.currentTime > 0 && p.readyState >= 2));
  });
  assert.equal(await page.locator(selector).evaluate((p) => p.error && p.error.message), null, 'real embedded audio must decode');
}
async function remember(page) { await page.evaluate(() => { window.previousMenuPlayer = document.querySelector('#menu-music-player audio'); }); }
async function released(page) {
  return page.evaluate(() => { const p = window.previousMenuPlayer; return p && p.paused && !p.isConnected && !p.hasAttribute('src'); });
}
async function visibility(page, hidden) {
  await page.evaluate((value) => {
    if (value) Object.defineProperty(document, 'hidden', { configurable: true, value: true }); else delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
const launch = (policy) => chromium.launch({ headless: true, args: ['--autoplay-policy=' + policy], executablePath: process.env.BROWSER_EXECUTABLE || undefined });
(async () => {
  const html = fs.readFileSync(path.join(root, 'demo/index.html'), 'utf8');
  const data = html.match(/<script id="menu-music-data" type="audio\/mp4">(.*?)<\/script>/s);
  check(data && Buffer.from(data[1], 'base64').equals(fs.readFileSync(path.join(root, 'sources/Wir sind des Geyers schwarzer Haufen.m4a'))), 'index embeds the exact supplied M4A bytes');
  const fallback = html.match(/<script id="menu-music-fallback-data" type="audio\/mp4">(.*?)<\/script>/s);
  check(fallback && Buffer.from(fallback[1], 'base64').equals(fs.readFileSync(path.join(root, 'sources/menu_music_aac.m4a'))) && Buffer.from(fallback[1], 'base64').includes(Buffer.from('mp4a')), 'index embeds the existing compatible AAC recording');
  const specs = JSON.parse(fs.readFileSync(path.join(root, 'data/missions/campaigns.v1.json'))).missions;
  for (const game of ['bundschuh_rebellion.html', ...specs.map((s) => s.file)])
    check(!fs.readFileSync(path.join(root, 'demo', game), 'utf8').includes('menu-music-'), game + ' has no duplicate music');
  let browser;
  try {
    browser = await launch('no-user-gesture-required'); const version = await browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true });
    const page = await context.newPage(); observe(page);
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
      window.firstMenuFrame = document.body.classList.contains('intro-enter');
    })));
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('.intro-copy').getAnimations()[0]?.currentTime > 120);
    const flight = await page.evaluate(async () => {
      const el = document.querySelector('.intro-copy'), animation = el.getAnimations()[0];
      const sample = () => ({ x: new DOMMatrixReadOnly(getComputedStyle(el).transform).m41, opacity: +getComputedStyle(el).opacity });
      const first = sample(), time = animation.currentTime;
      await new Promise((resolve) => { const tick = () => animation.currentTime >= time + 300 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); });
      return { first, later: sample(), painted: !window.firstMenuFrame };
    });
    check(flight.painted && flight.first.x < -30 && flight.later.x > flight.first.x && flight.later.opacity > flight.first.opacity, 'introduction flies in after the first paint');
    await playing(page);
    check(await page.locator(selector).count() === 1 && await page.locator(selector).isHidden() && await page.locator(selector).evaluate((p) => p.autoplay && p.loop && !p.controls && !p.muted && p.volume > 0 && p.duration > 0), 'opening index offline autoplays one hidden looping player when permitted');
    await remember(page);
    for (const campaign of ['bundschuh', 'swabian_league', 'prototype']) {
      await page.locator(`[data-campaign="${campaign}"].faction`).click();
      const expected = specs.filter((s) => (s.id === 'P0' ? 'prototype' : s.side) === campaign);
      check(await page.locator('.card:visible').count() === expected.length, campaign + ' shows every mission');
      for (const spec of expected) {
        await page.locator(`[data-mission="${spec.id}"]`).click();
        check(await page.locator('#mission-title').innerText() === spec.title && await page.locator('#mission-brief').innerText() === spec.brief && await page.locator('#play').getAttribute('href') === spec.file + '?play=1', spec.id + ' uses the shared briefing and launch target');
      }
    }
    await playing(page);
    check(await page.locator(selector).evaluate((p) => p === window.previousMenuPlayer), 'mission selection keeps the recording playing');
    await context.setOffline(false); await context.setOffline(true); await playing(page);
    check(await page.locator(selector).evaluate((p) => p === window.previousMenuPlayer), 'network transitions do not interrupt music');
    await visibility(page, true);
    check(await released(page) && await page.locator(selector).count() === 0, 'hiding index releases the player');
    await visibility(page, false); await playing(page); await remember(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    check(await released(page), 'pagehide releases audio');
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow'))); await playing(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    check(await page.locator(selector).count() === 1, 'repeated lifecycle events never duplicate audio');
    await page.locator('[data-campaign="bundschuh"].faction').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.intro-copy')).opacity === '1');
    await page.screenshot({ path: path.join(out, 'index-1440.png') });
    // Observe synchronous release before navigation destroys the old document.
    await remember(page);
    await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest?.('#play')) e.preventDefault(); }, { once: true }));
    await page.locator('#play').click();
    check(await released(page) && await page.locator(selector).count() === 0, 'start releases music before navigation');
    await page.reload(); await playing(page);
    await page.locator('[data-campaign="swabian_league"].faction').click(); await page.locator('[data-mission="B3"]').click(); await page.locator('#play').click();
    await page.waitForURL('**/b3_battle_of_boblingen.html?play=1');
    check(await page.locator('.hud').isVisible() && await page.locator('#start').isHidden() && await page.locator('audio').count() === 0, 'launch enters the selected mission directly without music');
    await page.goBack(); await playing(page);
    check(await page.locator('#play').isVisible(), 'returning to index restores music');
    await page.locator('.skirmish').click(); await page.waitForURL('**/bundschuh_rebellion.html?play=1');
    check(await page.locator('.hud').isVisible() && await page.locator('#start').isHidden() && await page.locator('audio').count() === 0, 'Black Forest launch enters gameplay without music');
    await page.goto(url); await playing(page);
    check(await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));
      const p = document.querySelector('#menu-music-player audio');
      document.addEventListener('click', (e) => e.preventDefault(), { once: true }); document.querySelector('#play').click();
      return p.paused && !p.isConnected && !p.hasAttribute('src');
    }), 'starting during pending playback releases audio');
    const reduced = await browser.newContext({ viewport: { width: 1024, height: 768 }, offline: true, reducedMotion: 'reduce' });
    const small = await reduced.newPage(); observe(small); await small.goto(url); await playing(small);
    check(await small.locator('.intro-copy').evaluate((el) => el.getAnimations().length === 0 && getComputedStyle(el).opacity === '1'), 'reduced motion disables the entrance animation');
    check(await small.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '1024px layout has no horizontal overflow');
    const startBox = await small.locator('#play').boundingBox();
    check(startBox && startBox.y >= 0 && startBox.y + startBox.height <= 768, '1024×768 start button is visible without page scrolling');
    await small.screenshot({ path: path.join(out, 'index-1024.png'), fullPage: true });
    await small.setViewportSize({ width: 375, height: 812 });
    check(await small.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '375px layout has no horizontal overflow');
    await small.locator('#play').scrollIntoViewIfNeeded(); check(await small.locator('#play').isVisible(), 'start remains reachable on narrow screens');
    await small.screenshot({ path: path.join(out, 'index-mobile.png'), fullPage: true });
    await browser.close(); browser = null;
    browser = await launch('document-user-activation-required');
    const blocked = await (await browser.newContext({ offline: true })).newPage(); observe(blocked); await blocked.goto(url);
    await blocked.waitForFunction(() => document.querySelector('#menu-music-player audio')?.dataset.playback === 'blocked');
    check(await blocked.locator(selector).isHidden() && await blocked.locator(selector).evaluate((p) => p.paused), 'blocked autoplay stays hidden without throwing');
    await blocked.locator('[data-campaign="swabian_league"].faction').click(); await playing(blocked);
    check(await blocked.locator(selector).isHidden(), 'menu interaction retries blocked playback');
    await blocked.locator('#play').click(); await blocked.waitForURL('**/b1_quenching_the_sparks.html?play=1');
    check(await blocked.locator('audio').count() === 0 && await blocked.locator('.hud').isVisible(), 'gesture-started music stops for gameplay');
    check(errors.length === 0, 'no page exceptions or unhandled playback errors: ' + errors.join('; '));
    check(requests.every((r) => r.startsWith('file:') || r.startsWith('data:')), 'no remote media, fonts or fetch requests');
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ passed: true, checks, browser: version, errors, requests }, null, 2));
    console.log('Browser index music and launch: ' + checks + ' checks passed');
  } finally { if (browser) await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
