const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const {timingSafeEqual}=require('node:crypto');
// Cloudflare exposes this primitive; Node's WebCrypto does not.
crypto.subtle.timingSafeEqual ||= timingSafeEqual;
const quota="D1_ERROR: Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.";
class Statement{
  constructor(db,sql,values=[]){Object.assign(this,{db,sql,values})}
  bind(...values){return new Statement(this.db,this.sql,values)}
  async run(){return this._run()}
  _run(){this.db.writes.push(this.sql);if(this.db.writeError)throw new Error(this.db.writeError);const r=this.db.sqlite.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(r.changes)}}}
  async first(){if(this.db.readError)throw new Error(this.db.readError);return this.db.sqlite.prepare(this.sql).get(...this.values)||null}
  async all(){if(this.db.readError)throw new Error(this.db.readError);return{results:this.db.sqlite.prepare(this.sql).all(...this.values)}}
}
class D1{
  constructor(){this.sqlite=new DatabaseSync(':memory:');this.writes=[];for(const file of fs.readdirSync('cloud/runnerbear-cloud/migrations').sort())this.sqlite.exec(fs.readFileSync(`cloud/runnerbear-cloud/migrations/${file}`,'utf8'))}
  prepare(sql){return new Statement(this,sql)}
  async batch(statements){this.sqlite.exec('BEGIN');try{const result=statements.map(s=>s._run());this.sqlite.exec('COMMIT');return result}catch(error){this.sqlite.exec('ROLLBACK');throw error}}
  changes(){return this.sqlite.prepare('SELECT total_changes() AS n').get().n}
}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>k!=='sourceHash'&&v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
const request=(path,options={})=>new Request('https://runnerbear.test'+path,{...options,headers:{'X-RunnerBear-Key':'synthetic-test-key','Idempotency-Key':'synthetic-key','Content-Type':'application/json',...options.headers}});
async function fixture(t){
  const db=new D1();t.after(()=>db.sqlite.close());
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date()),stamp=new Date().toISOString();
  db.sqlite.prepare("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary',?1,?1)").run(stamp);
  const input={timezone:'Europe/Oslo',profile:{baseKm:35},constraints:{runDays:[0,1,3,5,6],qualityDays:[1,3],longRunDay:6,alternativeDays:[2,4],maxRunDays:5,weeklyKmCap:55},goal:{mode:'base',distance:'half',date:'',name:''},effectivePlan:[{workoutId:'quota-today',localDate:today,status:'scheduled',sport:'running',workoutType:'easy',title:'7 km rolig',plannedDistanceM:7000,explicitChoice:true}]};
  input.sourceHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(input))))).toString('hex');
  const env={DB:db,COACH_LOOP_KILL_SWITCH:'false',RUNNERBEAR_API_KEY:'synthetic-test-key'},[{handleV1027},{default:worker}]=await Promise.all([import('../cloud/runnerbear-cloud/src/v11/routes.js'),import('../cloud/runnerbear-cloud/src/index-v11-base.js')]);
  const migration=await handleV1027(request('/api/v2/migration/commit',{method:'POST',body:JSON.stringify(input)}),env,{userId:'primary',bodyJson:r=>r.json()});assert.equal(migration.status,200);
  const revision=(await migration.json()).planRevisionId;
  for(const flag of ['coach_loop_shadow','coach_loop_read','coach_loop_ui','coach_loop_write','coach_loop_safe_auto','coach_loop_sync'])db.sqlite.prepare("INSERT INTO rb_feature_flags(user_id,flag,enabled,payload_json,updated_at) VALUES('primary',?,1,'{}',?)").run(flag,stamp);
  const pending=[],call=req=>worker.fetch(req,env,{waitUntil:p=>pending.push(p)});
  return{db,env,today,revision,call,pending};
}

