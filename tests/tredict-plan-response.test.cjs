const test=require('node:test');
const assert=require('node:assert/strict');

test('extracts documented and defensive Tredict plan response shapes',async()=>{
  const {extractTredictPlanId}=await import('../cloudflare/tredict-plan-response.mjs');
  assert.equal(extractTredictPlanId({planId:'ABC1234567'}),'ABC1234567');
  assert.equal(extractTredictPlanId({data:{planId:'DATA12345'}}),'DATA12345');
  assert.equal(extractTredictPlanId({success:[{id:'NESTED123'}]}),'NESTED123');
  assert.equal(extractTredictPlanId('DIRECT123'),'DIRECT123');
  assert.equal(extractTredictPlanId({success:true}),'');
  assert.equal(extractTredictPlanId({error:'INVALID_PLAN'}),'');
});

test('summarizes rejected responses without serializing arbitrary bodies',async()=>{
  const {describeTredictPlanResponse}=await import('../cloudflare/tredict-plan-response.mjs');
  assert.match(describeTredictPlanResponse({error:'INVALID_PLAN',meta:{field:'steps'}}),/INVALID_PLAN/);
  assert.match(describeTredictPlanResponse({success:true}),/success=true/);
});

test('creates plan metadata first and appends relative-day trainings separately',async()=>{
  const {splitTredictPlanPayload}=await import('../cloudflare/tredict-plan-response.mjs');
  const payload={plan:{title:'RunnerBear plan'},planTrainings:[{day:1,structuredWorkout:{title:'Easy'}},{day:3,structuredWorkout:{title:'Quality'}}]};
  const split=splitTredictPlanPayload(payload);
  assert.deepEqual(split.create.plan,payload.plan);
  assert.match(split.create.llmDescription,/RunnerBear/);
  assert.equal('planTrainings' in split.create,false);
  assert.deepEqual(split.additions,[{planTraining:payload.planTrainings[0]},{planTraining:payload.planTrainings[1]}]);
});
