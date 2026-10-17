/* Optional Playwright pixel regression against the real offline Canvas renderer. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'),
  path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results/occlusion');
const missions = JSON.parse(fs.readFileSync(path.join(root, 'data/missions/campaigns.v1.json'), 'utf8')).missions;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [], requests = [];
  let checks = 0;
  function check(ok, label) { assert.ok(ok, label); checks++; console.log('PASS', label); }
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', r => requests.push(r.url().split(',')[0]));
    const files = ['bundschuh_rebellion.html', ...missions.map(s => s.file)];
    for (const file of files) {
      await page.goto(pathToFileURL(path.join(root, 'demo', file)).href + '?test=1');
      await page.locator('#play').click();
      await page.mouse.move(1100, 650);
      await page.evaluate(() => {
        const h = window.__RTS_DEMO__, g = h.game;
        h.setPaused(true); h.select([]);
        g.units = []; g.buildings = []; g.resources = []; g.effects = []; g.blocks.clear();
        const b = g.building('town', 0, Math.round(h.cam.x), Math.round(h.cam.y) - 2);
        const u = g.spawn('villager', 0, b.gx + .9, b.gy - .3);
        window.occlusionFixture = { b, u };
        // Compare two synchronous paints; only the contour pass is switched off.
        window.measureContour = () => {
          const canvas = document.getElementById('world'), c = canvas.getContext('2d');
          const draw = window.drawOccludedUnits;
          let without;
          try {
            window.drawOccludedUnits = () => {};
            window.render(); without = c.getImageData(0, 0, canvas.width, canvas.height).data;
          } finally { window.drawOccludedUnits = draw; }
          window.render();
          const withContour = c.getImageData(0, 0, canvas.width, canvas.height).data;
          let pixels = 0, minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
          for (let i = 0; i < without.length; i += 4) {
            if (Math.abs(without[i] - withContour[i]) + Math.abs(without[i + 1] - withContour[i + 1]) +
                Math.abs(without[i + 2] - withContour[i + 2]) < 8) continue;
            const x = i / 4 % canvas.width, y = Math.floor(i / 4 / canvas.width);
            pixels++; minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
          return { pixels, minX, minY, maxX, maxY };
        };
      });
      const hidden = await page.evaluate(() => window.measureContour());
      check(hidden.pixels > 50, file + ': unselected unit behind roof has a visible contour');
      const front = await page.evaluate(() => {
        const { b, u } = window.occlusionFixture;
        u.y = b.gy + b.size + .7;
        return window.measureContour();
      });
      check(front.pixels === 0, file + ': front unit retains normal rendering');
      if (file !== 'bundschuh_rebellion.html') continue;
      for (const type of ['villager', 'pikeman', 'peasant_flailman', 'radical_preacher', 'crossbowman', 'heavy_gendarme']) {
        const results = await page.evaluate(type => {
          const h = window.__RTS_DEMO__, g = h.game, { b } = window.occlusionFixture;
          g.units = [];
          const u = g.spawn(type, 0, b.gx + .9, b.gy - .3);
          window.occlusionFixture.u = u;
          const plain = window.measureContour();
          h.select([u.id]); u.hp /= 2; u.buff = 1.15;
          const selected = window.measureContour();
          u.hp = 0;
          return { plain, selected, dead: window.measureContour() };
        }, type);
        check(results.plain.pixels > 50, type + ': contour follows body/mount/weapon');
        check(Math.abs(results.selected.minY - results.plain.minY) <= 1 &&
          Math.abs(results.selected.maxX - results.plain.maxX) <= 1 &&
          Math.abs(results.selected.minX - results.plain.minX) <= 1 &&
          Math.abs(results.selected.maxY - results.plain.maxY) <= 1,
        type + ': selection, health bar and aura are excluded from contour');
        check(results.dead.pixels === 0, type + ': dead units have no contour');
      }
      for (const type of ['town', 'house', 'barracks', 'camp']) {
        const results = await page.evaluate(type => {
          const h = window.__RTS_DEMO__, g = h.game, old = window.occlusionFixture.b;
          g.buildings = []; g.units = []; g.blocks.clear(); h.select([]);
          const b = g.building(type, 0, old.gx, old.gy);
          const u = g.spawn('villager', 1, b.gx + .9, b.gy - .3);
          window.occlusionFixture = { b, u };
          const hidden = window.measureContour();
          b.complete = false;
          const scaffold = window.measureContour();
          b.complete = true; b.dead = true;
          return { hidden, scaffold, destroyed: window.measureContour() };
        }, type);
        check(results.hidden.pixels > 50, type + ': enemy outline appears through complete walls/roof');
        check(results.scaffold.pixels === 0 && results.destroyed.pixels === 0,
          type + ': transparent foundations and destroyed buildings add no outline');
      }
      await page.evaluate(() => {
        const { b, u } = window.occlusionFixture;
        b.dead = false; b.type = 'town'; b.size = 3;
        u.owner = 0; u.type = 'heavy_gendarme';
      });
      await page.screenshot({ path: path.join(out, 'mounted-behind-town.png') });
    }
    // A5's escort carts use their real renderer, not a humanoid placeholder.
    await page.goto(pathToFileURL(path.join(root, 'demo/a5_the_rainbow_road.html')).href + '?test=1');
    await page.locator('#play').click();
    const cart = await page.evaluate(() => {
      const h = window.__RTS_DEMO__, g = h.game; h.setPaused(true); h.select([]);
      const b = g.buildings.find(b => b.type === 'town' && b.owner === 0);
      const u = g.units.find(u => u.tag === 'cart');
      g.buildings = [b]; g.units = [u]; g.resources = []; g.effects = [];
      u.x = b.gx + .9; u.y = b.gy - .3;
      const draw = window.drawOccludedUnits, c = document.getElementById('world').getContext('2d');
      window.drawOccludedUnits = () => {}; window.render();
      const a = c.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
      window.drawOccludedUnits = draw; window.render();
      const z = c.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
      return a.some((v, i) => Math.abs(v - z[i]) > 10);
    });
    check(cart, 'escort carts have an outline matching their wagon body');
    await page.screenshot({ path: path.join(out, 'cart-behind-town.png') });
    check(errors.length === 0, 'no browser script errors: ' + errors.join('; '));
    check(!requests.some(url => /^https?:/i.test(url)), 'all contour rendering remains offline');
    console.log(checks + ' occlusion checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