test('real authenticated bootstrap survives D1 write quota and recovers without plan changes',async t=>{
  const {db,env,revision,call,pending}=await fixture(t),{bootstrapV2}=await import('../cloud/runnerbear-cloud/src/v11/read-model.js'),{buildOneDecisionV2}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js');
  const before=db.sqlite.prepare('SELECT * FROM rb_plan_revision_items ORDER BY local_date').all();
  db.writeError=quota;db.writes=[];
  const projection=await bootstrapV2(env,'primary','full');assert.equal(projection.planRevisionId,revision);assert.equal(db.writes.length,0,'read model must never write snapshots');
  for(const scope of ['home','full']){
    const response=await call(request('/api/v2/bootstrap?scope='+scope)),body=await response.json();
    assert.equal(response.status,200);assert.equal(body.storage.code,'STORAGE_WRITE_LIMIT');assert.equal(body.planRevisionId,revision);assert.equal(body.todayWorkout.title,'7 km rolig');assert.equal(body.coachDecision,null);
    const decision=buildOneDecisionV2(body);assert.equal(decision.proposal,null);assert.equal(decision.freshness,'unavailable');
  }
  assert.equal(pending.length,0,'quota response must not trigger sync writes');
  db.writes=[];assert.equal((await call(request('/api/v2/health/detail'))).status,200);assert.equal(db.writes.length,0);
  assert.equal((await (await call(request('/api/v2/coach/decision'))).json()).coachDecision,null);
  db.writeError=null;const recovered=await (await call(request('/api/v2/bootstrap'))).json();assert.equal(recovered.storage,undefined);assert.ok(recovered.coachDecision.decisionId);
  db.writes=[];await call(request('/api/v2/bootstrap'));assert.equal(db.writes.length,0,'unchanged bootstrap must not rewrite health or coach decisions');
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM rb_plan_revision_items ORDER BY local_date').all(),before);
});

test('quota writes fail truthfully; other database and auth failures never degrade to success',async t=>{
  const {db,call}=await fixture(t);db.writeError=quota;
  const response=await call(request('/api/v2/feedback',{method:'POST',body:JSON.stringify({rpe:4})}));assert.equal(response.status,503);assert.equal((await response.json()).code,'STORAGE_WRITE_LIMIT');
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_training_events WHERE event_type='feedback:workout'").get().n,0);
  db.writeError='D1_ERROR: no such table: rb_coach_decisions';assert.equal((await call(request('/api/v2/bootstrap'))).status,500);
  db.readError='D1_ERROR: daily row read limit';assert.equal((await call(request('/api/v2/bootstrap'))).status,500);
  assert.equal((await call(request('/api/v2/bootstrap',{headers:{'X-RunnerBear-Key':''}}))).status,401);
});

test('automatic sync leaves unchanged activity, capacity and health history untouched',async t=>{
  const {db,env,today}=await fixture(t),{syncTredict}=await import('../cloud/runnerbear-cloud/src/index-v11-legacy.js');
  const data={ok:true,syncedAt:new Date().toISOString(),activities:[{id:'synthetic-run',date:today,sportType:'running',title:'Testøkt',summary:{duration:1800,distance:6000}}],capacity:{running:[{timestamp:today,vo2max:50}]},hrv:{[today]:[60,60]},sleep:{[today]:[27000,27000]},body:[{timestamp:today,hrRestDynamic:50}]};
  env.TREDICT={snapshot:async()=>data};await syncTredict(env,{force:true});
  const before=db.changes();await syncTredict(env,{force:true});assert.equal(db.changes()-before,2,'only sync receipt and cache may change');
  data.hrv[today]=[61,60];data.activities[0].summary.distance=6100;await syncTredict(env,{force:true});
  assert.equal(db.sqlite.prepare("SELECT value FROM rb_health_observations WHERE metric='hrv'").get().value,61);assert.equal(db.sqlite.prepare('SELECT distance_m FROM rb_activities').get().distance_m,6100);
  data.hrv[today]=[null,60];await syncTredict(env,{force:true});assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_health_observations WHERE metric='hrv'").get().n,0);assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_health_observations").get().n,2);
});

