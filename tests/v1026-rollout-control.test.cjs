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
});
