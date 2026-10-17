/* Mission objectives layered on the complete skirmish economy and combat model. */
const PACK = JSON.parse(document.getElementById('mission-data').textContent);
class MissionGame extends Game {
  generate() {} // Scenario layout; all worker/build/recruit rules come from Game.
  constructor(spec = PACK.mission, seed = 1524) {
    super(spec.side, seed);
    this.spec = structuredClone(spec);
    this.records = new Map(); this.points = new Map(); this.escaped = new Map();
    this.goals = spec.goals.map(g => ({...structuredClone(g), progress:0, done:false, visited:{}}));
    this.notice = ''; this.reason = ''; this.routes = [];this.populationGrant=0;
    this.waveAt = spec.defense ? 45 : spec.id === 'B6' ? 120 : -1;
    this.waves = 0; this.waveTriggered = false;
    this.detection = {meter:0, count:0, unseen:0, armed:true};
    this.players.push({faction:'neutral',bank:{food:0,wood:0,gold:0,stone:0}});
    this.players[0].bank = structuredClone(PACK.rts.starting_bank);
    for (const [id,name,x,y,kind] of spec.points)
      this.points.set(id,{id,name,x,y,kind,progress:0,owned:false,done:false,released:false,body:null});
    for (let y=0;y<H;y++) for(let x=0;x<W;x++) {
      const road=[7,15,23].some(r=>Math.abs(y-r)<=1)||x<13||x>35;
      this.terrain[key(x,y)]=[7,15,23].some(r=>Math.abs(y-r)<=1)?1:0;
      const near=(x>=10&&x<=16&&y>=13&&y<=19)||(spec.defense&&x>=12&&x<=20&&y>=10&&y<=15)||[...this.points.values()].some(p=>dist(p,{x,y})<3.5)||PACK.rts.buildings.some(([type,owner,bx,by])=>x>=bx-1&&y>=by-1&&x<bx+BUILD[type].size+1&&y<by+BUILD[type].size+1)||PACK.rts.resources.some(([,rx,ry])=>Math.abs(x-rx)<=1&&Math.abs(y-ry)<=1);
      const river=spec.terrain==='river'&&x>=20&&x<=22&&![7,15,23].some(r=>Math.abs(y-r)<=2);
      if(river)this.blocks.set(key(x,y),{entity:'terrain',x,y,river:true});
      else if(!x||!y||x===W-1||y===H-1||(!road&&!near&&this.random()<PACK.rts.forest_density))this.resource('wood',x,y,120);
    }
    for(const [type,owner,x,y] of PACK.rts.buildings)this.building(type,owner,x,y);
    for(const [type,x,y,amount] of PACK.rts.resources)this.resource(type,x,y,amount);
    for(let i=0;i<PACK.rts.starting_workers;i++)this.make('villager',0,5+i%4,19.5+Math.floor(i/4)*.7,'worker');
    for(let i=0;i<PACK.rts.enemy_workers;i++)this.make('villager',1,37+i%2,11+Math.floor(i/2)*.7,'worker');
    spec.actors.forEach((a,i)=>this.make('villager',0,7.8,14.5+i*.8,a,a));
    const roster=spec.side==='swabian_league'?['landsknecht_pikeman','crossbowman','heavy_gendarme']:['pikeman','peasant_flailman','crossbowman','pikeman','radical_preacher'];
    for(let i=0;i<spec.army;i++) this.make(roster[i%roster.length],0,11+i%5*.7,14+Math.floor(i/5)*.7,'soldier');
    for(let i=0;i<spec.carts;i++) this.make('villager',0,7.5,22+i*.8,'cart');
    for(let i=0;i<spec.civilians;i++) {
      const n=Math.floor(i/4);
      this.make('villager',spec.defense?0:2,spec.defense?12+i%8:13+n*5,spec.defense?10+Math.floor(i/8):n%2===0?9:22,'civilian');
    }
    for(let i=0;i<(spec.couriers||0);i++) this.make('villager',0,13+i,19,'courier');
    for(const p of this.points.values()) {
      if(['protected','hostile','prisoner'].includes(p.kind)) {
        const u=this.building('camp',p.kind==='protected'?0:1,p.x,p.y);
        // Objective buildings use one authored tile; keep Game's rendering/HP lifecycle.
        for(const k of this.footprint(u))this.blocks.delete(k);
        u.size=1;u.x=p.x+.5;u.y=p.y+.5;this.blocks.set(key(p.x,p.y),u);
        u.missionName=p.name;
        const profile=PACK.objective_profile;
        u.hp=u.maxHp=p.id==='banner'?profile.banner_hp:p.kind==='protected'?profile.protected_hp:profile.hostile_hp;
        if(p.kind==='prisoner') u.damageFloor=Math.round(u.hp*profile.surrender_fraction);
        p.body=u;
      }
      if(p.kind==='capture'&&!spec.stealth) for(let j=0;j<2;j++)
        this.make(spec.side==='swabian_league'?'peasant_flailman':'landsknecht_pikeman',1,p.x+1.6,p.y+j*.8,'soldier');
    }
    if(spec.id==='B6') {
      this.runner=this.make('villager',1,25,4,'runner');
      this.order([this.runner],'move',{x:37,y:23});
    }
    if(spec.id==='A5'){this.make('heavy_gendarme',1,23,15,'soldier');this.make('heavy_gendarme',1,26,15,'soldier');}
    this.populationGrant=Math.max(0,this.population(0)+8-super.cap(0));
    this.spatial.rebuild(this.units);
  }
  spawn(type,owner,x,y){const u=super.spawn(type,owner,x,y);u.tag=type==='villager'?'worker':'soldier';u.actor='';this.records?.set(u.id,u);return u;}
  isWorker(u){return !!u&&u.type==='villager'&&u.tag==='worker';}
  cap(owner){return Math.min(100,super.cap(owner)+(owner===0?(this.populationGrant||0):0));}
  get queue(){return this.buildings.flatMap(b=>b.dead?[]:b.queue);}
  order(units,type,target){if(['gather','build'].includes(type))units=units.filter(u=>this.isWorker(u));return super.order(units,type,target);}
  make(type,owner,x,y,tag,actor='') {
    let p={x,y},found=false;
    const radius=tag==='structure'?PACK.objective_profile.radius:STATS[type].movement.body_radius_tiles;
    for(let n=0;n<400;n++) {
      const q=n?{x:x+(n%17-8)*.43,y:y+(Math.floor(n/17)-5)*.43}:{x,y};
      if(this.staticClear(q,radius)&&this.units.every(u=>u.hp<=0||dist(u,q)>=radius+u.data.movement.body_radius_tiles+.01)){p=q;found=true;break;}
    }
    if(!found)throw new Error('No clear scenario spawn slot within bounded search');
    const u=this.spawn(type,owner,p.x,p.y);
    u.data=structuredClone(u.data); u.tag=tag; u.actor=actor;
    if(!['soldier','reinforcement','worker'].includes(tag)) u.data.combat.attack=0;
    this.records.set(u.id,u); return u;
  }
  staticClear(p,r) {
    for(let y=Math.floor(p.y-r);y<=Math.floor(p.y+r);y++)for(let x=Math.floor(p.x-r);x<=Math.floor(p.x+r);x++)if(!this.free(x,y)&&Math.hypot(p.x-clamp(p.x,x,x+1),p.y-clamp(p.y,y,y+1))<r-1e-5)return false;
    return true;
  }
  actor(name) {return [...this.records.values()].find(u=>u.actor===name);}
  selectable(u) {return u&&u.hp>0&&!u.escaped&&u.owner===0&&u.tag!=='structure';}
  near(p,owner,soldiers=false,r=3) {
    return this.units.filter(u=>u.hp>0&&!u.escaped&&u.owner===owner&&u.tag!=='structure'&&(!soldiers||['soldier','reinforcement'].includes(u.tag))&&dist(u,p)<=r);
  }
  targetFor(u,radius=5) {
    if(u.tag==='structure'||u.owner===2) return null;
    return [...this.units,...this.buildings.filter(b=>!b.dead)].filter(t=>t.hp>0&&!t.escaped&&t.owner!==2&&t.owner!==u.owner&&dist(u,t)<radius).sort((a,b)=>dist(u,a)-dist(u,b))[0]||null;
  }
  combat(u,t,dt,hits){if(u.owner===2||t?.owner===2)return false;return super.combat(u,t,dt,hits);}
  damage(u,t) {
    const h=p=>['hill','valley'].includes(this.spec.terrain)&&p.x>16&&p.y<11?1:0;
    const n=super.damage(u,t); return h(u)>h(t)?Math.floor(n*1.25+.5):n;
  }
  ai() {
    if(!this.spec.stealth){super.ai();return;}
    for(const u of this.units)if(u.owner===1&&this.isWorker(u)&&u.order.type==='idle'){const r=this.nearestResource(u,'food');if(r)this.order([u],'gather',r);}
  }
  command(ids,p,target=null,deliberate=false) {
    if(this.result)return;
    if(deliberate&&[...this.points.values()].some(v=>v.kind==='neutral'&&dist(v,p)<2.5)) {
      this.finish('defeat','Đã chủ động phá đình chiến sau cảnh báo briefing.');return;
    }
    const units=ids.map(id=>this.records.get(id)).filter(u=>this.selectable(u));
    for(const u of units) this.order([u],target?'attack':u.data.combat.attack>0?'advance':'move',target||p);
    // Use the engine's formation distribution for groups moving to a point.
    if(!target) {
      this.order(units.filter(u=>u.data.combat.attack>0),'advance',p);
      this.order(units.filter(u=>!u.data.combat.attack),'move',p);
    }
  }
  enlist(type) {
    const b=this.buildings.find(b=>b.owner===0&&b.type==='barracks'&&!b.dead);
    return !this.result&&!!b&&this.recruit(b,type);
  }
  guard(i) {const a=[[16,10],[25,19],[32,12]][i];return {x:a[0]+Math.sin(this.time*.35+i)*2,y:a[1]+Math.cos(this.time*.35+i)*1.2};}
  stealth() {
    const d=this.detection,c=PACK.stealth,a=this.actor(this.spec.actors[0]);
    const seen=!a.escaped&&[0,1,2].some(i=>dist(a,this.guard(i))<2.5);
    if(seen) {
      d.unseen=0;
      if(d.armed) {
        d.meter=Math.min(100,d.meter+100*STEP/c.exposure_seconds);
        if(d.meter>=100-1e-6){d.meter=100;d.armed=false;d.count++;if(d.count>=c.detection_limit)this.finish('defeat','Ba lần phát hiện đã được xác nhận.');}
      }
    } else {
      d.unseen+=STEP;d.meter=Math.max(0,d.meter-c.decay_per_second*STEP);
      if(d.meter<1e-6&&d.unseen>=c.rearm_unseen_seconds-1e-6){d.meter=0;d.armed=true;}
    }
  }
  step() {
    if(this.result)return;
    if(this.spec.payroll&&(this.tick+1)%600===0) {
      const merc=this.units.filter(u=>u.hp>0&&u.owner===0&&u.type==='landsknecht_pikeman');
      this.players[0].bank.gold=Math.max(0,this.players[0].bank.gold-merc.length);
      if(!this.players[0].bank.gold)for(const u of merc){u.owner=1;u.order={type:'idle'};u.buff=u.attackRate=1;this.notice='Gold bằng 0: Landsknecht đã đào ngũ sang phe địch.';}
    }
    super.step();
    // Destroying the enemy HQ supports the mission; it does not replace its objectives.
    if(this.result==='victory')this.result=null;
    if(this.result==='defeat'||this.buildings.some(b=>b.type==='town'&&b.owner===0&&b.dead)){this.result='defeat';this.reason='Sở chỉ huy của bạn đã bị phá hủy.';return;}
    if(this.spec.stealth)this.stealth();
    if(this.result)return;
    this.updatePoints();this.updateGoals();this.failures();
    if(this.result)return;
    if(this.runner&&this.runner.hp>0&&dist(this.runner,{x:37,y:23})<2){this.waveAt=Math.min(this.waveAt,this.time+45);this.runner=null;this.notice='Sứ giả tới trại Đông: phản công sau 45 giây.';}
    if(this.waveAt>=0&&this.time>=this.waveAt)this.wave();
    if(this.goals.every(g=>g.done))this.finish('victory',this.spec.ending);
  }
  updatePoints() {
    for(const p of this.points.values()) {
      if(p.kind==='capture') {
        const ours=this.near(p,0,true).length>=3, contested=this.near(p,1,true,4).length>0;
        if(ours&&!contested)p.progress=Math.min(6,p.progress+STEP);
        else if(!ours)p.progress=Math.max(0,p.progress-STEP*2);
        p.owned=p.progress>=6-1e-6&&!contested;
      }
      if(p.kind==='prisoner'&&!p.released&&p.body.hp<=p.body.damageFloor) {
        p.body.owner=2; p.progress=this.near(p,0,true).length?p.progress+STEP:0;
        if(p.progress>=6&&this.population(0)<this.cap(0)){this.evacuate(p.body);this.make('villager',0,p.x,p.y,'prisoner');p.released=true;this.notice='Chỉ huy đầu hàng. Chọn tù binh để hộ tống về trạm.';}
      }
      if(this.spec.reinforcements&&['r1','r2','r3'].includes(p.id)&&!p.released) {
        const ready=p.kind==='capture'?p.owned:dist(this.actor('muentzer'),p)<2.5;
        if(ready&&this.cap(0)-this.population(0)<13){this.notice='Cần 13 chỗ dân số để nhận sứ giả và quân viện. Chọn dân, H để xây thêm nhà.';continue;}
        if(ready&&(p.kind!=='supply_route'||this.canPay(0,{food:300}))) {
          if(p.kind==='supply_route')this.pay(0,{food:300});
          p.released=true;this.routes.push(p.id);this.make('villager',0,p.x,p.y,'messenger').route=p.id;
          for(let i=0;i<12;i++){const u=this.make(i%2?'peasant_flailman':'pikeman',0,p.x,p.y,'reinforcement');u.data=structuredClone(STATS[u.type]);u.route=p.id;}
        }
      }
    }
    for(const u of this.units)if(u.hp>0&&u.owner===2&&u.tag==='civilian'&&this.near(u,0,false,2.5).length){if(this.population(0)>=this.cap(0)){this.notice='Thiếu nhà để tiếp nhận dân. Chọn thợ và H để xây nhà.';continue;}u.owner=0;this.notice='Người theo gia nhập; chọn nhóm nhiệm vụ để hộ tống.';}
    const owned=[...this.points.values()].filter(p=>p.owned).length,delivered=this.goals.some(g=>g.kind==='visit'&&Object.keys(g.visited).length);
    if(!this.waveTriggered&&!this.spec.stealth&&this.spec.id!=='B6'&&(this.spec.id==='A2'?delivered:owned>=(this.spec.id==='B5'?1:2))) {
      this.waveTriggered=true;this.waveAt=this.time+45;this.notice='Trinh sát: phản công từ mép Đông sau 45 giây.';
    }
  }
  evacuate(u) {u.escaped=true;if(u.entity==='building'){u.dead=true;for(const k of this.footprint(u))this.blocks.delete(k);this.navRevision++;}else this.units=this.units.filter(v=>v!==u);this.byId.delete(u.id);u.order={type:'idle'};}
  updateGoals() {
    for(const g of this.goals) {
      if(g.done||(g.after!==undefined&&!this.goals[g.after].done))continue;
      if(g.kind==='control') {
        const count=g.ids.filter(id=>this.points.get(id).owned).length;
        g.progress=count>=g.required?g.progress+STEP:0;g.done=g.progress>=g.seconds-1e-6;
      } else if(g.kind==='visit') {
        const a=this.actor(g.actor);
        for(const id of g.ids) {
          if(g.visited[id])continue;
          const p=this.points.get(id),ready=!a.escaped&&dist(a,p)<2.5&&this.near(p,0).length>=g.escort+1&&!this.near(p,1,true,4).length;
          p.progress=ready?p.progress+STEP:0;
          if(p.progress>=g.seconds-1e-6){g.visited[id]=true;p.done=true;}
        }
        g.progress=Object.keys(g.visited).length;g.done=g.progress===g.ids.length;
      } else if(g.kind==='escape') {
        for(const u of [...this.units])if(this.selectable(u)&&g.tags.includes(u.tag)&&[...this.points.values()].some(p=>(p.id===g.to||(g.to==='any_exit'&&p.kind==='exit'))&&dist(u,p)<2.4)) {
          this.escaped.set(u.id,u.tag);this.evacuate(u);
        }
        const counts={};g.progress=0;
        for(const tag of this.escaped.values())if(g.tags.includes(tag)){g.progress++;counts[tag]=(counts[tag]||0)+1;}
        g.done=g.progress>=g.required&&Object.entries(g.minimums||{}).every(([tag,n])=>(counts[tag]||0)>=n);
        if(this.spec.reinforcements)g.done=g.done&&this.possibleRoutePair(true);
      } else if(g.kind==='supply') {
        if(dist(this.actor(g.actor),this.points.get(g.point))<2.5&&this.canPay(0,{food:g.amount})){this.pay(0,{food:g.amount});g.done=true;g.progress=g.amount;}
      } else if(g.kind==='destroy') {
        g.progress=g.ids.filter(id=>this.points.get(id).body.hp<=0).length;g.done=g.progress>=g.required;
      } else if(g.kind==='survive') {
        g.progress=Math.min(this.time,g.seconds);g.done=this.time>=g.seconds-1e-6&&this.points.get(g.point).body.hp>0;
      } else if(g.kind==='routes') {g.progress=this.routes.length;g.done=g.progress>=g.required;}
    }
  }
  failures() {
    for(const a of this.spec.actors)if(this.actor(a).hp<=0)this.finish('defeat','Nhân vật bắt buộc đã ngã xuống: '+a);
    for(const g of this.goals) {
      if(g.kind==='survive'&&!g.done&&this.points.get(g.point).body.hp<=0)this.finish('defeat','Mất mục tiêu cần bảo vệ.');
      if(g.kind==='escape'&&!g.done&&!this.spec.reinforcements&&!this.spec.prisoners) {
        const alive=[...this.records.values()].filter(u=>u.hp>0&&g.tags.includes(u.tag));
        if(alive.length<g.required||!Object.entries(g.minimums||{}).every(([tag,n])=>alive.filter(u=>u.tag===tag).length>=n))this.finish('defeat','Không còn đủ đối tượng mang ID nhiệm vụ để hoàn tất.');
      }
      if(g.kind==='escape'&&!g.done&&this.spec.prisoners){const possible=[...this.records.values()].filter(u=>u.tag==='prisoner'&&u.hp>0).length+[...this.points.values()].filter(p=>p.kind==='prisoner'&&!p.released).length;if(possible<g.required)this.finish('defeat','Một tù binh bắt buộc đã chết trước khi về trạm.');}
      if(g.kind==='escape'&&!g.done&&this.spec.reinforcements&&!this.possibleRoutePair(false))this.finish('defeat','Không còn hai tuyến có thể cứu đủ sứ giả và quân viện.');
    }
    if(this.spec.protect_any&&this.spec.protect_any.every(id=>this.points.get(id).body.hp<=0))this.finish('defeat','Không còn công trình nhiệm vụ cần bảo vệ.');
    if(this.spec.protect_until_supply&&!this.goals[1].done&&this.points.get(this.spec.protect_until_supply).body.hp<=0)this.finish('defeat','Kho cứu tế bị phá trước khi giao đủ Food.');
    if(this.spec.deadline&&this.time>=this.spec.deadline&&!this.goals.every(g=>g.done))this.finish('defeat','Đã hết thời gian sơ tán.');
    const cheapest=this.spec.side==='bundschuh'?'peasant_flailman':'crossbowman';
    if(!this.spec.stealth&&!this.queue.length&&!this.units.some(u=>u.owner===0&&u.hp>0&&u.data.combat.attack>0)&&!this.canPay(0,STATS[cheapest].economy.cost)&&this.goals.some(g=>['control','destroy'].includes(g.kind)&&!g.done))this.finish('defeat','Không còn lực lượng hoặc tài nguyên để giành mục tiêu.');
  }
  possibleRoutePair(onlyEscaped) {
    const counts={};
    for(const route of ['r1','r2','r3'])counts[route]=!onlyEscaped&&!this.points.get(route).released?{messenger:1,reinforcement:12}:{messenger:0,reinforcement:0};
    for(const u of this.records.values())if(u.route&&u.hp>0&&(!onlyEscaped||this.escaped.has(u.id)))counts[u.route][u.tag]++;
    const a=Object.values(counts);
    return a.some((x,i)=>a.some((y,j)=>i<j&&x.messenger&&y.messenger&&x.reinforcement+y.reinforcement>=16));
  }
  wave() {
    this.waves++;
    if(this.waves>(this.spec.defense?6:3)){this.waveAt=-1;return;}
    for(let i=0;i<(this.spec.defense?4+this.waves:4);i++) {
      const type=this.spec.side==='swabian_league'?'peasant_flailman':i%3?'landsknecht_pikeman':'heavy_gendarme';
      const u=this.make(type,1,38,7+8*(this.waves%3),'soldier');
      this.order([u],'advance',this.spec.defense?{x:20,y:15}:{x:8,y:15});
    }
    this.waveAt=this.time+(this.spec.defense?30:60);this.notice=`Đợt địch ${this.waves} đã vào từ mép Đông. Ngân sách hữu hạn.`;
  }
  finish(result,reason) {if(!this.result){this.result=result;this.reason=reason;}}
  goalText(g) {return `${g.done?'✓':'○'} ${g.label}  ${Math.floor(g.progress)}/${g.kind==='visit'?g.ids.length:g.seconds||g.required||g.amount}`;}
}
const MISSION_MODEL={MissionGame,PACK,STEP,STATS,W,H};
