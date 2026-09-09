const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const trust=require('../runnerbear-v1222-data-trust.js'),race=require('../runnerbear-v122-race-focus.js');
const now=Date.parse('2026-09-09T10:00:00Z'),stamp=new Date(now).toISOString();
const snapshot=(rows=[])=>({ok:true,generatedAt:stamp,flags:{coach_loop_read:false,coach_loop_ui:false,coach_loop_write:false,coach_loop_sync:false,coach_loop_safe_auto:false},planRevisionId:'pr-a',activePlan:{planRevisionId:'pr-a',status:'active',items:[]},recentActivities:rows,activityHistory:{version:'activity-history-1',state:'current',syncedAt:stamp,truncated:false}});
const activity={source_id:'run-8',date:'2026-09-08',sport_type:'running',title:'6 × 6 min terskel',distance_m:12000,duration_seconds:3600,pace_seconds_per_km:300,avg_hr:155,max_hr:174,payload:{id:'run-8',summary:{distance:11999},detail:{analysis:{workPace:240}}}};
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
function ui(data){
 const localStorage=storage(),window={RunnerBearDataTrust:trust,RunnerBearRaceFocus:race,RunnerBearCloudV11:{snapshot:()=>data},RunnerBearCoachEngine:{schedule:()=>[{ds:'2026-09-08',type:'quality',title:'6 × 6 min terskel',km:12,week:1,label:'test'}]},addEventListener(){},dispatchEvent(){}},document={readyState:'loading',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
 const source=fs.readFileSync('runnerbear-ui-v11-source.js','utf8').replace("  if(document.readyState==='loading')",'  window.audit={activities,completedRows,completedHtml,sessionState,planOverviewHtml,canonicalSyncSummary,dataTime};\n  if(document.readyState===\'loading\')');
 vm.runInNewContext(source,{window,document,localStorage,sessionStorage:storage(),Date:Clock,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},CustomEvent:class{},console});
 return{api:window.audit,os:window.RunnerBearCoachOS,localStorage};
}
test('fresh activity history is readable with every plan authority flag disabled',()=>{
 const data=snapshot([activity]),before=JSON.stringify(data),h=trust.history(data,now);assert.equal(h.current,true);assert.equal(h.rows[0].source_id,'run-8');assert.equal(trust.covers(h,'2026-09-08'),true);assert.equal(JSON.stringify(data),before);
});
test('failed, incomplete, future-dated and stale history never proves absence',()=>{
 for(const edit of [d=>delete d.activityHistory,d=>d.activityHistory.state='pending',d=>d.activityHistory.syncedAt='bad',d=>d.activityHistory.syncedAt=new Date(now-7*3600000).toISOString(),d=>d.activityHistory.syncedAt=new Date(now+120000).toISOString(),d=>d.ok=false]){const d=snapshot();edit(d);assert.equal(trust.covers(trust.history(d,now),'2026-09-08'),false)}
 const d=snapshot();Object.assign(d.activityHistory,{truncated:true,oldestDate:'2026-09-01'});const h=trust.history(d,now);assert.equal(trust.covers(h,'2026-08-31'),false);assert.equal(trust.covers(h,'2026-09-01'),false);assert.equal(trust.covers(h,'2026-09-02'),true);assert.equal(trust.covers(h,null),false);
});
test('actual UI shows a cold-start activity, its completed session and measured values without changing raw history',()=>{
 const data=snapshot([activity]),before=JSON.stringify(data),{api,os}=ui(data),a=api.activities()[0];assert.equal(a.distance,12000);assert.equal(a.pace,300);assert.equal(a.heartrateMax,174);assert.equal(a.detail.analysis.workPace,240);assert.equal(api.completedRows().length,1);assert.equal(os.sessionState(os.planFor('2026-09-08')).code,'completed');assert.match(api.completedHtml(),/6 × 6 min terskel/);assert.doesNotMatch(api.completedHtml(),/Ingen aktiviteter|historikken avklares/i);assert.equal(JSON.stringify(data),before);
});
test('actual UI leaves missing history pending and accepts completion when the automatic refresh arrives',()=>{
 const data=snapshot();data.activityHistory.state='pending';const {api,os}=ui(data),p=os.planFor('2026-09-08');assert.equal(api.sessionState(p).code,'pending');assert.match(api.completedHtml(),/Aktivitetshistorikken avklares/);data.recentActivities=[activity];data.activityHistory.state='current';assert.equal(api.sessionState(p).code,'completed');
});
test('calendar confirmation requires the current revision and a valid recent receipt',()=>{
 const data=snapshot(),{api}=ui(data);assert.equal(api.dataTime(null),'ikke bekreftet');assert.equal(api.canonicalSyncSummary().tone,'idle');data.calendarMirror={active_plan_revision_id:'pr-a',last_result:'confirmed',last_completed_at:stamp,window_start:'2026-09-09',window_end:'2026-09-22'};assert.equal(api.canonicalSyncSummary().tone,'confirmed');assert.match(api.canonicalSyncSummary().copy,/klokken er ikke bekreftet/);data.calendarMirror.active_plan_revision_id='pr-old';assert.equal(api.canonicalSyncSummary().tone,'idle');data.calendarMirror.active_plan_revision_id='pr-a';data.calendarMirror.last_completed_at=new Date(now+120000).toISOString();assert.equal(api.canonicalSyncSummary().tone,'idle');
});
test('practical race preparation is available without exposing disabled coaching, workouts or target pace',()=>{
 const data=snapshot(),goal={id:'race',name:'Testløp',date:'2026-10-03',distance:'half',targetSeconds:4980,status:'active'};data.config={timezone:'Europe/Oslo',goal:{...goal,mode:'race'}};const before=JSON.stringify(data),input={snapshot:data,goal,now};assert.equal(race.model(input).available,false);const v=race.preparation(input);assert.equal(v.available,true);assert.equal(v.practicalOnly,true);assert.equal(v.target,null);assert.equal(v.todayVisible,false);assert.deepEqual(v.items,[]);assert.equal(JSON.stringify(data),before);assert.equal(race.preparation({...input,goal:{...goal,date:'2026-10-04'}}).available,false);assert.equal(race.preparation({...input,now:now+7*3600000}).available,false);data.activePlan.planRevisionId='old';assert.equal(race.preparation(input).available,false);
});
test('server review distinguishes rest and unverified history from missed workouts',async()=>{
 const {buildWeeklyReview,buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v11/review-engine.js'),{activityHistory}=await import('../cloud/runnerbear-cloud/src/v11/history-status.js');
 const pending=activityHistory({now}),current=activityHistory({sync:{status:'ok',last_synced_at:stamp},now}),plan={planRevisionId:'pr-a',items:[{workoutId:'run',localDate:'2026-09-04',sport:'running',workoutType:'quality',plannedDistanceM:10000},{workoutId:'rest',localDate:'2026-09-05',sport:'rest',workoutType:'rest'}]};
 const review=buildWeeklyReview({plan,today:'2026-09-09',activityHistory:pending});assert.equal(review.totals.missedSessions,0);assert.equal(review.dataQuality,'partial');assert.deepEqual(review.sessions.map(s=>s.state),['pending','rest']);assert.equal(buildWeeklyReview({plan,today:'2026-09-09',activityHistory:current}).totals.missedSessions,1);
 plan.items[0].localDate='2026-09-08';assert.equal(buildRealignmentProposal({plan,today:'2026-09-09',activityHistory:pending}),null);assert.equal(buildRealignmentProposal({plan,today:'2026-09-09',activityHistory:current}).trigger,'missed_workout');
});
function client(fetch){
 const events={},window={RunnerBearV1026:require('../runnerbear-v1026-coach-loop.js'),addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){},RunnerBearCloud:{hydrateState(){}},RunnerBearPlanReadModel:{install(){throw Error('disabled plan reader must not install')}}};
 vm.runInNewContext(fs.readFileSync('runnerbear-cloud-v11.js','utf8'),{window,document:{documentElement:{classList:{remove(){},add(){},toggle(){}}},querySelector:()=>({id:'plan'})},fetch,AbortController,CustomEvent:class{},localStorage:storage(),console:{warn(){},info(){},error(){}},setTimeout:()=>0,clearTimeout(){}});return{api:window.RunnerBearCloudV11,events};
}
test('automatic full history loading runs once per revision with plan reading disabled',async()=>{
 const calls=[],data=snapshot([activity]),{api,events}=client(async path=>{calls.push(path);return{ok:true,json:async()=>data}});await api.start();assert.equal(api.snapshot().recentActivities.length,1);await Promise.all([events['runnerbear:view']({detail:{view:'plan'}}),events['runnerbear:view']({detail:{view:'goals'}})]);await events['runnerbear:view']({detail:{view:'plan'}});assert.deepEqual(calls,['/api/v2/bootstrap?scope=home','/api/v2/bootstrap?scope=full']);
});
test('late home response cannot erase a newer full history snapshot',async()=>{
 const pending=[],{api}=client(()=>new Promise(resolve=>pending.push(data=>resolve({ok:true,json:async()=>data}))));const home=api.refresh('home'),full=api.refresh('full'),data=snapshot([activity]);pending[1](data);await full;pending[0](snapshot());await home;assert.equal(api.snapshot().recentActivities.length,1);
});
