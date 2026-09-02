import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const moduleRoot=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!moduleRoot)throw new Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES is unavailable');
const playwright=await import(pathToFileURL(path.join(moduleRoot,'playwright/index.js')).href),{chromium}=playwright.default||playwright;
const z=value=>String(value).padStart(2,'0'),localDate=date=>`${date.getFullYear()}-${z(date.getMonth()+1)}-${z(date.getDate())}`,today=localDate(new Date()),tomorrow=localDate(new Date(Date.now()+86400000)),revision='pr-v12-browser';
const item=(workoutId,date,title,distance)=>({workoutId,lineageId:workoutId,planRevisionId:revision,localDate:date,slotIndex:0,status:'scheduled',sport:'running',workoutType:'easy',title,intent:'aerob kontinuitet',prescription:{version:1,legacy:{desc:'Rolig og kontrollert.'}},plannedDurationSeconds:3600,plannedDistanceM:distance,plannedLoad:{},source:'browser-contract',lockLevel:'none'}),todayWorkout=item('wo-v12-today',today,'6,5 km rolig',6500),nextWorkout=item('wo-v12-next',tomorrow,'8 km rolig',8000),validUntil=new Date(Date.now()+86400000).toISOString();
const bootstrap={ok:true,build:'12.0.0',schemaVersion:5,needsMigration:false,planRevisionId:revision,generatedAt:new Date().toISOString(),generatedFromDate:today,flags:{coach_loop_read:true,coach_loop_ui:true,coach_loop_write:true,coach_loop_sync:true,coach_loop_safe_auto:false,coach_loop_goal_confidence:true},config:{timezone:'Europe/Oslo',goal:{mode:'race',name:'Testmål',date:tomorrow,distance:'half'},profile:{baseKm:50,normalLow:48,normalHigh:52,upperLimit:55},constraints:{}},activePlan:{canonicalPlanId:'rb-plan-browser',planRevisionId:revision,status:'active',items:[todayWorkout,nextWorkout]},todayWorkout,coachDecision:{decisionId:'dec-v12-browser',planRevisionId:revision,inputCursor:`${revision}:fixture`,type:'reduce',status:'proposed',confidence:'high',reasonCodes:['POST_WORKOUT_LOAD'],action:{affectedWorkoutIds:[todayWorkout.workoutId],change:{kind:'reduce_duration',reductionPercent:15}},explanation:{title:'Kort ned dagens rolige økt',summary:'Samlet belastning tilsier litt mer margin i dag.',weekImpact:'Resten av uken står.'},validUntil},oneDecision:{version:'one-decision-2',planRevisionId:revision,inputCursor:`${revision}:fixture`,generatedAt:new Date().toISOString(),validUntil,freshness:'current',state:'adjust',tone:'attention',headline:'Kort ned dagens rolige økt',summary:'Samlet belastning tilsier litt mer margin i dag.',workout:todayWorkout,evidence:[{id:'load',label:'Samlet belastning følges',source:'Treningsrespons',tone:'watch'}],primaryAction:{kind:'review_adjustment',label:'Se redusert dose',workoutId:todayWorkout.workoutId},proposal:{decisionId:'dec-v12-browser',kind:'reduce_duration',reductionPercent:15,affectedWorkoutIds:[todayWorkout.workoutId],before:todayWorkout,after:{...todayWorkout,plannedDistanceM:5500},confirmationRequired:true,undoAvailable:true},safety:{planWritesByAi:false,confirmationRequired:true,undoAvailable:true,maximumReductionPercent:20}},bodyResponse:{version:'body-response-1',planRevisionId:revision,state:'as_planned',stateLabel:'Innenfor normalen',confidence:'high',summary:'Søvn, HRV og hvilepuls er innenfor din normal.',metrics:{},domains:[],reasonCodes:[],recommendedAction:{label:'Planen står'},checkIn:{required:false,options:[]},freshness:{status:'fresh',syncedAt:new Date().toISOString()},baselineStatus:{status:'established',sampleCount:21,minDays:10}},contextualCoach:{version:'contextual-coach-1',planRevisionId:revision,mode:'background',surfaces:{today:{visible:true,headline:'Kort ned dagens rolige økt',summary:'Samlet belastning tilsier litt mer margin i dag.'},health:{visible:false},plan:{visible:false},weekly:{}},safety:{planWritesByAi:false,maximumReductionPercent:20}},coachBrief:{version:'coach-brief-1',planRevisionId:revision,freshness:'current',attention:'action',today:{workoutId:todayWorkout.workoutId,title:'Kort ned dagens rolige økt',summary:'Samlet belastning tilsier litt mer margin i dag.',actionKind:'adjust',planChanged:false,affectedWorkoutIds:[todayWorkout.workoutId]},week:{priority:'Beskytt kontinuiteten',reason:'Dagens dose justeres; resten av uken står.',nextChange:'Bare dagens dose foreslås endret.',nextKeyWorkout:{workoutId:nextWorkout.workoutId,localDate:tomorrow,title:nextWorkout.title,workoutType:'easy'},keyWorkoutIds:[nextWorkout.workoutId],watch:[]}},recentActivities:[],responseEvents:[],responseCheckins:[],clientState:{},syncSource:{last_synced_at:new Date().toISOString(),status:'ok'},sync:[]};

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const requests=[];
const server=http.createServer((request,response)=>{
  requests.push(request.url||'');
  const url=new URL(request.url||'/',`http://${request.headers.host}`);
  if(url.pathname==='/api/v2/bootstrap'){response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(bootstrap));return}
  if(url.pathname==='/api/v2/sync/status'){response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true,operations:[]}));return}
  const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)),file=path.resolve(root,relative);
  if(!file.startsWith(`${root}${path.sep}`)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end('Not found');return}
  response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(response);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address(),origin=`http://127.0.0.1:${address.port}`,browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1365,height:900},deviceScaleFactor:1}),errors=[];
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.waitForSelector('html.rb107-ready .rb113-one-decision');
  const firstPaintRequests=[...requests],health=await page.locator('.rb116-health-strip').innerText(),weekStatus=await page.locator('.rb1030-status').innerText();
  if(!/samlet belastning og treningsrespons/i.test(health))throw new Error(`Health explanation is inconsistent: ${health}`);
  if(weekStatus.trim()!=='Handling kreves')throw new Error(`Unexpected weekly status: ${weekStatus}`);
  if(firstPaintRequests.some(value=>value.startsWith('/api/bootstrap')))throw new Error('Legacy bootstrap ran during canonical first paint');
  if(firstPaintRequests.filter(value=>value.startsWith('/api/v2/bootstrap?scope=home')).length!==1)throw new Error(`Expected one canonical home bootstrap: ${firstPaintRequests.join(', ')}`);
  await page.locator('.desktop-nav [data-tab="plan"]').click();await page.waitForSelector('#rb107Plan');
  const width=await page.locator('#rb107Plan').evaluate(node=>node.getBoundingClientRect().width);
  if(width<800)throw new Error(`Desktop plan width is too narrow: ${width}`);
  if(await page.locator('#rb119cMonth').count())throw new Error('Month opened before explicit request');
  const monthButton=page.locator('[data-rb119c-month-focus]');await monthButton.click();await page.waitForSelector('#rb119cMonth');
  if(await monthButton.getAttribute('aria-expanded')!=='true')throw new Error('Month toggle did not expose expanded state');
  if(errors.length)throw new Error(`Browser console errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ok:true,build:'12.0.0',firstPaintCanonicalBootstraps:1,legacyBootstraps:0,clientSyncCalls:requests.filter(value=>value.startsWith('/api/sync/tredict')).length,desktopPlanWidth:Math.round(width),monthDefault:'closed',monthExpanded:true,consoleErrors:0}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