function client(fetch,autopilot=false){
  const storage=new Map(),timers=new Map();let timerId=0;
  if(autopilot)storage.set('runnerbear_v107_coach_control','autopilot');
  const window={RunnerBearV1026:require('../runnerbear-v1026-coach-loop.js'),addEventListener(){},dispatchEvent(){}},document={documentElement:{classList:{add(){},remove(){},toggle(){}}},querySelector:()=>null};
  vm.runInNewContext(fs.readFileSync('runnerbear-cloud-v11.js','utf8'),{window,document,fetch,AbortController,CustomEvent:class{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console:{warn(){},error(){},info(){}},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimeout:id=>timers.delete(id)});
  return{api:window.RunnerBearCloudV11,timers};
}
test('stalled bootstrap is aborted and releases its timer',async()=>{
  const {api,timers}=client((path,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))));
  const pending=api.start(),rejected=assert.rejects(pending,/aborted/);assert.equal([...timers.values()][0].ms,15000);[...timers.values()][0].fn();await rejected;assert.equal(timers.size,0);
});
test('storage-limited first paint does not launch autopilot or realignment writes',async()=>{
  const requests=[],data={ok:true,flags:{coach_loop_read:true,coach_loop_ui:true,coach_loop_sync:true,coach_loop_safe_auto:true},storage:{writeAvailable:false},planRevisionId:'pr-synthetic',activePlan:{planRevisionId:'pr-synthetic',status:'active',items:[]},realignmentProposal:{status:'proposed',autoEligible:true,proposalId:'synthetic'}};
  const {api,timers}=client(async(path,opts)=>{requests.push({path,method:opts.method||'GET'});return{ok:true,json:async()=>data}},true);const loaded=await api.start();assert.equal(loaded.planRevisionId,'pr-synthetic');for(const timer of timers.values())await timer.fn();assert.deepEqual(requests,[{path:'/api/v2/bootstrap?scope=home',method:'GET'}]);
});
test('first paint completes before an automatic plan update can stall',async()=>{
  const requests=[],data={ok:true,flags:{coach_loop_read:true,coach_loop_ui:true,coach_loop_sync:true,coach_loop_safe_auto:true},planRevisionId:'pr-synthetic',activePlan:{planRevisionId:'pr-synthetic',status:'active',items:[]},realignmentProposal:{status:'proposed',autoEligible:true,proposalId:'synthetic'}};
  const {api,timers}=client(async(path,opts)=>{requests.push(path);return opts.method==='POST'?new Promise(()=>{}):{ok:true,json:async()=>data}},true);
  const loaded=await api.start();assert.equal(loaded.planRevisionId,'pr-synthetic');assert.equal(requests.length,1);
  for(const timer of timers.values())timer.fn();await Promise.resolve();await Promise.resolve();assert.equal(requests.at(-1),'/api/v2/coach/realign/apply');
});

test('v12.2.2 real bootstrap exposes activity history and calendar receipts with production rollout flags disabled',async t=>{
  const {db,env,today,revision}=await fixture(t),{syncTredict}=await import('../cloud/runnerbear-cloud/src/index-v11-legacy.js'),{bootstrapV2}=await import('../cloud/runnerbear-cloud/src/v11/read-model.js');
  db.sqlite.exec("UPDATE rb_feature_flags SET enabled=0 WHERE flag!='coach_loop_shadow'");
  const stamp=new Date().toISOString(),activities=Array.from({length:100},(_,i)=>({id:`history-${i}`,date:new Date(Date.parse(today+'T12:00:00Z')-i*86400000).toISOString().slice(0,10),sportType:'running',title:'Synthetic historical run',summary:{distance:6000,duration:1800,pace:300,heartrate:150,heartrateMax:174}}));
  env.TREDICT={snapshot:async()=>({ok:true,syncedAt:stamp,activities})};await syncTredict(env,{force:true});
  db.sqlite.prepare("INSERT INTO rb_reconciliation_state(user_id,provider,canonical_plan_id,active_plan_revision_id,window_start,window_end,last_completed_at,last_result) VALUES('primary','tredict','rb-plan-primary',?,?,?,?,'confirmed')").run(revision,today,today,stamp);
  const before=db.sqlite.prepare('SELECT * FROM rb_activities ORDER BY source_id').all(),planBefore=db.sqlite.prepare('SELECT * FROM rb_plan_revision_items ORDER BY local_date').all();db.writes=[];
  const home=await bootstrapV2(env,'primary','home'),full=await bootstrapV2(env,'primary','full');
  assert.equal(home.recentActivities.length,90);assert.equal(home.activityHistory.truncated,true);assert.equal(full.recentActivities.length,100);assert.equal(full.activityHistory.truncated,false);assert.equal(full.activityHistory.state,'current');assert.equal(full.recentActivities[0].pace_seconds_per_km,300);assert.equal(full.recentActivities[0].max_hr,174);assert.equal(full.calendarMirror.active_plan_revision_id,revision);assert.equal(full.calendarMirror.last_result,'confirmed');
  for(const flag of ['coach_loop_read','coach_loop_ui','coach_loop_write','coach_loop_sync','coach_loop_safe_auto'])assert.equal(full.flags[flag],false);
  assert.equal(db.writes.length,0);assert.deepEqual(db.sqlite.prepare('SELECT * FROM rb_activities ORDER BY source_id').all(),before);assert.deepEqual(db.sqlite.prepare('SELECT * FROM rb_plan_revision_items ORDER BY local_date').all(),planBefore);
  db.sqlite.exec("UPDATE rb_sync_sources SET status='error'");assert.equal((await bootstrapV2(env,'primary','full')).activityHistory.state,'pending');
});
