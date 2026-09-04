const test=require('node:test');
const assert=require('node:assert/strict');

test('core activation requires migration, identity, compatibility and twenty shadow bootstraps',async()=>{
  const {evaluateCoreGates}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs');
  const row={migration_status:'committed',active_plan_count:1,active_plan_revision_id:'pr-active',active_item_count:21,compatibility_mismatch_count:0};
  assert.equal(evaluateCoreGates(row,{lastMatch:true,consecutiveSuccesses:19,lastPlanRevisionId:'pr-active'}).ok,false);
  assert.equal(evaluateCoreGates(row,{lastMatch:true,consecutiveSuccesses:20,lastPlanRevisionId:'pr-other'}).ok,false);
  assert.equal(evaluateCoreGates(row,{lastMatch:true,consecutiveSuccesses:20,lastPlanRevisionId:'pr-active'}).ok,true);
});

test('safe auto requires explicit consent, seven full days and seven clean observation dates',async()=>{
  const {canEnableSafeAuto}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs'),input={coreActivatedAt:'2026-08-21T10:00:00.000Z',now:'2026-08-28T10:00:00.000Z',cleanObservationDates:['2026-08-21','2026-08-22','2026-08-23','2026-08-24','2026-08-25','2026-08-26','2026-08-28']};
  assert.equal(canEnableSafeAuto({...input,explicitOptIn:false}).ok,false);
  assert.equal(canEnableSafeAuto({...input,explicitOptIn:true,now:'2026-08-28T09:59:59.999Z'}).ok,false);
  assert.equal(canEnableSafeAuto({...input,explicitOptIn:true}).ok,true);
});

test('a rollout observation blocks on any plan, compatibility or sync integrity error',async()=>{
  const {evaluateObservation}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs'),clean={active_plan_count:1,active_item_count:20,compatibility_mismatch_count:0,duplicate_sync_count:0,terminal_sync_error_count:0,retryable_sync_error_count:0,stale_decision_count:0};
  assert.equal(evaluateObservation(clean).ok,true);
  for(const key of ['compatibility_mismatch_count','duplicate_sync_count','terminal_sync_error_count','retryable_sync_error_count','stale_decision_count'])assert.equal(evaluateObservation({...clean,[key]:1}).ok,false,key);
});

test('rollout sync integrity observes only the active plan revision',async()=>{
  const {observationStateSql}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs'),db=new (require('node:sqlite').DatabaseSync)(':memory:'),fs=require('node:fs');
  db.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0001_runnerbear_cloud.sql','utf8'));
  db.exec(fs.readFileSync('cloud/runnerbear-cloud/migrations/0002_coach_loop.sql','utf8'));
  db.exec("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-09-03T00:00:00Z','2026-09-03T00:00:00Z'); INSERT INTO rb_plan_revisions(plan_revision_id,user_id,status,reason_code,policy_version,created_at,activated_at,superseded_at) VALUES('pr-old','primary','superseded','old','coach-loop-1','2026-09-03T00:00:00Z','2026-09-03T00:00:00Z','2026-09-03T01:00:00Z'),('pr-active','primary','active','current','coach-loop-1','2026-09-03T01:00:00Z','2026-09-03T01:00:00Z',NULL); INSERT INTO rb_workouts(workout_id,user_id,lineage_id,created_at) VALUES('wo-old','primary','old','2026-09-03T00:00:00Z'),('wo-active','primary','active','2026-09-03T01:00:00Z'); INSERT INTO rb_plan_revision_items(plan_revision_id,workout_id,local_date,slot_index,status,sport,workout_type,title,intent,prescription_json,planned_distance_m,planned_load_json,source,lock_level,created_at) VALUES('pr-active','wo-active','2099-09-04',0,'scheduled','running','easy','Rolig tur','easy','{}',5000,'{}','runnerbear','none','2026-09-03T01:00:00Z'); INSERT INTO rb_plan_days(user_id,date,type,title,km,status,payload_json,updated_at) VALUES('primary','2099-09-04','easy','Rolig tur',5,'scheduled','{}','2026-09-03T01:00:00Z'); INSERT INTO rb_sync_operations(operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,idempotency_key,status,last_error,created_at,updated_at) VALUES('old-terminal','primary','wo-old','pr-old','tredict','move','old-terminal','failed_terminal','OLD_ERROR','2026-09-03T02:00:00Z','2026-09-03T02:00:00Z'),('active-confirmed','primary','wo-active','pr-active','tredict','create','active-confirmed','confirmed',NULL,'2026-09-03T02:00:00Z','2026-09-03T02:00:00Z')");
  const row=db.prepare(observationStateSql({userId:'primary',coreActivatedAt:'2026-09-03T01:00:00Z'})).get();
  assert.equal(row.active_plan_count,1);assert.equal(row.terminal_sync_error_count,0);assert.equal(row.retryable_sync_error_count,0);assert.equal(row.duplicate_sync_count,0);db.close();
});

