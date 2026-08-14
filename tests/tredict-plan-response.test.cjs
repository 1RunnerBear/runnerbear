const test=require('node:test');
const assert=require('node:assert/strict');

test('extracts documented and defensive Tredict plan response shapes',async()=>{
  const {extractTredictPlanId}=await import('../cloudflare/tredict-plan-response.mjs');
  assert.equal(extractTredictPlanId({planId:'ABC1234567'}),'ABC1234567');
  assert.equal(extractTredictPlanId({data:{planId:'DATA12345'}}),'DATA12345');
  assert.equal(extractTredictPlanId({success:[{id:'NESTED123'}]}),'NESTED123');
  assert.equal(extractTredictPlanId('DIRECT123'),'DIRECT123');
  assert.equal(extractTredictPlanId({structuredContent:{planId:'MCPSTRUCT123'}}),'MCPSTRUCT123');
  assert.equal(extractTredictPlanId({content:[{type:'text',text:'{"planId":"MCPTEXT123"}'}]}),'MCPTEXT123');
  assert.equal(extractTredictPlanId({content:[{type:'text',text:'Created planId: MCPHUMAN123'}]}),'MCPHUMAN123');
  assert.equal(extractTredictPlanId({success:true}),'');
  assert.equal(extractTredictPlanId({error:'INVALID_PLAN'}),'');
});

test('describes MCP text errors without hiding the provider detail',async()=>{
  const {describeTredictPlanResponse}=await import('../cloudflare/tredict-plan-response.mjs');
  assert.match(describeTredictPlanResponse({content:[{type:'text',text:'llmDescription is required'}],isError:true}),/llmDescription is required/);
});

test('summarizes rejected responses without serializing arbitrary bodies',async()=>{
  const {describeTredictPlanResponse}=await import('../cloudflare/tredict-plan-response.mjs');
  assert.match(describeTredictPlanResponse({error:'INVALID_PLAN',meta:{field:'steps'}}),/INVALID_PLAN/);
  assert.match(describeTredictPlanResponse({success:true}),/success=true/);
});

test('creates one atomic and idempotent plan request with all trainings',async()=>{
  const {splitTredictPlanPayload}=await import('../cloudflare/tredict-plan-response.mjs');
  const payload={plan:{title:'RunnerBear plan'},planTrainings:[{day:1,structuredWorkout:{title:'Easy'}},{day:3,structuredWorkout:{title:'Quality'}}]};
  const split=splitTredictPlanPayload(payload);
  assert.deepEqual(split.create,payload);
  assert.deepEqual(split.additions,[]);
});

test('retries transient plan-training propagation failures only',async()=>{
  const {tredictPlanTrainingRetryDelay}=await import('../cloudflare/tredict-plan-response.mjs');
  assert.equal(tredictPlanTrainingRetryDelay({status:400},0),800);
  assert.equal(tredictPlanTrainingRetryDelay({status:404},1),1800);
  assert.equal(tredictPlanTrainingRetryDelay({status:429},2),3600);
  assert.equal(tredictPlanTrainingRetryDelay({status:400},3),0);
  assert.equal(tredictPlanTrainingRetryDelay({status:500},0),0);
});
