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

test('rollback levels never leave an invalid dependency combination',async()=>{
  const {rollbackFlags,validateFlagDependencies}=await import('../cloud/runnerbear-cloud/scripts/coach-loop-rollout-lib.mjs');
  for(const level of ['safe_auto','sync','write','ui','full'])assert.deepEqual(validateFlagDependencies(rollbackFlags(level),true),[],level);
});

test('cloud deploy initializes missing flags without overwriting activated rollout state',()=>{
  const fs=require('node:fs'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8');
  assert.match(workflow,/ON CONFLICT\(user_id,flag\) DO NOTHING/);
  assert.doesNotMatch(workflow,/ON CONFLICT\(user_id,flag\) DO UPDATE SET enabled=excluded\.enabled/);
  assert.match(workflow,/Verify persistent feature flags and dependencies/);
});
