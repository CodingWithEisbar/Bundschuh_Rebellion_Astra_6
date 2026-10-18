/* Optional real-browser regression. Install Playwright outside the game package.
   PLAYWRIGHT_MODULE can name an absolute module; BROWSER_EXECUTABLE is optional. */
'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'test-results/browser-demo');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const options = { headless: true };
  if (process.env.BROWSER_EXECUTABLE) options.executablePath = process.env.BROWSER_EXECUTABLE;
  if (process.env.BROWSER_SINGLE_PROCESS === '1')
    options.args = [
      '--no-sandbox',
      '--no-zygote',
      '--single-process',
      '--in-process-gpu',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
    ];
  const browser = await chromium.launch(options);
  const errors = [],
    requests = [];
  let checks = 0;
  const check = (ok, message) => {
    assert.ok(ok, message);
    checks++;
    console.log('PASS', message);
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      offline: true,
    });
    let page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => requests.push(r.url().split(',')[0]));
    await page.goto(
      pathToFileURL(path.join(root, 'demo/bundschuh_rebellion.html')).href + '?test=1',
    );
    check(await page.locator('#start').isVisible(), 'menu opens from file:// while offline');
    await page.locator('#play').click();
    await page.evaluate(() => window.__RTS_DEMO__.setPaused(true));
    check(
      await page.evaluate(() => window.__RTS_DEMO__.selected.length === 8),
      'start selects eight villagers',
    );
    const beforeObjectives = await page.evaluate(() => ({ tick: window.__RTS_DEMO__.game.tick, selected: window.__RTS_DEMO__.selected }));
    await page.locator('#toggle-objectives').click();
    check(await page.locator('#objective-content').isHidden() && await page.locator('#toggle-objectives').isVisible() &&
      await page.locator('#toggle-objectives').getAttribute('aria-expanded') === 'false', 'objectives collapse while the restore button stays visible');
    await page.evaluate(() => window.__RTS_DEMO__.setPaused(true));
    check(await page.evaluate((before) => document.querySelector('#objective-content').hidden &&
      window.__RTS_DEMO__.game.tick === before.tick && JSON.stringify(window.__RTS_DEMO__.selected) === JSON.stringify(before.selected), beforeObjectives),
    'HUD refresh keeps objectives hidden without changing time or selection');
    await page.keyboard.press('o');
    check(await page.locator('#objective-content').isVisible() &&
      await page.locator('#toggle-objectives').getAttribute('aria-expanded') === 'true', 'O restores the objectives');
    await page.screenshot({ path: path.join(out, 'game.png') });
    // Select by drag through the actual input adapter, then right click a resource.
    const points = await page.evaluate(() => {
      const h = window.__RTS_DEMO__;
      return h.game.units
        .filter((u) => u.owner === 0 && u.type === 'villager')
        .map((u) => h.screen(u.x, u.y));
    });
    const left = Math.min(...points.map((p) => p.x)) - 15,
      right = Math.max(...points.map((p) => p.x)) + 15,
      top = Math.min(...points.map((p) => p.y)) - 35,
      bottom = Math.max(...points.map((p) => p.y)) + 10;
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 10 });
    await page.mouse.up();
    check(
      await page.evaluate(() => window.__RTS_DEMO__.selected.length === 8),
      'drag selects the villagers',
    );
    const resource = await page.evaluate(() => {
      const h = window.__RTS_DEMO__,
        r = h.game.resources.find((r) => r.type === 'food' && r.x < 10);
      return h.screen(r.x, r.y);
    });
    await page.mouse.click(resource.x, resource.y, { button: 'right' });
    check(
      await page.evaluate(() =>
        window.__RTS_DEMO__.game.units
          .filter((u) => u.owner === 0 && u.type === 'villager')
          .every((u) => u.order.type === 'gather'),
      ),
      'right click assigns gathering',
    );
    await page.evaluate(() => window.__RTS_DEMO__.step(600));
    check(
      await page.evaluate(() => window.__RTS_DEMO__.game.metrics.gathered > 0),
      'gather/return loop deposits resources and updates HUD',
    );
    check(
      Number(await page.locator('#r-food').innerText()) > 450,
      'global resource panel matches deposited food',
    );
    // Place a valid house with H + click and finish it through real worker movement.
    const place = await page.evaluate(() => {
      const h = window.__RTS_DEMO__;
      return h.screen(10.2, 19.2);
    });
    await page.keyboard.press('h');
    await page.mouse.move(place.x, place.y);
    await page.mouse.click(place.x, place.y);
    check(
      await page.evaluate(() =>
        window.__RTS_DEMO__.game.buildings.some(
          (b) => b.owner === 0 && b.type === 'house' && !b.complete,
        ),
      ),
      'H + click creates a zero-HP foundation',
    );
    await page.evaluate(() => window.__RTS_DEMO__.step(800));
    check(
      await page.evaluate(() => window.__RTS_DEMO__.game.cap(0) === 25),
      'villagers complete house, housing rises once',
    );
    const barracks = await page.evaluate(() => {
      const h = window.__RTS_DEMO__,
        b = h.game.buildings.find((b) => b.owner === 0 && b.type === 'barracks');
      return h.screen(b.x, b.y);
    });
    await page.mouse.click(barracks.x, barracks.y);
    check(
      await page.locator('[data-action="train-pikeman"]').isVisible(),
      'selecting barracks exposes faction recruitment',
    );
    await page.locator('[data-action="train-pikeman"]').click();
    check(
      await page.evaluate(
        () =>
          window.__RTS_DEMO__.game.buildings.find((b) => b.owner === 0 && b.type === 'barracks')
            .queue.length === 1,
      ),
      'recruitment button creates paid queue entry',
    );
    await page.evaluate(() => window.__RTS_DEMO__.step(460));
    check(
      await page.evaluate(() => window.__RTS_DEMO__.game.metrics.trained === 1),
      'recruit completes after catalog duration',
    );
    // Pausing and help must never consume game time; close help restores pause state.
    const before = await page.evaluate(() => window.__RTS_DEMO__.game.tick);
    await page.waitForTimeout(150);
    check(
      (await page.evaluate(() => window.__RTS_DEMO__.game.tick)) === before,
      'pause freezes fixed ticks',
    );
    await page.locator('#help').click();
    check(await page.locator('#help-modal').isVisible(), 'help opens');
    await page.locator('#resume').click();
    check(
      await page.evaluate(() => window.__RTS_DEMO__.paused),
      'closing help restores prior pause state',
    );
    await page.locator('#speed').click();
    check((await page.locator('#speed').innerText()) === '2×', 'speed toggle works');
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => window.__RTS_DEMO__.selected.length >= 6), 'Tab selects army');
    const oldCam = await page.evaluate(() => window.__RTS_DEMO__.cam);
    const mm = await page.locator('#minimap').boundingBox();
    await page.mouse.click(mm.x + mm.width * 0.8, mm.y + mm.height * 0.5);
    check(
      (await page.evaluate(() => window.__RTS_DEMO__.cam.x)) > oldCam.x + 10,
      'minimap moves camera',
    );
    await page.keyboard.press('Home');
    check(
      (await page.evaluate(() => window.__RTS_DEMO__.cam.x)) < 10,
      'Home returns to headquarters',
    );
    await page.locator('#sound').click();
    check(
      (await page.locator('#sound').innerText()) === 'Âm: bật',
      'pooled audio can be enabled by user gesture',
    );
    await page.locator('#sound').click();
    // Terminal UI: use a small controlled fixture, then the real combat tick.
    await page.evaluate(() => {
      const h = window.__RTS_DEMO__,
        g = h.game,
        b = g.buildings.find((b) => b.owner === 1 && b.type === 'town');
      b.hp = 1;
      for (const v of g.units) if (v.owner === 1) v.hp = 0;
      const u = g.spawn('peasant_flailman', 0, b.gx - 0.4, b.gy + 1);
      g.order([u], 'attack', b);
      h.step(2);
    });
    check(await page.locator('#result').isVisible(), 'destruction triggers victory screen');
    check(
      (await page.locator('#result-title').innerText()).includes('thuộc'),
      'victory text is correct',
    );
    await page.locator('#again').click();
    // A fresh small viewport avoids GPU resize quirks in serverless Chromium.
    const oldPage = page;
    page = await context.newPage();
    await page.setViewportSize({ width: 1024, height: 768 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => requests.push(r.url().split(',')[0]));
    await page.goto(
      pathToFileURL(path.join(root, 'demo/bundschuh_rebellion.html')).href + '?test=1',
    );
    await oldPage.close();
    await page.locator('[data-faction="swabian_league"]').click();
    await page.locator('#seed').fill('42');
    await page.locator('#play').click();
    await page.evaluate(() => window.__RTS_DEMO__.setPaused(true));
    check(
      await page.evaluate(
        () =>
          window.__RTS_DEMO__.game.players[0].faction === 'swabian_league' &&
          window.__RTS_DEMO__.game.seed === 42,
      ),
      'new match applies other faction and seed',
    );
    const bb = await page.evaluate(() => {
      const el = document.querySelector('.hud').getBoundingClientRect();
      return { x: el.x, y: el.y, right: el.right, bottom: el.bottom };
    });
    check(
      bb.x >= 0 && bb.right <= 1024 && bb.bottom <= 768,
      'HUD fits a 1024×768 desktop viewport',
    );
    await page.screenshot({ path: path.join(out, 'league-1024.png') });
    await page.evaluate(() => {
      const h = window.__RTS_DEMO__,
        g = h.game,
        b = g.buildings.find((b) => b.owner === 0 && b.type === 'town');
      b.hp = 1;
      for (const v of g.units) if (v.owner === 0) v.hp = 0;
      const u = g.spawn('heavy_gendarme', 1, b.gx - 0.4, b.gy + 1);
      g.order([u], 'attack', b);
      h.step(2);
    });
    check(
      (await page.locator('#result-title').innerText()).includes('thất thủ'),
      'HQ loss triggers defeat screen',
    );
    check(errors.length === 0, 'no page exceptions');
    check(
      requests.every((u) => u.startsWith('file:') || u.startsWith('data:audio/mp4;')),
      'no CDN, fetch, font or other network requests',
    );
    fs.writeFileSync(
      path.join(out, 'report.json'),
      JSON.stringify(
        { passed: true, checks, browser: await browser.version(), errors, requests },
        null,
        2,
      ),
    );
    console.log(`Browser UI: ${checks} checks passed`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
