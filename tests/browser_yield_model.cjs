/* Exercise the real embedded movement model; no renderer or duplicate simulation. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const missions = JSON.parse(fs.readFileSync(path.join(root, 'data/missions/campaigns.v1.json'), 'utf8')).missions;
function load(file = 'bundschuh_rebellion.html') {
  const html = fs.readFileSync(path.join(root, 'demo', file), 'utf8'), tags = {};
  for (const tag of html.matchAll(/<script id="([^"]+)" type="application\/json">(.*?)<\/script>/gs)) tags[tag[1]] = tag[2];
  const box = { document: { getElementById: (id) => ({ textContent: tags[id] }) }, structuredClone };
  vm.createContext(box);
  vm.runInContext(html.split('<script>')[1].split('/* MODEL_END */')[0] + '\nthis.BaseGame = Game;', box);
  const g = new box.BaseGame();
  g.units = []; g.resources = []; g.buildings = []; g.effects = []; g.blocks.clear(); g.byId.clear(); g.terrain.fill(0);
  g.ai = () => {};
  return g;
}
let checks = 0;
function test(name, run) { run(); checks++; console.log('PASS', name); }
function ticks(g, count, observe = () => {}) {
  for (let i = 0; i < count; i++) {
    const positions = new Map(g.units.filter((u) => u.hp > 0).map((u) => [u.id, { x: u.x, y: u.y }]));
    g.step();
    assert.ok(g.yieldBudget >= 0 && g.pathBudget >= 0, 'bounded movement budgets');
    for (let a = 0; a < g.units.length; a++) {
      const u = g.units[a]; if (u.hp <= 0) continue;
      const before = positions.get(u.id);
      if (before) assert.ok(Math.hypot(u.x - before.x, u.y - before.y) <= u.data.movement.speed_tiles_per_second * u.buff * .05 + 1e-8, 'one speed-limited displacement per tick');
      for (let b = a + 1; b < g.units.length; b++) {
        const v = g.units[b]; if (v.hp <= 0) continue;
        assert.ok(Math.hypot(u.x - v.x, u.y - v.y) >= u.data.movement.body_radius_tiles + v.data.movement.body_radius_tiles - .008001, 'bodies never overlap');
      }
    }
    observe();
  }
}
const stock = (g, type) => g.players.reduce((n, p) => n + p.bank[type], 0) +
  g.units.reduce((n, u) => n + (u.cargo.type === type ? u.cargo.amount : 0), 0) +
  g.resources.filter((r) => r.type === type).reduce((n, r) => n + r.amount, 0);