test('rollback levels never leave an invalid dependency combination',async()=>{
  const {rollbackFlags,validateFlagDependencies}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs');
  for(const level of ['safe_auto','sync','write','ui','full'])assert.deepEqual(validateFlagDependencies(rollbackFlags(level),true),[],level);
});

test('cloud deploy verifies rollout flags without spending D1 row writes',()=>{
  const fs=require('node:fs'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8');
  assert.match(workflow,/Verify owner-only rollout flags exist/);
  assert.match(workflow,/SELECT flag,enabled FROM rb_feature_flags/);
  assert.doesNotMatch(workflow,/INSERT INTO rb_feature_flags/);
  assert.match(workflow,/Verify persistent feature flags and dependencies/);
});

test('shadow compares like-for-like full plans and rollout samples one stable production revision',()=>{
  const fs=require('node:fs'),client=fs.readFileSync('runnerbear-cloud-v1026.js','utf8'),rollout=fs.readFileSync('cloud/runnerbear-cloud/scripts/coach-loop-rollout.mjs','utf8');
  assert.match(client,/scope==='full'\?data:await api\('\/api\/v2\/bootstrap\?scope=full'\)/);
  assert.match(rollout,/for\(let sample=1;sample<=20;sample\+\+\)/);
  assert.match(rollout,/sampleSource:'production-atomic-bootstrap'/);
  assert.match(rollout,/active_plan_revision_id===revision/);
  assert.match(rollout,/consecutiveSuccesses:checks\.length/);
  assert.doesNotMatch(rollout,/consecutiveSuccesses:sample/);
});

test('D1 daily row-write exhaustion is deferred without hiding unrelated rollout failures',async()=>{
  const {isD1DailyWriteLimitError}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs');
  assert.equal(isD1DailyWriteLimitError({stdout:`{"error":{"notes":[{"text":"Your account has exceeded D1's free tier daily row write limit. [code: 7500]"}],"code":7500}}`}),true);
  assert.equal(isD1DailyWriteLimitError({message:'A request failed',output:[null,'{"error":{"code":7500}}',null]}),true);
  assert.equal(isD1DailyWriteLimitError(new Error('D1 syntax error')),false);
  const fs=require('node:fs'),rollout=fs.readFileSync('cloud/runnerbear-cloud/scripts/coach-loop-rollout.mjs','utf8');
  assert.match(rollout,/status:'deferred'.*reason:'d1_daily_write_limit'.*retry:'next-scheduled-run'.*productionMutation:'none'/);
  assert.match(rollout,/if\(!isD1DailyWriteLimitError\(error\)\)throw error/);
  assert.match(rollout,/if\(gate\.deferred\)/);
  assert.match(rollout,/if\(!evaluation\.ok\|\|!isD1DailyWriteLimitError\(error\)\)throw error/);
  assert.match(rollout,/phase:'observation'.*reason:'d1_daily_write_limit'.*productionMutation:'none'/);
  assert.match(rollout,/const RELEASE=JSON\.parse\(readFileSync\(new URL\('\.\.\/package\.json',import\.meta\.url\),'utf8'\)\)\.version/);
  assert.doesNotMatch(rollout,/const RELEASE='10\.26\.0'/);
});
