const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),vm=require('node:vm');
const widths=[[360,800],[375,812],[390,844],[393,852],[430,932],[844,390],[1024,900],[1280,900],[1440,1000]];
const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8');
const bank=vm.runInNewContext(ui.slice(ui.indexOf('const HERO_BANK='),ui.indexOf('const daySeed='))+'HERO_BANK');
async function geometry(page){return page.evaluate(()=>{
 const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return{x:r.x,y:r.y,width:r.width,height:r.height,display:c.display}};
 return{app:rect('.app'),nav:rect(innerWidth<821?'.bottom-nav':'.desktop-nav'),desktop:rect('.desktop-nav'),background:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1};
})}
async function check(page){
 const g=await geometry(page);expect(g.overflow).toBe(false);expect(g.background).toBe('rgb(245, 243, 237)');
 if(page.viewportSize().width<821){expect(g.desktop.display).toBe('none');expect(g.nav.display).toBe('grid')}
 const small=await page.locator('button:visible,summary:visible,input:visible,select:visible').evaluateAll(nodes=>nodes.filter(e=>!['checkbox','radio'].includes(e.type)).map(e=>({label:(e.innerText||e.getAttribute('aria-label')||e.tagName).slice(0,65),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(r=>r.w<43.5||r.h<43.5));
 expect(small).toEqual([]);
}
async function shot(page,testInfo,name){await page.screenshot({path:testInfo.outputPath(name+'.png'),fullPage:true});await testInfo.attach(name,{path:testInfo.outputPath(name+'.png'),contentType:'image/png'})}
for(const [width,height] of widths)test(`shell and four views ${width}x${height}`,async({page},info)=>{
 await page.setViewportSize({width,height});
 await page.route('**/api/**',async route=>{if(route.request().method()!=='GET')return route.fulfill({status:405,body:'{}'});await route.continue()});
 let release;const gate=new Promise(r=>release=r);
 await page.route('**/api/v2/bootstrap*',async route=>{await gate;await route.continue()});
 await page.addInitScript(()=>{window.__cls=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true})});
 await page.goto('/',{waitUntil:'commit'});await page.locator('.rb108-boot').waitFor();
 const before=await geometry(page);await check(page);await shot(page,info,'startup');release();
 await page.locator('html.rb107-ready').waitFor();await check(page);
 const after=await geometry(page);expect(after.app.width).toBe(before.app.width);expect(after.nav).toEqual(before.nav);expect(await page.evaluate(()=>window.__cls)).toBeLessThan(.05);
 await shot(page,info,'today');
 const nav=page.locator(width<821?'.bottom-nav':'.desktop-nav');
 for(const [name,id] of [['Plan','plan'],['Mål','race'],['Mer','more']]){
  await nav.getByRole('button',{name,exact:true}).click();await expect(page.locator('#'+id)).toBeVisible();await check(page);await shot(page,info,id);
  if(id==='plan'){
   await page.getByRole('button',{name:'Åpne månedsoversikt',exact:true}).click();await check(page);await shot(page,info,'month');
   await page.getByRole('button',{name:'Lukk månedsoversikt',exact:true}).click();
   await page.locator('.rb119b-plan-row.key').click();await check(page);await shot(page,info,'selected-day');
   await page.locator('[data-rb1020-day-close]').click();
   await page.locator('[data-rb107-plan-view="done"]').click();await check(page);await shot(page,info,'empty-history');
   await page.locator('[data-rb107-plan-view="plan"]').click();
  }
 }
 await nav.getByRole('button',{name:'I dag',exact:true}).click();
 await page.locator('[data-rb113-decision-action]:visible').first().click();
 await expect(page.getByRole('dialog')).toBeVisible();await check(page);await shot(page,info,'workout-detail');
 const modal=await page.getByRole('dialog').boundingBox();if(width<821)expect(Math.abs(modal.y+modal.height-height)).toBeLessThan(2);
 await page.getByRole('dialog').getByRole('button',{name:'Lukk øktdetaljer'}).press('Tab');
 expect(await page.getByRole('dialog').evaluate(e=>e.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('[data-rb113-decision-action]:visible')).toBeFocused();
 await page.reload();await page.locator('html.rb107-ready').waitFor();await check(page);
});
for(const width of [360,375,390,430])test(`hero bank crop and long copy ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/');await page.locator('html.rb107-ready').waitFor();
 // Render the production media helper against each bank entry, without relying on today's workout type.
 const helper=ui.slice(ui.indexOf('const heroStyle='),ui.indexOf('\n\n  function normalizeGoalState'));
 const hero=vm.runInNewContext(helper+';({heroStyle,heroImage})',{HERO_BANK:bank,esc:x=>String(x)});
 const cards=Object.keys(bank).map(name=>`<section class="rb119b-workout-hero" ${hero.heroStyle(name)}>${hero.heroImage(name,true)}<div class="rb119b-workout-copy"><small>Terskel</small><h2>Kontrollert terskelarbeid med en svært lang beskrivelse av dagens løpeøkt</h2></div></section>`).join('');
 await page.setContent(`<html><head><link rel="stylesheet" href="http://127.0.0.1:4173/runnerbear-v11.css"></head><body><main style="padding:16px;display:grid;gap:24px">${cards}<section class="rb119b-goal-hero" ${hero.heroStyle('race')}>${hero.heroImage('race',true)}<div><small>Runfest Sandnes</small><h2>21K</h2></div></section></main></body></html>`);
 const rows=await page.locator('.rb119b-workout-hero,.rb119b-goal-hero').evaluateAll(nodes=>nodes.map(e=>({w:e.clientWidth,h:e.clientHeight,ratio:getComputedStyle(e).aspectRatio,position:getComputedStyle(e.querySelector('img')).objectPosition})));
 for(const r of rows)expect(Math.abs(r.w/r.h-(r.ratio==='16 / 9'?16/9:1.6))).toBeLessThan(.015);
 expect(new Set(rows.map(r=>r.position)).size).toBeGreaterThan(3);
 const reserved=rows.map(({w,h})=>({w,h}));
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 expect(await page.locator('.rb119b-workout-hero,.rb119b-goal-hero').evaluateAll(nodes=>nodes.map(e=>({w:e.clientWidth,h:e.clientHeight})))).toEqual(reserved);
 await shot(page,info,'hero-bank');
});
test('failed bootstrap has a usable, stable mobile error state',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?fixture=failure');
 await expect(page.getByText('Planen kunne ikke lastes')).toBeVisible();await check(page);await shot(page,info,'error');
});
test('slow bootstrap keeps first-paint geometry and respects reduced motion',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 let release;const gate=new Promise(r=>release=r);await page.route('**/api/v2/bootstrap*',async route=>{await gate;await route.continue()});
 await page.goto('/',{waitUntil:'domcontentloaded'});await check(page);const before=await geometry(page);
 expect(await page.locator('.rb108-boot-mark').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 await shot(page,info,'slow-network');release();await page.locator('html.rb107-ready').waitFor();expect((await geometry(page)).nav).toEqual(before.nav);
});

test('Concept 1 first paint does not require JavaScript',async({browser},info)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/');await check(page);await shot(page,info,'without-javascript');await context.close();
});

test('completed workout and long coach explanation retain mobile proportions',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/v2/bootstrap*',async route=>{
  const response=await route.fetch(),data=await response.json(),w=data.activePlan.items[0],date=w.localDate,stamp=new Date().toISOString();
  w.status='completed';data.todayWorkout=w;data.oneDecision.state='completed';
  data.recentActivities=[{source:'tredict',source_id:'visual-run',date,sport_type:'running',updated_at:stamp,duration_seconds:3600,distance_m:w.plannedDistanceM,avg_hr:145,payload:{id:'visual-run',title:w.title,date,ds:date,sportType:'running',duration:3600,distance:w.plannedDistanceM,heartrate:145}}];
  data.activityHistory={version:'activity-history-1',state:'current',syncedAt:stamp,truncated:false};
  data.contextualCoach.surfaces.postWorkout={visible:true,headline:'God kontroll gjennom økten',summary:'Du holdt jevn innsats og tok hensyn til kroppens signaler. '.repeat(12),consequence:'Neste økt følger planen.'};
  await route.fulfill({response,json:data});
 });
 await page.goto('/');await page.locator('html.rb107-ready').waitFor();
 await expect(page.getByText('Registrert gjennomføring',{exact:true})).toBeVisible();await check(page);
 const contrasts=await page.locator('.rb109-result-head p,.rb109-result-head .rb107-overline,.rb109-result-metrics b,.rb109-result-metrics span,.rb109-coach-verdict p,.rb109-coach-verdict>span').evaluateAll(nodes=>{
  const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const rgb=value=>value.match(/[\d.]+/g).map(Number);
  return nodes.map(e=>{let p=e,bg;do{bg=rgb(getComputedStyle(p).backgroundColor);p=p.parentElement}while(p&&bg.length===4&&bg[3]===0);const a=luminance(rgb(getComputedStyle(e).color)),b=luminance(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
 });
 await shot(page,info,'completed-workout');
 for(const ratio of contrasts)expect(ratio).toBeGreaterThanOrEqual(4.5);
});