for (const file of ['bundschuh_rebellion.html', ...missions.map((spec) => spec.file)]) test(file + ': selected mover gets a continuous friendly sidestep', () => {
  const g = load(file), mover = g.spawn('villager', 0, 6.5, 10.5), blocker = g.spawn('villager', 0, 7.3, 10.5);
  const order = blocker.order;
  g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 12.5, y: 10.5 });
  let yielded = false;
  ticks(g, 260, () => { yielded ||= !!blocker.yieldState; });
  assert.ok(yielded && Math.abs(blocker.y - 10.5) > .2, 'blocker actively steps aside');
  assert.ok(Math.hypot(mover.x - 12.5, mover.y - 10.5) < .08, 'selected mover arrives');
  assert.equal(blocker.order, order, 'yield preserves the original order');
});
test('enemies, neutral units, hold position and selected peers are never forced aside', () => {
  for (const kind of ['enemy', 'neutral', 'hold', 'selected']) {
    const g = load(), mover = g.spawn('villager', 0, 6.5, 10.5), blocker = g.spawn('villager', kind === 'enemy' ? 1 : kind === 'neutral' ? 2 : 0, 7.3, 10.5);
    if (kind === 'hold') g.order([blocker], 'hold');
    g.setMovementPriority(kind === 'selected' ? [mover.id, blocker.id] : [mover.id]);
    g.order([mover], 'move', { x: 11.5, y: 10.5 });
    ticks(g, 120, () => assert.equal(blocker.yieldState, null));
    assert.equal(blocker.x, 7.3); assert.equal(blocker.y, 10.5);
  }
});
test('yielding in a one-tile corridor respects actual body clearance', () => {
  const g = load();
  for (let x = 4; x <= 17; x++) for (const y of [9, 11]) g.resource('wood', x, y, 20);
  const mover = g.spawn('villager', 0, 5.5, 10.5), blocker = g.spawn('villager', 0, 8.5, 10.5);
  g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 15.5, y: 10.5 });
  let yielded = false;
  ticks(g, 420, () => {
    yielded ||= !!blocker.yieldState;
    for (const u of g.units) assert.ok(u.y >= 10.18 - 1e-8 && u.y <= 10.82 + 1e-8, 'no wall penetration');
  });
  assert.ok(yielded && mover.x > 14.5, 'pass the friendly blocker within the corridor');
});
test('yield pauses and resumes real resource work without losing cargo or integer stock', () => {
  const g = load(); g.building('town', 0, 2, 5);
  const worker = g.spawn('villager', 0, 8.5, 10.5), resource = g.resource('gold', 8, 11, 100);
  const mover = g.spawn('villager', 0, 7.5, 10.5);
  worker.cargo = { type: 'gold', amount: 4 };
  g.order([worker], 'gather', resource); worker.phase = 'gather';
  const order = worker.order, initial = stock(g, 'gold');
  g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 13.5, y: 10.5 });
  let yielded = false, delivered = false;
  ticks(g, 1000, () => { yielded ||= !!worker.yieldState; delivered ||= g.metrics.gathered > 0; assert.equal(stock(g, 'gold'), initial); });
  assert.ok(yielded && delivered, 'worker resumes collection and physical deposit after yielding');
  assert.equal(worker.order, order);
});
test('a returning worker retains the return phase while stepping aside', () => {
  const g = load(); g.building('town', 0, 2, 5);
  const worker = g.spawn('villager', 0, 8.5, 10.5), resource = g.resource('gold', 8, 11, 100);
  const mover = g.spawn('villager', 0, 7.5, 10.5);
  worker.cargo = { type: 'gold', amount: 10 }; g.order([worker], 'gather', resource);
  g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 13.5, y: 10.5 });
  const initial = stock(g, 'gold'); let yielded = false;
  ticks(g, 800, () => { yielded ||= worker.yieldState?.phase === 'return'; assert.equal(stock(g, 'gold'), initial); });
  assert.ok(yielded && g.metrics.gathered >= 10);
});
test('builders pause construction while yielding, then complete the same foundation once', () => {
  const g = load(); g.building('town', 0, 2, 5);
  const worker = g.spawn('villager', 0, 8.5, 10.5), foundation = g.building('house', 0, 8, 11, false);
  const mover = g.spawn('villager', 0, 7.5, 10.5);
  g.order([worker], 'build', foundation); const order = worker.order;
  g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 13.5, y: 10.5 });
  let yielded = false;
  for (let n = 0; n < 850; n++) {
    const work = foundation.work, wasYielding = !!worker.yieldState;
    ticks(g, 1);
    if (worker.yieldState) {
      yielded = true;
      if (wasYielding) assert.equal(foundation.work, work, 'no construction from a sidestep');
    }
  }
  assert.ok(yielded && foundation.complete); assert.equal(g.metrics.built, 1);
  assert.equal(order.target, foundation.id); assert.equal(g.cap(0), 25);
});
test('selection changes and fresh orders cancel yielding without stale motion', () => {
  for (const cancel of ['deselect', 'select-blocker', 'new-order', 'owner-change', 'source-death']) {
    const g = load(), mover = g.spawn('villager', 0, 6.5, 10.5), blocker = g.spawn('villager', 0, 7.3, 10.5);
    g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 12.5, y: 10.5 });
    ticks(g, 2); assert.ok(blocker.yieldState);
    if (cancel === 'deselect') g.setMovementPriority([]);
    if (cancel === 'select-blocker') g.setMovementPriority([blocker.id]);
    if (cancel === 'new-order') g.order([blocker], 'hold');
    if (cancel === 'owner-change') blocker.owner = 1;
    if (cancel === 'source-death') mover.hp = 0;
    const before = { x: blocker.x, y: blocker.y };
    ticks(g, 1);
    assert.equal(blocker.yieldState, null, cancel);
    assert.equal(blocker.x, before.x); assert.equal(blocker.y, before.y);
  }
});
test('a selected group passes idle friendlies with bounded planning and no crowd overlap', () => {
  const g = load(), group = [];
  for (let i = 0; i < 8; i++) group.push(g.spawn(i % 2 ? 'pikeman' : 'heavy_gendarme', 0, 5.5 - i % 2 * .7, 8.5 + Math.floor(i / 2) * .7));
  for (let i = 0; i < 5; i++) g.spawn('villager', 0, 8.5, 8 + i * .7);
  g.setMovementPriority(group.map((u) => u.id)); g.order(group, 'move', { x: 15.5, y: 10.5 });
  ticks(g, 500);
  assert.ok(group.every((u) => u.x > 13), 'whole selected group passes');
});
test('opposing allied groups yield to the selected group and resume their original routes', () => {
  const g = load(), selected = [], returning = [];
  for (let i = 0; i < 4; i++) {
    selected.push(g.spawn('villager', 0, 5.5, 8.5 + i * .65));
    returning.push(g.spawn('villager', 0, 10.5, 8.5 + i * .65));
  }
  g.order(selected, 'move', { x: 16.5, y: 10.5 });
  g.order(returning, 'move', { x: 3.5, y: 10.5 });
  const orders = returning.map((u) => u.order);
  g.setMovementPriority(selected.map((u) => u.id));
  let yielded = false;
  ticks(g, 750, () => { yielded ||= returning.some((u) => !!u.yieldState); });
  assert.ok(yielded && selected.every((u) => u.x > 14) && returning.every((u) => u.x < 5));
  for (let i = 0; i < returning.length; i++) {
    assert.ok(returning[i].order === orders[i] || returning[i].order.type === 'idle', 'original route retained until arrival');
    assert.ok(Math.hypot(returning[i].x - orders[i].point.x, returning[i].y - orders[i].point.y) < 1.1, 'returning group reaches its formation');
  }
});
test('a sealed passage waits instead of forcing allies through walls or occupied space', () => {
  const g = load();
  for (let x = 4; x <= 10; x++) for (const y of [9, 11]) g.resource('wood', x, y, 10);
  const mover = g.spawn('villager', 0, 6.5, 10.5), blocker = g.spawn('villager', 0, 7.5, 10.5);
  // Hold units fill both safe sides; these explicit orders remain anchored.
  const a = g.spawn('villager', 0, 7.5, 10.18), b = g.spawn('villager', 0, 7.5, 10.82);
  // Use smaller valid test bodies so the initial fixture has no overlap.
  for (const u of [a, b]) { u.data = structuredClone(u.data); u.data.movement.body_radius_tiles = .1; g.order([u], 'hold'); }
  g.setMovementPriority([mover.id]); g.order([mover], 'move', { x: 9.5, y: 10.5 });
  ticks(g, 200);
  assert.equal(a.y, 10.18); assert.equal(b.y, 10.82);
  assert.ok(mover.x < 7.5 && blocker.x === 7.5, 'no forced overlap or unsafe yield');
});
console.log('Browser yielding model: ' + checks + ' cases passed');
