/* Scenario adapters over the original skirmish UI, renderer and controls. */
let lastMissionNotice = '';
function missionGroup(group) {
  const list=game.units.filter(u=>game.selectable(u)&&(group==='heroes'?!!u.actor:group==='followers'?['civilian','courier'].includes(u.tag):['cart','messenger','envoy','prisoner'].includes(u.tag)));
  setSelection(list);
  if(list.length)cam={x:list[0].x,y:list[0].y};else toast('Nhóm này chưa có người trên bản đồ.');
}
function missionPointForGoal(g) {
  const id=g.ids?.find(id=>!game.points.get(id).done)||g.ids?.[0]||g.point||g.to;
  return game.points.get(id)||[...game.points.values()].find(p=>p.kind==='exit');
}
function updateMissionUI() {
  const box=$('mission-goals');
  if(box.children.length!==game.goals.length){
    box.replaceChildren(...game.goals.map((g,index)=>{const b=document.createElement('button');b.className='mission-goal';b.onclick=()=>{const p=missionPointForGoal(game.goals[index]);if(p)cam={x:p.x,y:p.y};};return b;}));
  }
  game.goals.forEach((g,i)=>{box.children[i].textContent=game.goalText(g);box.children[i].classList.toggle('done',g.done);});
  const single=selectedUnits();
  if(single.length===1){const u=single[0],h=$('selection').querySelector('h3');if(h&&(u.actor||['cart','civilian','courier','prisoner','messenger'].includes(u.tag)))h.textContent=missionUnitName(u);}
  const b=game.byId.get(selectedBuilding);
  if(b?.missionName){const h=$('selection').querySelector('h3');if(h)h.textContent=b.missionName;}
  if(game.notice&&lastMissionNotice!==game.notice){lastMissionNotice=game.notice;toast(game.notice);}
  const info=[];
  if(game.spec.stealth)info.push(`Phát hiện ${game.detection.count}/${PACK.stealth.detection_limit} · ${Math.floor(game.detection.meter)}%`);
  if(game.waveAt>game.time)info.push(`Phản công nhiệm vụ: ${Math.ceil(game.waveAt-game.time)}s`);
  if(game.spec.deadline)info.push(`Hạn chót: ${Math.max(0,Math.ceil(game.spec.deadline-game.time))}s`);
  $('enemy-status').textContent=info.join(' · ')||(game.spec.stealth?'Né vùng quan sát, xây làng để hỗ trợ':'Địch khai thác và tuyển quân từ kho thật');
  if(game.spec.id==='A6')$('enemy-name').textContent='PRINCELY HOST';
}
function updateMissionResult() {
  $('result-title').textContent=game.result==='victory'?'Nhiệm vụ hoàn thành.':'Nhiệm vụ thất bại.';
  $('result-text').textContent=game.reason;$('again').textContent='CHƠI LẠI NHIỆM VỤ →';
}
function missionBeforeCommand(x,y) {
  if(!keys.has('alt'))return false;
  const p=world(x,y);
  if([...game.points.values()].some(q=>q.kind==='neutral'&&dist(p,q)<2.5)){
    game.finish('defeat','Đã chủ động phá đình chiến bằng Alt + click phải sau cảnh báo.');finish();return true;
  }
  return false;
}
function missionUnitName(u) {
  return ({muentzer:'Thomas Müntzer',anna:'Anna',joss_fritz:'Joß Fritz',waldburg:'Waldburg',envoy:'Sứ giả',civilian:'Dân cần cứu',cart:'Xe tiếp tế',courier:'Courier',prisoner:'Tù binh',messenger:'Sứ giả cộng đồng'})[u.actor||u.tag]||NAMES[u.type];
}
function drawMissionTerrain() {
  if(game.spec.terrain==='river')for(const b of game.blocks.values())if(b.river)tile(b.x,b.y,'#47717a','#668e88');
  if(['hill','valley'].includes(game.spec.terrain))for(let y=1;y<11;y++)for(let x=17;x<41;x++)if(!game.blocks.has(key(x,y)))tile(x,y,'#b2a86d22');
}
function drawMissionWorld() {
  for(const p of game.points.values()){
    const q=project(p.x,p.y),color=p.owned||p.done||p.kind==='exit'?'#a9cfa7':p.kind==='hostile'||p.kind==='prisoner'?'#d79278':'#dec587';
    ctx.save();ctx.globalAlpha=.22;ellipse(q.x,q.y,2.4*36.77,2.4*18.38,null,color);ctx.globalAlpha=1;
    if(p.progress>0){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,2.4*36.77,2.4*18.38,0,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,p.progress/6));ctx.stroke();}
    line([[q.x,q.y],[q.x,q.y-43]],'#a28b60',2);
    polygon([[q.x,q.y-43],[q.x+23,q.y-39],[q.x+20,q.y-30],[q.x,q.y-33]],color,'#5c6047');
    ctx.font='11px system-ui';ctx.textAlign='center';const width=ctx.measureText(p.name).width+12;
    ctx.fillStyle='#1e2d26e8';ctx.fillRect(q.x-width/2,q.y+9,width,19);ctx.fillStyle='#e6dabd';ctx.fillText(p.name,q.x,q.y+22);ctx.restore();
  }
  if(game.spec.stealth)for(let i=0;i<3;i++){
    const p=game.guard(i),q=project(p.x,p.y);ctx.save();ctx.globalAlpha=.13;ellipse(q.x,q.y,2.5*36.77,2.5*18.38,'#dc775e');ctx.globalAlpha=.65;ellipse(q.x,q.y,2.5*36.77,2.5*18.38,null,'#e2a18a');ctx.globalAlpha=1;drawUnit({id:-i-1,type:'pikeman',owner:1,x:p.x,y:p.y,data:STATS.pikeman,buff:1,moving:true,attackTime:-99,phase:'move',hp:STATS.pikeman.combat.hp,maxHp:STATS.pikeman.combat.hp,cargo:{amount:0}});ctx.restore();
  }
  for(const u of game.units)if(u.hp>0&&(u.actor||['civilian','cart','courier','messenger','prisoner'].includes(u.tag))){
    const p=project(u.x,u.y);ctx.save();ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle=u.owner===2?'#e4c887':'#ecdfb6';ctx.strokeStyle='#223328';ctx.lineWidth=3;const name=missionUnitName(u);ctx.strokeText(name,p.x,p.y-35);ctx.fillText(name,p.x,p.y-35);ctx.restore();
  }
}
function drawMissionCart(u, bodyOnly = false) {
  const p=project(u.x,u.y),selected=selection.has(u.id);
  if(!bodyOnly){ellipse(p.x,p.y+2,18,6,'#22342765');if(selected)ellipse(p.x,p.y,21,10,null,'#b9ecda');}
  polygon([[p.x-16,p.y-10],[p.x+3,p.y-20],[p.x+20,p.y-11],[p.x,p.y]],'#8f754b','#433f2d');
  polygon([[p.x-16,p.y-10],[p.x,p.y-2],[p.x,p.y-14],[p.x-16,p.y-22]],'#ad925f','#564c34');
  polygon([[p.x,p.y-2],[p.x+20,p.y-11],[p.x+20,p.y-23],[p.x,p.y-14]],'#786847','#564c34');
  for(const x of [-11,12]){ellipse(p.x+x,p.y,5,7,'#4b4430','#a58a54');line([[p.x+x,p.y-5],[p.x+x,p.y+5]],'#a58a54',1);}
  if(!bodyOnly)bar(p.x,p.y-28,u.hp/u.maxHp,TEAM[u.owner],34);
}
function drawMissionMinimap() {
  for(const p of game.points.values()){mc.fillStyle=p.owned||p.done?'#b4d498':p.kind==='hostile'?'#dc9b74':'#f0d389';mc.fillRect(p.x*380/W-2,p.y*210/H-2,4,4);}
}
function setupMissionPresentation() {
  const s=PACK.mission;
  document.querySelector('.edition').textContent=s.id+' · '+s.place;
  document.querySelector('.intro-copy p').textContent=s.brief;
  document.querySelector('.title-intro footer').textContent='RTS CAMPAIGN DEMO / '+s.id;
  document.querySelector('.setup > .eyebạnw').textContent='Nhiệm vụ của '+FACTIONS[s.side];
  document.querySelector('.setup h2').textContent=s.title.split(' · ').pop();
  document.querySelector('.setup .note').textContent=s.limits+' Bản HTML có thêm căn cứ và kinh tế RTS: chia dân khai thác, xây nhà, tuyển quân để hỗ trợ mục tiêu.';
  document.querySelector('#objective-content > .eyebạnw').textContent=s.id+' · '+s.place;
  document.querySelector('.mission h2').textContent=s.title.split(' · ').pop();
  document.querySelector('#objective-content > p').textContent='Xây làng, bảo vệ căn cứ và hoàn thành các mục tiêu bên dưới.';
  document.querySelector('.mapbox > span').firstChild.textContent=s.id+' · SEED ';
  $('world').setAttribute('aria-label','Chiến trường isometric '+s.title+'. Click/kéo chọn, click phải ra lệnh.');
  $('new-game').textContent='Xem lại briefing · Bỏ trận hiện tại';
  document.querySelectorAll('[data-faction]').forEach(b=>{const active=b.dataset.faction===s.side;b.disabled=!active;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-mission-group]').forEach(b=>b.onclick=()=>missionGroup(b.dataset.missionGroup));
  const controls=document.querySelector('#help-modal .controls'),extra=document.createElement('div');extra.innerHTML='<b>Q / R / T</b><span>Hero / dân cần cứu, courier / xe, sứ giả, tù binh</span>';controls.append(extra);
  const note=document.createElement('p');note.textContent='Điểm kiểm soát cần 3 quân và không có địch gần. Click một mục tiêu để chuyển camera tới đó. Các dân/xe có tên riêng mới được tính vào giải cứu. '+(s.id==='B2'?'Alt + click phải khu trung lập là lệnh chủ động phá đình chiến và gây thất bại.':'');$('resume').before(note);
  document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.repeat||!started||renderedResult||!$('help-modal').hidden)return;const group={q:'heroes',r:'followers',t:'transport'}[e.key.toLowerCase()];if(group){e.preventDefault();missionGroup(group);}});
}
setupMissionPresentation();
