/* Real mouse input across the skirmish and all standalone missions, offline. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results/browser-selection');
const missions = JSON.parse(fs.readFileSync(path.join(root, 'data/missions/campaigns.v1.json'), 'utf8')).missions;
fs.mkdirSync(out, { recursive: true });
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; console.log('PASS', label); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const errors = [], requests = [];
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('request', (request) => requests.push(request.url().split(',')[0]));
    const files = ['bundschuh_rebellion.html', ...missions.map((spec) => spec.file)];
    const point = (id) => page.evaluate((id) => {
      const h = window.__RTS_DEMO__, unit = h.game.units.find((u) => u.id === id), p = h.screen(unit.x, unit.y);
      return { x: p.x, y: p.y - 14 };
    }, id);
    async function click(id, twice = false) {
      const p = await point(id);
      if (twice) await page.mouse.dblclick(p.x, p.y, { delay: 30 });
      else await page.mouse.click(p.x, p.y);
    }
    async function selected(ids, label) {
      const actual = await page.evaluate(() => window.__RTS_DEMO__.selected.sort((a, b) => a - b));
      check(JSON.stringify(actual) === JSON.stringify([...ids].sort((a, b) => a - b)), label + ' ' + JSON.stringify(actual));
    }
    for (const file of files) {
      await page.goto(pathToFileURL(path.join(root, 'demo', file)).href + '?test=1&play=1');
      const fixture = await page.evaluate(() => {
        const h = window.__RTS_DEMO__, g = h.game;
        h.setPaused(true); h.select([]);
        g.units = []; g.buildings = []; g.resources = []; g.effects = []; g.blocks.clear();
        g.byId.clear(); g.records?.clear();
        const spawn = (type, owner, x, y, extra = {}) => Object.assign(g.spawn(type, owner, x, y), extra);
        const workers = [spawn('villager', 0, 10, 15), spawn('villager', 0, 12, 16), spawn('villager', 0, 39, 27)];
        const soldiers = [spawn('pikeman', 0, 13, 12), spawn('pikeman', 0, 36, 25, { tag: 'reinforcement' })];
        const enemy = spawn('villager', 1, 6, 15);
        spawn('villager', 0, 16, 16, { hp: 0 });
        spawn('villager', 0, 21, 20, { escaped: true });
        spawn('villager', 0, 20, 20, { tag: 'structure' });
        const roles = {};
        if (g.spec) {
          roles.hero = spawn('villager', 0, 10, 12, { tag: 'muentzer', actor: 'muentzer' }).id;
          spawn('villager', 0, 10, 10, { tag: 'anna', actor: 'anna' });
          roles.carts = [spawn('villager', 0, 7, 14, { tag: 'cart' }).id, spawn('villager', 0, 6, 14, { tag: 'cart' }).id];
          spawn('villager', 0, 14, 15, { tag: 'civilian' });
          spawn('villager', 0, 15, 15, { tag: 'courier' });
          spawn('villager', 2, 16, 15, { tag: 'civilian' });
        }
        h.select([]);
        return { workers: workers.map((u) => u.id), soldiers: soldiers.map((u) => u.id), enemy: enemy.id, roles };
      });
      const { workers, soldiers, enemy, roles } = fixture;
      const far = await point(workers[2]);
      check(far.y > 900 || far.x > 1440 || far.x < 0, file + ': matching fixture includes an offscreen unit');
      await click(workers[0]); await selected([workers[0]], file + ': single click selects one unit');
      await click(workers[0], true);
      await selected(workers, file + ': double click selects all living owned workers, including offscreen');
      await page.evaluate((ids) => window.__RTS_DEMO__.select(ids), [soldiers[0]]);
      await page.keyboard.down('Shift'); await click(workers[0], true); await page.keyboard.up('Shift');
      await selected([...workers, soldiers[0]], file + ': Shift double click adds the type without toggling existing members off');
      await page.keyboard.down('Shift'); await click(workers[0]); await page.keyboard.up('Shift');
      await selected([...workers.slice(1), soldiers[0]], file + ': Shift single click still toggles one unit');
      await click(soldiers[0], true);
      await selected(soldiers, file + ': another type replaces the group and includes same-type reinforcements');
      await click(enemy, true); await selected([], file + ': double clicking an enemy never selects hostile units');
      // The first click issues attack-move; only the second is a selection click.
      await page.evaluate((ids) => window.__RTS_DEMO__.select(ids), [soldiers[0]]);
      await page.locator('[data-action="advance"]').click(); await click(workers[0], true);
      await selected([workers[0]], file + ': command clicks do not accidentally become type selection');
      // Box selection remains local; it also resets the double-click history.
      await page.mouse.move(680, 360); await page.mouse.down(); await page.mouse.move(800, 475, { steps: 6 }); await page.mouse.up();
      await selected(workers.slice(0, 2), file + ': drag still selects only units inside its rectangle');
      if (roles.hero) {
        await click(roles.hero, true); await selected([roles.hero], file + ': hero stays distinct from workers and other heroes');
        await click(roles.carts[0], true); await selected(roles.carts, file + ': carts group together without workers or other mission roles');
      }
      // Isolate input -> shared movement from mission objectives in this fixture.
      // Tick the actual Game backend that every MissionGame inherits.
      const movement = await page.evaluate(() => {
        const h = window.__RTS_DEMO__, g = h.game;
        h.select([]); g.units = []; g.byId.clear(); g.records?.clear();
        g.step = h.model.Game.prototype.step; g.ai = () => {};
        const mover = g.spawn('villager', 0, 10, 15), blocker = g.spawn('villager', 0, 10.8, 15);
        h.select([]);
        return { mover: mover.id, blocker: blocker.id, destination: h.screen(14.5, 15.5) };
      });
      await click(movement.mover);
      check(await page.evaluate((id) => window.__RTS_DEMO__.game.movementPriority.has(id) &&
        window.__RTS_DEMO__.game.movementPriority.size === 1, movement.mover), file + ': mouse selection injects movement priority');
      await page.mouse.click(movement.destination.x, movement.destination.y, { button: 'right' });
      await page.evaluate(() => window.__RTS_DEMO__.step(220));
      check(await page.evaluate(({ mover, blocker }) => {
        const g = window.__RTS_DEMO__.game, a = g.byId.get(mover), b = g.byId.get(blocker);
        return Math.hypot(a.x - 14.5, a.y - 15.5) < .08 && Math.abs(b.y - 15) > .2 && b.order.type === 'idle';
      }, movement), file + ': right-clicked selected unit arrives while its idle ally actively yields');
    }
    check(errors.length === 0, 'no runtime errors: ' + errors.join('; '));
    check(requests.every((request) => request.startsWith('file:') || request.startsWith('data:')), 'all selection checks run offline');
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ passed: true, checks, files, errors }, null, 2));
    console.log('Browser selection: ' + checks + ' checks passed');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
