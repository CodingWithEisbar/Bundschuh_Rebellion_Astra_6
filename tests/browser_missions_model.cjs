/* Execute each actual standalone artifact through its preserved MODEL_END boundary. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),specs=JSON.parse(fs.readFileSync(path.join(root,'data/missions/campaigns.v1.json'),'utf8')).missions;
const master=fs.readFileSync(path.join(root,'demo/bundschuh_rebellion.html'),'utf8'),masterCss=master.match(/<style>(.*?)<\/style>/s)[1];
let passed=0;
function test(name,run){run();passed++;console.log('PASS',name);}
function load(spec){
  const html=fs.readFileSync(path.join(root,'demo',spec.file),'utf8'),tags={};
  assert.ok(html.includes(masterCss),'complete original CSS is preserved');
  const audio=text=>text.match(/<script id="menu-music-fallback-data"[^>]*>(.*?)<\/script>/s)[1];
  assert.ok(audio(html)===audio(master),'same embedded AAC recording as the original');
  for(const marker of ['<header class="top">','<section class="hud">','id="minimap"','const project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 13 });'])assert.ok(html.includes(marker),'original isometric HUD: '+marker);
  const building=text=>text.split('function drawBuilding(b) {')[1].split('function bar(')[0];
  assert.equal(building(html),building(master),'buildings use the exact original renderer');
  for(const m of html.matchAll(/<script id="([^"]+)" type="application\/json">(.*?)<\/script>/gs))tags[m[1]]=m[2];
  const box={document:{getElementById:id=>({textContent:tags[id]})},structuredClone};vm.createContext(box);
  vm.runInContext(html.split('<script>')[1].split('/* MODEL_END */')[0]+'\nthis.model=MISSION_MODEL;',box);
  assert.ok(!/<(?:script|link|img|audio)[^>]+(?:src|href)="https?:/i.test(html),'no remote runtime assets');
  const g=new box.model.MissionGame();assert.equal(JSON.stringify(g.spec),JSON.stringify(spec));
  return g;
}
const mission=id=>load(specs.find(s=>s.id===id));
const ticks=(g,n)=>{for(let i=0;i<n;i++)g.step();};
for(const spec of specs)test(spec.id+' is embedded exactly and playable offline',()=>{
  const g=load(spec);ticks(g,20);assert.equal(g.time,1);assert.equal(g.result,null);assert.equal(g.goals.length,spec.goals.length);
  for(const p of g.points.values())assert.ok(p.body?.entity==='building'?g.perimeter(p.body).some(v=>g.path(g.actor(spec.actors[0]),v)):g.path(g.actor(spec.actors[0]),p),p.name+' reachable');
  assert.equal(g.units.filter(u=>u.owner===0&&g.isWorker(u)).length,8);
  assert.ok(g.buildings.some(b=>b.owner===0&&b.type==='town'));
  assert.ok(g.buildings.some(b=>b.owner===0&&b.type==='barracks'));
});
for(const spec of specs)test(spec.id+' real worker loop conserves finite Food',()=>{
  const g=load(spec);g.ai=()=>{};
  const stock=()=>g.players.reduce((n,p)=>n+p.bank.food,0)+g.units.reduce((n,u)=>n+(u.cargo.type==='food'?u.cargo.amount:0),0)+g.resources.filter(r=>r.type==='food').reduce((n,r)=>n+r.amount,0);
  const initial=stock(),bank=g.players[0].bank.food,u=g.units.find(u=>u.owner===0&&g.isWorker(u)),r=g.resources.find(r=>r.type==='food'&&r.x<10);
  g.order([u],'gather',r);ticks(g,600);
  assert.equal(stock(),initial);assert.ok(g.players[0].bank.food>bank,'only physical delivery credits bank');assert.ok(r.amount<r.original);
});
test('P0 visits all three contacts then escapes; terminal result latches',()=>{
  const g=mission('P0'),a=g.actor('joss_fritz');
  for(const id of ['meet1','meet2','meet3']){const p=g.points.get(id);Object.assign(a,{x:p.x,y:p.y});for(let n=0;n<41;n++)g.updateGoals();}
  Object.assign(a,{x:38,y:15});ticks(g,1);assert.equal(g.result,'victory');const t=g.time;ticks(g,100);assert.equal(g.time,t);
});
test('detection counts the union once and requires full unseen rearming',()=>{
  const g=mission('P0'),a=g.actor('joss_fritz');
  for(let episode=0;episode<3;episode++){
    for(let n=0;n<41;n++){Object.assign(a,g.guard(0));g.step();}
    if(episode<2){assert.equal(g.detection.count,episode+1);for(let n=0;n<100;n++){Object.assign(a,g.guard(0));g.step();}assert.equal(g.detection.count,episode+1);a.x=5;a.y=15;ticks(g,41);}
  }
  assert.equal(g.result,'defeat');assert.equal(g.detection.count,3);
});
test('A5 second cart lost fails immediately; heroes and carts are unique',()=>{
  const g=mission('A5'),c=[...g.records.values()].filter(u=>u.tag==='cart');c[0].hp=0;g.failures();assert.equal(g.result,null);c[1].hp=0;g.failures();assert.equal(g.result,'defeat');
});
test('A3 supply spends a real integer 600 Food once',()=>{
  const g=mission('A3');Object.assign(g.actor('muentzer'),{x:9,y:8});g.updateGoals();g.updateGoals();assert.equal(g.players[0].bank.food,300);assert.ok(g.goals[1].done);
});
test('B4 simultaneous lethal contacts surrender rather than kill, then escort',()=>{
  const g=mission('B4'),p=g.points.get('cmd1');
  for(const u of g.units){if(u.owner===1&&u!==p.body)u.hp=0;}
  const troops=g.units.filter(u=>u.owner===0&&u.data.combat.attack>0);
  troops.forEach((u,i)=>{u.x=p.x+.8*Math.cos(i);u.y=p.y+.8*Math.sin(i);g.order([u],'attack',p.body);});
  ticks(g,500);assert.equal(p.body.hp,45);assert.ok(p.released);
  const captive=[...g.records.values()].filter(u=>u.tag==='prisoner');assert.equal(captive.length,1);captive[0].hp=0;g.failures();assert.equal(g.result,'defeat');
});
test('B2 neutral orders are safe, deliberate attack is terminal',()=>{
  const g=mission('B2'),a=g.actor('waldburg');g.command([a.id],g.points.get('talk'));assert.equal(g.result,null);g.command([a.id],g.points.get('talk'),null,true);assert.equal(g.result,'defeat');
});
test('A6 tagged loss fails and Banner survival does not get revoked',()=>{
  const g=mission('A6');[...g.records.values()].filter(u=>u.tag==='civilian').slice(0,17).forEach(u=>u.hp=0);g.failures();assert.equal(g.result,'defeat');
  const b=mission('A6');b.time=195;b.updateGoals();b.points.get('banner').body.hp=0;b.failures();assert.ok(b.goals[0].done);assert.equal(b.result,null);
});
test('A4 remaining third route preserves feasibility and rescue uses a valid pair',()=>{
  const g=mission('A4');assert.ok(g.possibleRoutePair(false));g.points.get('r1').released=true;assert.ok(g.possibleRoutePair(false));g.points.get('r2').released=true;assert.ok(!g.possibleRoutePair(false));
});
test('B1 payroll spends real Gold and mutiny changes ownership at zero',()=>{
  const g=mission('B1');g.players[0].bank.gold=1;g.tick=599;g.step();assert.equal(g.players[0].bank.gold,0);assert.ok(!g.units.some(u=>u.hp>0&&u.type==='landsknecht_pikeman'&&u.owner===0));
});
test('recruitment uses shared costs, faction and full train time',()=>{
  const g=mission('B1'),n=g.units.length;assert.ok(g.enlist('heavy_gendarme'));assert.equal(g.players[0].bank.gold,800);assert.ok(!g.enlist('peasant_flailman'));assert.equal(g.units.length,n);assert.equal(g.queue.length,1);
});
test('high ground adds 25 percent after counters, not screen Y',()=>{
  const g=mission('B3'),u=g.make('pikeman',0,18,7,'soldier'),t=g.make('heavy_gendarme',1,18,15,'soldier');assert.equal(g.damage(u,t),34);u.x=10;assert.equal(g.damage(u,t),27);
});
test('real navigation moves a body without an instant teleport',()=>{
  const g=mission('P0'),u=g.actor('joss_fritz'),start={x:u.x,y:u.y};g.command([u.id],{x:9,y:15});const goal={...u.order.point};g.step();assert.ok(Math.hypot(u.x-start.x,u.y-start.y)<.1);ticks(g,380);assert.ok(Math.hypot(u.x-goal.x,u.y-goal.y)<.2,`body ${u.x},${u.y} reaches ${goal.x},${goal.y}`);
});
for(const spec of specs)test(spec.id+' objective fixtures can reach a terminal victory',()=>{
  const g=load(spec);
  g.populationGrant=100; // Fixture grants housing; the UI uses real houses.
  for(const p of g.points.values())if(p.kind==='prisoner')p.body.hp=p.body.damageFloor;
  for(const u of g.units){if(u.owner===1)u.hp=u.damageFloor||0;if(u.owner===2&&u.tag==='civilian')u.owner=0;}
  const army=g.units.filter(u=>u.owner===0&&u.tag==='soldier'&&u.data.combat.attack>0);let slot=0;
  for(const p of g.points.values())if(['capture','prisoner'].includes(p.kind))for(let i=0;i<3;i++){const u=army[slot++%army.length];if(u){u.x=p.x+.3*i;u.y=p.y+.4;}}
  for(let n=0;n<530;n++){g.updatePoints();g.updateGoals();}
  if(spec.reinforcements)for(const id of ['r1','r2']){Object.assign(g.actor('muentzer'),{x:g.points.get(id).x,y:g.points.get(id).y});g.updatePoints();g.updateGoals();}
  for(const goal of g.goals){
    if(goal.kind==='visit')for(const id of goal.ids){const p=g.points.get(id),a=g.actor(goal.actor);a.x=p.x;a.y=p.y;for(let i=0;i<goal.escort;i++){army[i].x=p.x+.3*(i+1);army[i].y=p.y;}
      for(let n=0;n<Math.ceil(goal.seconds/.05)+2;n++)g.updateGoals();}
    if(goal.kind==='supply'){const p=g.points.get(goal.point),a=g.actor(goal.actor);a.x=p.x;a.y=p.y;g.updateGoals();}
    if(goal.kind==='destroy'){for(const id of goal.ids)g.points.get(id).body.hp=0;g.updateGoals();}
    if(goal.kind==='survive'){g.time=goal.seconds+.1;g.tick=Math.round(g.time/.05);g.updateGoals();}
  }
  for(const goal of g.goals)if(goal.kind==='escape'){
    const p=goal.to==='any_exit'?[...g.points.values()].find(p=>p.kind==='exit'):g.points.get(goal.to);
    for(const u of g.units)if(g.selectable(u)&&goal.tags.includes(u.tag)){u.x=p.x;u.y=p.y;}
    g.updateGoals();
  }
  assert.ok(g.goals.every(x=>x.done),g.goals.map(x=>g.goalText(x)).join('; '));
  g.step();assert.equal(g.result,'victory',g.reason);
});
console.log('Browser missions model:',passed,'cases passed');
