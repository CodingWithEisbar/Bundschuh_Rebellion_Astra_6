/* Real inputs exercise the SAME isometric RTS HUD, economy and controls on all 13 files. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/missions-rts-ui');fs.mkdirSync(out,{recursive:true});
const specs=JSON.parse(fs.readFileSync(path.join(root,'data/missions/campaigns.v1.json'),'utf8')).missions;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
  const errors=[],requests=[];let checks=0;
  const check=(x,label)=>{assert.ok(x,label);checks++;console.log('PASS',label);};
  try{
    const context=await browser.newContext({offline:true,viewport:{width:1440,height:900}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url().split(',')[0]));
    for(const spec of specs){
      await page.goto(pathToFileURL(path.join(root,'demo',spec.file)).href+'?test=1');
      check(await page.locator('#play').isVisible(),spec.id+' uses original two-column menu');
      check(await page.locator('.intro-copy h1 em').innerText()==='REBELLION',spec.id+' keeps chronicle title');
      check(await page.locator('[data-faction].active').getAttribute('data-faction')===spec.side,spec.id+' fixed mission faction');
      check(await page.locator('#menu-music-player audio').count()===1,spec.id+' menu keeps hidden embedded music player');
      if(spec.id==='A3'){await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.intro-copy')).opacity)>.98);await page.screenshot({path:path.join(out,'menu-A3.png')});}
      await page.locator('#play').click();await page.evaluate(()=>window.__RTS_DEMO__.setPaused(true));
      check(await page.locator('#menu-music-player audio').count()===0,spec.id+' entering gameplay releases menu audio');
      check(await page.locator('.hud').isVisible()&&await page.locator('#minimap').isVisible(),spec.id+' same bottom HUD and minimap');
      check(await page.evaluate(()=>window.__RTS_DEMO__.selected.length===8),spec.id+' selects eight actual workers');
      // Dispatch an actual right-click to a berry bush; physical work and deposit follow.
      const food=await page.evaluate(()=>{const h=window.__RTS_DEMO__,g=h.game,r=g.resources.find(r=>r.type==='food'&&r.x<10);return {...h.screen(r.x,r.y),bank:g.players[0].bank.food};});
      await page.mouse.click(food.x,food.y,{button:'right'});
      check(await page.evaluate(()=>window.__RTS_DEMO__.game.units.filter(u=>u.owner===0&&u.tag==='worker').every(u=>u.order.type==='gather')),spec.id+' right-click gathers with original controls');
      await page.evaluate(()=>window.__RTS_DEMO__.step(650));
      check(await page.evaluate(before=>window.__RTS_DEMO__.game.players[0].bank.food>before,food.bank),spec.id+' cargo arrives and credits real bank');
      // Locate a legal, visible foundation. H and the real canvas click place it.
      const place=await page.evaluate(()=>{const h=window.__RTS_DEMO__,g=h.game;const hud=document.querySelector('.hud').getBoundingClientRect(),card=document.querySelector('.mission').getBoundingClientRect();
        for(let y=9;y<27;y++)for(let x=2;x<12;x++){if(g.placement('house',x,y,0))continue;const s=h.screen(x+.2,y+.2);if(s.x>card.right+20&&s.x<innerWidth-60&&s.y>card.bottom+20&&s.y<hud.top-40)return {...s,xg:x,yg:y,cap:g.cap(0)};}return null;});
      check(!!place,spec.id+' has a legal house site near village');
      await page.keyboard.press('h');await page.mouse.click(place.x,place.y);
      check(await page.evaluate(p=>window.__RTS_DEMO__.game.buildings.some(b=>b.gx===p.xg&&b.gy===p.yg&&!b.complete),place),spec.id+' H + click places actual foundation');
      await page.evaluate(()=>window.__RTS_DEMO__.step(1200));
      const state=await page.evaluate(p=>{const g=window.__RTS_DEMO__.game,b=g.buildings.find(b=>b.gx===p.xg&&b.gy===p.yg);return {cap:g.cap(0),time:g.time,result:g.result,reason:g.reason,house:b&&{work:b.work,hp:b.hp,complete:b.complete}};},place);
      if(state.cap!==Math.min(100,place.cap+5))await page.screenshot({path:path.join(out,'failure-'+spec.id+'.png')});
      check(state.cap===Math.min(100,place.cap+5),spec.id+' physical builders complete house and +5 housing '+JSON.stringify(state));
      await page.keyboard.press('Home');
      check(await page.locator('[data-action="train-villager"]').isVisible(),spec.id+' Home selects headquarters with recruitment');
      await page.locator('[data-action="train-villager"]').click();
      check(await page.evaluate(()=>window.__RTS_DEMO__.game.buildings.find(b=>b.owner===0&&b.type==='town').queue.length===1),spec.id+' paid unit queue belongs to real building');
      await page.evaluate(()=>window.__RTS_DEMO__.step(550));
      check(await page.evaluate(()=>window.__RTS_DEMO__.game.metrics.trained>=1),spec.id+' full catalog training duration creates worker');
      await page.keyboard.press('q');
      check(await page.evaluate(()=>window.__RTS_DEMO__.selected.every(id=>!!window.__RTS_DEMO__.game.records.get(id).actor)),spec.id+' Q selects mission hero without changing WASD/C/V');
      await page.keyboard.press('v');
      check(await page.evaluate(()=>window.__RTS_DEMO__.selected.length>0&&window.__RTS_DEMO__.selected.every(id=>window.__RTS_DEMO__.game.isWorker(window.__RTS_DEMO__.game.records.get(id)))),spec.id+' V remains idle economic workers');
      for(const key of ['b','c']){await page.keyboard.press(key);check((await page.locator('#hint').innerText()).startsWith('Đặt công trình'),spec.id+' '+key.toUpperCase()+' keeps original building hotkey');await page.keyboard.press('Escape');}
      // Minimap and wheel use the unmodified original camera.
      const before=await page.evaluate(()=>window.__RTS_DEMO__.cam),mm=await page.locator('#minimap').boundingBox();
      await page.mouse.click(mm.x+mm.width*.8,mm.y+mm.height*.5);
      check(await page.evaluate(p=>window.__RTS_DEMO__.cam.x>p.x+5,before),spec.id+' minimap pans camera');
      await page.mouse.move(800,500);const projectionBefore=await page.evaluate(()=>window.__RTS_DEMO__.screen(20,15));await page.mouse.wheel(0,-100);
      check(await page.evaluate(p=>Math.abs(window.__RTS_DEMO__.screen(20,15).x-p.x)>.1,projectionBefore),spec.id+' wheel zoom uses isometric renderer');
      await page.keyboard.press('Home');await page.mouse.move(1400,880);
      if(['A1','A3','A6','B4','B5'].includes(spec.id))await page.screenshot({path:path.join(out,spec.id+'.png')});
      check(await page.evaluate(()=>{const b=document.querySelector('.hud').getBoundingClientRect();return b.bottom<=innerHeight&&b.right<=innerWidth;}),spec.id+' original HUD fits desktop');
    }
    await page.setViewportSize({width:1024,height:768});await page.goto(pathToFileURL(path.join(root,'demo/a3_the_eternal_council.html')).href+'?test=1');await page.locator('#play').click();
    await page.evaluate(()=>window.__RTS_DEMO__.setPaused(true));await page.mouse.move(1000,740);await page.screenshot({path:path.join(out,'A3-1024.png')});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'1024px has no horizontal overflow');
    await page.goto(pathToFileURL(path.join(root,'demo/p0_secret_oath.html')).href);
    check(await page.evaluate(()=>typeof window.__RTS_DEMO__==='undefined'),'inspection hook only exists with ?test=1');
    check(requests.every(u=>u.startsWith('file:')||u.startsWith('data:')),'all thirteen files stay offline including menu audio');
    check(errors.length===0,'no runtime errors: '+errors.join('; '));
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,network:requests.filter(u=>/^https?:/.test(u))},null,2));
    console.log('Browser mission RTS UI:',checks,'checks passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
