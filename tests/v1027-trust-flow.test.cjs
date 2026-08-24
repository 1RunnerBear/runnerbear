const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=file=>fs.readFileSync(file,'utf8');

test('canonical state authorizes the first trusted plan render',()=>{
  const ui=read('runnerbear-ui-v1027-source.js'),runtime=read('runnerbear-cloud-v1027.js');
  assert.match(ui,/initialRenderAuthorized=false/);
  assert.match(ui,/await waitForCanonicalRuntime\(\)/);
  assert.match(ui,/boot=await canonical\.start\(\)/);
  assert.match(runtime,/runnerbear:canonical-runtime-ready/);
  assert.doesNotMatch(runtime,/setTimeout\(\(\)=>api\('\/api\/v2\/sync\/process/);
  const legacyRuntime=read('runnerbear-cloud-v1025.js');
  assert.match(legacyRuntime,/function canonicalSyncOwner\(\)/);
  assert.match(legacyRuntime,/window\.RunnerBearCloudV1031\|\|window\.RunnerBearCloudV1027/);
  assert.match(legacyRuntime,/if\(!IS_CLOUD\|\|canonicalSyncOwner\(\)\)return/);
});

test('plan commit and sync outbox share one D1 transaction with Worker retries',()=>{
  const routes=read('cloud/runnerbear-cloud/src/v1027/routes.js'),worker=read('cloud/runnerbear-cloud/src/index-v1027.js'),config=read('cloud/runnerbear-cloud/wrangler.jsonc');
  assert.match(routes,/outbox=syncOperationStatements\(env\.DB,userId,syncOperations,now\)/);
  assert.match(routes,/extraStatements:\[\.\.\.compatibility,\.\.\.outbox\]/);
  assert.match(routes,/ctx\?\.waitUntil\)ctx\.waitUntil\(processPendingSync/);
  assert.match(routes,/r\.status='active'/);
  assert.match(worker,/async scheduled\(/);
  assert.match(config,/"\*\/5 \* \* \* \*"/);
});

test('quality bank replaces the detail sheet and returns to it',()=>{
  const ui=read('runnerbear-ui-v1027-source.js'),css=read('runnerbear-v1028-trust-flow.css');
  assert.match(ui,/state\.workoutBankReturnToDetail=state\.workoutDetailOpen/);
  assert.match(ui,/state\.workoutDetailOpen=false;state\.workoutBankOpen=true/);
  assert.match(ui,/function closeWorkoutBank\(\)/);
  assert.match(ui,/state\.workoutDetailOpen=true;state\.workoutDetailDs=changed\.ds/);
  assert.match(css,/\.rb10251-bank-modal,.rb10251-move-modal\{z-index:12010\}/);
});

test('visible success follows canonical persistence and failed changes roll back',()=>{
  const ui=read('runnerbear-ui-v1027-source.js');
  assert.match(ui,/async function persistCanonicalChange/);
  assert.match(ui,/restoreSnapshot\(before\);await window\.RunnerBearCloudV1027\.refresh\('full'\)/);
  assert.match(ui,/await persistCanonicalChange\(before,\{reason:source,trigger:'workout_moved'\}\)/);
  assert.match(ui,/await persistCanonicalChange\(before,\{reason:'quality-bank',trigger:'quality_bank_replacement'\}\)/);
});
