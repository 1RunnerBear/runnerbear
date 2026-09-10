const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const day=require('../runnerbear-v123-running-day.js'),trust=require('../runnerbear-v1222-data-trust.js');
const now=Date.parse('2026-09-09T10:00:00Z'),stamp=new Date(now).toISOString();
const decision=()=>({version:'one-decision-2',planRevisionId:'pr-a',generatedAt:stamp,validUntil:'2026-09-09T10:15:00Z',freshness:'current',state:'follow',headline:'Planen står',summary:'Planen støttes',safety:{planWritesByAi:false},primaryAction:{kind:'open_workout',label:'Åpne økt'}});
const workout={ds:'2026-09-09',type:'quality',title:'6 × 6 min terskel',km:12,week:1,label:'test'};
const activity={source:'tredict',source_id:'run-9',date:workout.ds,sport_type:'running',title:workout.title,distance_m:12000,duration_seconds:3600,pace_seconds_per_km:300,avg_hr:155,payload:{id:'run-9'}};
const snapshot=(done=false)=>({ok:true,responseCapture:true,generatedAt:stamp,flags:{coach_loop_read:false,coach_loop_ui:false,coach_loop_write:false,coach_loop_sync:false,coach_loop_safe_auto:false},planRevisionId:'pr-a',activePlan:{planRevisionId:'pr-a',status:'active',items:[{workoutId:'wo-2026-09-09',localDate:workout.ds}]},oneDecision:decision(),recentActivities:done?[activity]:[],responseEvents:[],activityHistory:{version:'activity-history-1',state:'current',syncedAt:stamp,truncated:false}});
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
function ui(data,plan=workout){
 const localStorage=storage(),window={RunnerBearRunningDay:{...day,fresh:d=>day.fresh(d,now),presentation:input=>day.presentation({...input,now})},RunnerBearCalmFlow:require('../runnerbear-v121-calm-flow.js'),RunnerBearDataTrust:trust,RunnerBearCloudV11:{snapshot:()=>data},RunnerBearCoachEngine:{schedule:()=>[plan]},addEventListener(){},dispatchEvent(){}},document={readyState:'loading',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
 const source=fs.readFileSync('runnerbear-ui-v11-source.js','utf8').replace("  if(document.readyState==='loading')",'  window.audit={completedDetailHtml,completedRows,todayHtml,oneDecisionHeroHtml,responseContext,coachFeedbackHtml,workoutDetailModalHtml,responseEdits,responseErrors,responseDrafts,state,persistDayChoice};\n  if(document.readyState===\'loading\')');
 vm.runInNewContext(source,{window,document,localStorage,sessionStorage:storage(),Date:Clock,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},CustomEvent:class{},console});
 return{api:window.audit,os:window.RunnerBearCoachOS,localStorage,window};
}
test('daily presentation gives a current workout priority and never covers a safety clarification with a result',()=>{
 const d=decision();assert.equal(day.presentation({decision:d,workout,now}).headline,workout.title);assert.equal(day.presentation({decision:d,workout,now,body:{state:'watch',reasonCodes:['LOW_HRV']}}).mode,'workout');assert.equal(day.presentation({decision:d,workout,result:true,now}).mode,'result');
 for(const extra of [{reported:{reasons:['achilles']}},{body:{state:'recover',reasonCodes:['ILLNESS']}}]){const v=day.presentation({decision:d,workout,result:true,now,...extra});assert.equal(v.mode,'attention');assert.equal(v.action,'complete_checkin')}
 d.state='adjust';d.primaryAction={kind:'review_adjustment'};d.validUntil=stamp;assert.equal(day.presentation({decision:d,workout,now}).action,'view_plan');
});
test('questions are contextual, capped at two and never infer pain from effort',()=>{
 assert.deepEqual(day.questions({type:'easy'}),[]);assert.equal(day.questions({type:'quality',confidence:'high'}).length,1);assert.equal(day.questions({type:'quality',pain:true}).length,2);assert.deepEqual(day.questions({type:'quality',phase:'next_morning'}),[]);assert.deepEqual(day.questions({pain:true,phase:'next_morning'}).map(q=>q.key),['pain']);
});
test('actual Today renders the workout, one primary action and a direct adaptation entry',()=>{
 const {api,os}=ui(snapshot()),html=api.oneDecisionHeroHtml(os.planFor(workout.ds));assert.match(html,/<h2[^>]*>6 × 6 min terskel<\/h2>/);assert.equal((html.match(/class="rb113-primary"/g)||[]).length,1);assert.match(html,/Se gjennomføringen/);assert.match(html,/data-rb123-adapt/);assert.doesNotMatch(html,/Planen står/);
});
test('completed Today shows one measured result and an unanswered response with production flags disabled',()=>{
 const data=snapshot(true),{api,os}=ui(data),p=os.planFor(workout.ds),c=api.responseContext(p);assert.ok(c);assert.equal(c.workout.workoutId,'wo-2026-09-09');
 const html=api.todayHtml();assert.equal((html.match(/data-rb123-response="/g)||[]).length,1);assert.match(html,/Økten er lagret i historikken din/);assert.doesNotMatch(html,/data-rb123-adapt|id="rb113DecisionTitle"/);assert.match(html,/12[,.]0|12 km/);assert.doesNotMatch(api.coachFeedbackHtml(p),/ checked/);
 const history=api.completedDetailHtml(api.completedRows()[0]);assert.equal((history.match(/data-rb123-response="/g)||[]).length,1);assert.ok(history.indexOf('data-rb123-response=')<history.indexOf('Planlagt mot utført'));const detail=api.workoutDetailModalHtml(p);assert.ok(detail.indexOf('data-rb123-response=')<detail.indexOf('Se den planlagte økten'));
});
test('saved response can be edited and keeps explicit draft values and errors',()=>{
 const data=snapshot(true),{api,os}=ui(data),p=os.planFor(workout.ds),c=api.responseContext(p);data.responseEvents=[{event_type:'feedback:workout',occurred_at:stamp,payload:{workoutId:c.workout.workoutId,activityId:'run-9',sourceId:'response-1',control:'controlled'}}];
 assert.match(api.coachFeedbackHtml(p),/Svaret er lagret/);assert.match(api.coachFeedbackHtml(p),/Endre svaret/);assert.doesNotMatch(api.coachFeedbackHtml(p),/Tatt med i coachens siste vurdering/);
 api.responseEdits.add(c.key);api.responseDrafts.set(c.key,{values:{control:'borderline',rpe:8}});api.responseErrors.set(c.key,'Lagring mislyktes');const html=api.coachFeedbackHtml(p);assert.match(html,/value="borderline" checked/);assert.match(html,/value="8" checked/);assert.match(html,/Lagring mislyktes/);
});
test('ambiguous or absent canonical activity cannot offer an input form',()=>{
 for(const items of [[],[{workoutId:'a',localDate:workout.ds},{workoutId:'b',localDate:workout.ds}]]){const data=snapshot(true);data.activePlan.items=items;const {api,os}=ui(data);assert.equal(api.coachFeedbackHtml(os.planFor(workout.ds)),'');}
});
function client(fetch){
 const window={RunnerBearV1026:require('../runnerbear-v1026-coach-loop.js'),addEventListener(){},dispatchEvent(){}},timers=new Map();let n=0;
 vm.runInNewContext(fs.readFileSync('runnerbear-cloud-v11.js','utf8'),{window,document:{documentElement:{classList:{remove(){},add(){},toggle(){}}},querySelector:()=>null},fetch,AbortController,CustomEvent:class{},localStorage:storage(),console:{warn(){},info(){},error(){}},setTimeout:(fn,ms)=>{timers.set(++n,{fn,ms});return n},clearTimeout:id=>timers.delete(id)});return{api:window.RunnerBearCloudV11,timers};
}
test('a confirmed response survives a failed refresh without invoking plan updates',async()=>{
 const requests=[],data=snapshot(true),{api,timers}=client(async(path,opts)=>{requests.push({path,method:opts.method||'GET',key:opts.headers['Idempotency-Key']});if(requests.length===1)return{ok:true,json:async()=>data};if(opts.method==='POST')return{ok:true,json:async()=>({ok:true,eventId:'event-1',savedAt:stamp,planChanged:false})};throw Error('offline')});
 await api.start();const input={control:'controlled',workoutId:'wo-2026-09-09',activityId:'run-9',responsePhase:'post_workout'};assert.equal((await api.submitWorkoutResponse(input,'stable-retry-key')).planChanged,false);assert.equal(api.snapshot().responseEvents[0].event_id,'event-1');assert.deepEqual(requests.map(r=>r.path),['/api/v2/bootstrap?scope=home','/api/v2/workout-responses','/api/v2/bootstrap?scope=home']);assert.equal(requests[1].key,'stable-retry-key');assert.equal([...timers.values()].filter(t=>t.ms===15000).length,0,'request timeout must be released');
});
test('an unsuccessful or unconfirmed save cannot create a success receipt',async()=>{
 for(const response of [{ok:false,json:async()=>({message:'Lagring feilet'})},{ok:true,json:async()=>({ok:true})}]){const data=snapshot(true),{api}=client(async(path,opts)=>opts.method==='POST'?response:{ok:true,json:async()=>data});await api.start();await assert.rejects(api.submitWorkoutResponse({control:'controlled'},'response-key'));assert.equal(api.snapshot().responseEvents.length,0)}
});

test('day adaptation rolls back when storage fails or cannot confirm the write',async()=>{
 for(const upload of [async()=>{throw Error('storage unavailable')},async()=>undefined]){const {api,window,localStorage}=ui(snapshot()),key='runfest26_week_adjustments',value='{"original":true}';localStorage.setItem(key,'{"edited":true}');window.RunnerBearCloud={uploadLocal:upload};await assert.rejects(api.persistDayChoice({key,had:true,value},'test'));assert.equal(localStorage.getItem(key),value)}
});
