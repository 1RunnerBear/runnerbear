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
const request=(path,{method='GET',body,key='v1027-test'}={})=>new Request(`https://runnerbear.test${path}`,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});
const addDays=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const monday=date=>addDays(date,-((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7));

test('v10.27 API reflows preferences atomically while preserving plan, activity, feedback and matching history',async()=>{
  const [{handleV1027},{generateGoalPlan}]=await Promise.all([import('../cloud/runnerbear-cloud/src/v1027/routes.js'),import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js')]),db=new LocalD1();
  db.sqlite.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0001_runnerbear_cloud.sql','utf8'));
  db.sqlite.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0002_coach_loop.sql','utf8'));
  db.sqlite.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0004_trust_flow.sql','utf8'));
  db.sqlite.exec("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-21T00:00:00Z','2026-08-21T00:00:00Z')");
  db.sqlite.prepare("INSERT INTO rb_state(user_id,namespace,payload_json,updated_at) VALUES('primary','localStorage',?,?)").run(JSON.stringify({runnerbear_match_history:'bevart'}),new Date().toISOString());
  const pending=[],env={DB:db,COACH_LOOP_KILL_SWITCH:'false',TREDICT:{reconcileCanonical:async input=>({ok:true,status:'confirmed',tredictWorkoutId:input.externalId})}},ctx={waitUntil(promise){pending.push(promise)}},bodyJson=req=>req.json(),call=req=>handleV1027(req,env,{userId:'primary',bodyJson,corsHeaders:{},ctx}),today=new Date().toISOString().slice(0,10),start=addDays(monday(today),7),historicalDate=addDays(today,-3),config={timezone:'Europe/Oslo',profile:{baseKm:50,normalLow:50,normalHigh:55,upperLimit:55,targetWeeklyVolume:50},constraints:{runDays:[0,1,2,3,5,6],qualityDays:[1,3],longRunDay:6,alternativeDays:[4],maxRunDays:6,weeklyKmCap:55},goal:{mode:'base',distance:'half',date:'',name:''}},generated=generateGoalPlan(config,start),history={workoutId:'wo-history-v1027',lineageId:'history-v1027',localDate:historicalDate,slotIndex:0,status:'completed',sport:'running',workoutType:'quality',title:'Historisk kvalitetsøkt',intent:'threshold',prescription:{version:1,legacy:{coachComment:'Sterk kontroll'}},plannedDistanceM:10000,plannedLoad:{historic:true},source:'runnerbear-history',lockLevel:'system'},input={...config,effectivePlan:[history,...generated.rows]};input.sourceHash=await hash(input);
  let response=await call(request('/api/v2/migration/commit',{method:'POST',body:input,key:'migration-v1027'}));assert.equal(response.status,200);const migrated=await response.json();assert.ok(migrated.planRevisionId);
  for(const flag of ['coach_loop_shadow','coach_loop_read','coach_loop_ui','coach_loop_write','coach_loop_sync'])db.sqlite.prepare("INSERT INTO rb_feature_flags(user_id,flag,enabled,payload_json,updated_at) VALUES('primary',?,1,'{}',?)").run(flag,new Date().toISOString());
  const payload=JSON.stringify({id:'garmin-history-1',date:historicalDate,sportType:'running',title:'Garmin historikk',summary:{distance:10200,duration:3000,heartrate:151}});
  db.sqlite.prepare("INSERT INTO rb_activities(user_id,source,source_id,date,sport_type,title,duration_seconds,distance_m,avg_hr,payload_json,updated_at) VALUES('primary','tredict','garmin-history-1',?,'running','Garmin historikk',3000,10200,151,?,?) ON CONFLICT(user_id,source,source_id) DO UPDATE SET payload_json=excluded.payload_json").run(historicalDate,payload,new Date().toISOString());
  response=await call(request('/api/v2/feedback',{method:'POST',body:{sourceId:'historic-feedback',localDate:historicalDate,responseDate:addDays(historicalDate,1),responsePhase:'next_morning',workoutId:history.workoutId,rpe:6,control:'controlled'},key:'historic-feedback'}));assert.equal(response.status,200);
  response=await call(request('/api/v2/bootstrap?scope=full'));assert.equal(response.status,200);const before=await response.json(),historicalBefore=before.activePlan.items.find(row=>row.workoutId===history.workoutId);assert.equal(historicalBefore.title,'Historisk kvalitetsøkt');assert.ok(before.recentActivities.some(row=>row.source_id==='garmin-history-1'));assert.ok(before.responseEvents.some(row=>row.payload?.sourceId==='historic-feedback'||row.event_type==='feedback:workout'));
  const nextConfig={...config,constraints:{...config.constraints,qualityDays:[2,5]}},tampered=before.activePlan.items.map(row=>row.workoutId===history.workoutId?{...row,title:'SKAL IKKE LAGRES'}:row),previewBody={expectedPlanRevisionId:before.planRevisionId,items:tampered,config:nextConfig,fromDate:today,reason:'training-preferences',trigger:'training_preferences_changed'};
  response=await call(request('/api/v2/plan/preview',{method:'POST',body:previewBody,key:'preference-preview'}));assert.equal(response.status,200);const preview=await response.json();assert.ok(preview.previewId);assert.equal(preview.rows.find(row=>row.workoutId===history.workoutId).title,'Historisk kvalitetsøkt');
  const firstFullWeek=preview.rows.filter(row=>row.localDate>=start&&row.localDate<=addDays(start,6)),firstWeekKm=firstFullWeek.filter(row=>row.sport==='running').reduce((sum,row)=>sum+Number(row.plannedDistanceM||0)/1000,0);assert.deepEqual(firstFullWeek.filter(row=>row.workoutType==='quality').map(row=>row.localDate),[addDays(start,2),addDays(start,5)]);assert.ok(firstWeekKm>=50&&firstWeekKm<=55);assert.equal(firstWeekKm,firstFullWeek.find(row=>row.plannedLoad?.integrity)?.plannedLoad.integrity.targetWeeklyVolume);
  response=await call(request('/api/v2/plan/commit',{method:'POST',body:{expectedPlanRevisionId:before.planRevisionId,previewId:preview.previewId,reason:'training-preferences'},key:'preference-commit'}));assert.equal(response.status,200);const committed=await response.json();assert.equal(committed.activePlan.reasonCode,'training-preferences');assert.equal(committed.activePlan.items.find(row=>row.workoutId===history.workoutId).title,historicalBefore.title);
  assert.ok(committed.syncQueued>0);assert.ok(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_sync_operations WHERE plan_revision_id=? AND status IN ('queued','processing','confirmed','review_required')").get(committed.planRevisionId).n>0);await Promise.all(pending.splice(0));const syncCounts=db.sqlite.prepare("SELECT status,COUNT(*) AS n FROM rb_sync_operations WHERE plan_revision_id=? GROUP BY status").all(committed.planRevisionId);assert.equal(syncCounts.reduce((sum,row)=>sum+row.n,0),committed.syncQueued);assert.ok(syncCounts.some(row=>row.status==='confirmed'&&row.n>0));
  response=await call(request('/api/v2/plan/commit',{method:'POST',body:{expectedPlanRevisionId:before.planRevisionId,previewId:preview.previewId,reason:'training-preferences'},key:'preference-commit'}));assert.equal((await response.json()).idempotent,true);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_activities WHERE user_id='primary' AND source='tredict' AND source_id='garmin-history-1'").get().n,1);assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_training_events WHERE user_id='primary' AND event_type='feedback:workout'").get().n,1);assert.equal(db.sqlite.prepare("SELECT json_extract(payload_json,'$.runnerbear_match_history') AS value FROM rb_state WHERE user_id='primary' AND namespace='localStorage'").get().value,'bevart');assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM (SELECT source,source_id FROM rb_activities GROUP BY user_id,source,source_id HAVING COUNT(*)>1)").get().n,0);
  db.close();
});
