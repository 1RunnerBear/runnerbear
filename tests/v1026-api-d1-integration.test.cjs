const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');

class Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.values=[]}
  bind(...values){const next=new Statement(this.db,this.sql);next.values=values;return next}
  async run(){return this._run()}
  _run(){const result=this.db.sqlite.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes||0)}}}
  async first(){return this.db.sqlite.prepare(this.sql).get(...this.values)||null}
  async all(){return{success:true,results:this.db.sqlite.prepare(this.sql).all(...this.values)}}
}
class LocalD1{
  constructor(){this.sqlite=new DatabaseSync(':memory:')}
  prepare(sql){return new Statement(this,sql)}
  async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const out=statements.map(statement=>statement._run());this.sqlite.exec('COMMIT');return out}catch(error){this.sqlite.exec('ROLLBACK');throw error}}
  close(){this.sqlite.close()}
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>key!=='sourceHash'&&value[key]!==undefined).map(key=>[key,canonical(value[key])])):value;
async function hash(value){const data=new TextEncoder().encode(JSON.stringify(canonical(value))),digest=await crypto.subtle.digest('SHA-256',data);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
const request=(path,{method='GET',body,key='test-key'}={})=>new Request(`https://runnerbear.test${path}`,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});

test('v2 migration, atomic draft commit, replay, CAS and kill switch work against SQLite',async()=>{
  const {handleV1026}=await import('../cloud/runnerbear-cloud/src/v1026/routes.js'),db=new LocalD1();
  db.sqlite.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0001_runnerbear_cloud.sql','utf8'));
  db.sqlite.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0002_coach_loop.sql','utf8'));
  db.sqlite.exec("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-21T00:00:00Z','2026-08-21T00:00:00Z')");
  const env={DB:db,COACH_LOOP_KILL_SWITCH:'false'},bodyJson=req=>req.json(),call=req=>handleV1026(req,env,{userId:'primary',bodyJson,corsHeaders:{}}),today=new Date().toISOString().slice(0,10),day=(new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7,runDays=[...new Set([day,(day+1)%7,(day+2)%7,(day+3)%7,(day+4)%7])].sort(),alternativeDays=[0,1,2,3,4,5,6].filter(value=>!runDays.includes(value)),input={timezone:'Europe/Oslo',profile:{baseKm:35},constraints:{runDays,qualityDays:runDays.slice(0,2),longRunDay:runDays.at(-1),alternativeDays,maxRunDays:5,weeklyKmCap:55},goal:{mode:'base',distance:'half',date:'',name:''},effectivePlan:[{workoutId:'legacy-today',baseDs:today,localDate:today,status:'scheduled',sport:'running',workoutType:'easy',title:'7 km rolig',plannedDistanceM:7000,explicitChoice:true}]};input.sourceHash=await hash(input);
  let response=await call(request('/api/v2/migration/commit',{method:'POST',body:input,key:'migration'}));assert.equal(response.status,200);let migrated=await response.json();assert.ok(migrated.planRevisionId);
  for(const flag of ['coach_loop_shadow','coach_loop_read','coach_loop_ui','coach_loop_write'])db.sqlite.prepare("INSERT INTO rb_feature_flags(user_id,flag,enabled,payload_json,updated_at) VALUES('primary',?,1,'{}','2026-08-21T00:00:00Z')").run(flag);
  response=await call(request('/api/v2/bootstrap?scope=full'));assert.equal(response.status,200);const bootstrap=await response.json();assert.equal(bootstrap.planRevisionId,migrated.planRevisionId);assert.equal(bootstrap.activePlan.items.length,1);
  const changed=bootstrap.activePlan.items.map(row=>({...row,title:'6 km rolig',plannedDistanceM:6000})),previewRequest={expectedPlanRevisionId:bootstrap.planRevisionId,items:changed,reason:'user-change'};
  response=await call(request('/api/v2/plan/preview',{method:'POST',body:previewRequest,key:'preview-a'}));assert.equal(response.status,200);const previewA=await response.json();assert.ok(previewA.previewId);
  response=await call(request('/api/v2/plan/preview',{method:'POST',body:previewRequest,key:'preview-b'}));const previewB=await response.json();assert.ok(previewB.previewId);
  const commitBody={expectedPlanRevisionId:bootstrap.planRevisionId,previewId:previewA.previewId,reason:'user-change'};
  response=await call(request('/api/v2/plan/commit',{method:'POST',body:commitBody,key:'commit-a'}));assert.equal(response.status,200);const committed=await response.json();assert.equal(committed.activePlan.items[0].plannedDistanceM,6000);
  response=await call(request('/api/v2/plan/commit',{method:'POST',body:commitBody,key:'commit-a'}));assert.equal((await response.json()).idempotent,true);
  response=await call(request('/api/v2/plan/commit',{method:'POST',body:{expectedPlanRevisionId:bootstrap.planRevisionId,previewId:previewB.previewId},key:'commit-b'}));assert.equal(response.status,409);
  response=await call(request(`/api/v2/coach/decision/${bootstrap.coachDecision.decisionId}/resolve`,{method:'POST',body:{action:'accept'},key:'stale-decision'}));assert.equal(response.status,409);assert.equal((await response.json()).code,'DECISION_SUPERSEDED');
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_plan_revisions WHERE status='active'").get().n,1);assert.equal(db.sqlite.prepare('SELECT km FROM rb_plan_days WHERE user_id=? AND date=?').get('primary',today).km,6);
  response=await call(request('/api/v2/feedback',{method:'POST',body:{sourceId:'feedback-1',localDate:today,responsePhase:'post_workout',workoutId:'wo-legacy-today',rpe:5},key:'feedback-1'}));const feedbackId=(await response.json()).eventId;response=await call(request('/api/v2/feedback',{method:'POST',body:{sourceId:'feedback-1',localDate:today,responsePhase:'post_workout',workoutId:'wo-legacy-today',rpe:5},key:'feedback-1'}));assert.equal((await response.json()).eventId,feedbackId);
  env.COACH_LOOP_KILL_SWITCH='true';response=await call(request('/api/v2/plan/preview',{method:'POST',body:{expectedPlanRevisionId:committed.planRevisionId},key:'killed'}));assert.equal(response.status,503);assert.equal((await response.json()).code,'COACH_LOOP_DISABLED');response=await call(request('/api/v2/bootstrap?scope=full'));assert.equal(response.status,200);assert.equal((await response.json()).compatibilityFallback,true);
  db.close();
});
