const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const transportRules=require('../runnerbear-v1024-tredict-transport.js');

function workout(overrides={}){
  return{workoutId:'2026-08-17',baseDs:'2026-08-17',originalDate:'2026-08-17',date:'2026-08-19',type:'easy',title:'8 km rolig',km:8,...overrides};
}
function event(type,value,detail={}){return transportRules.planEvent(type,value,{previousDate:value.originalDate,newDate:value.date,...detail})}

test('Tredict transport reschedules idempotently and records the Tredict identity',async()=>{
  const calls=[],value=workout(),storage=transportRules.memoryStorage();
  const service=transportRules.createTredictSyncService({storage,transport:{available:true,syncWorkout:async payload=>{calls.push(payload);return{status:'calendar-active',workoutId:'td-42',planId:'plan-7'}}},setTimer:()=>1,clearTimer:()=>{},debounceMs:0});
  service.queue(event('plan:workout-moved',value),value);await service.flush();
  const id=transportRules.stableExternalId(value);
  assert.equal(calls.length,1);assert.equal(calls[0].operation,'reschedule');assert.equal(service.status(id).status,'synced');assert.equal(service.status(id).tredictWorkoutId,'td-42');
  assert.equal(service.queue(event('plan:workout-moved',value),value).idempotent,true);await service.flush();assert.equal(calls.length,1);
});

test('Tredict action states stay durable without pretending the calendar is complete',async()=>{
  const value=workout(),responses=[{status:'awaiting-calendar-activation',awaitingActivation:true,planId:'plan-new'},{status:'review-required',requiresAction:true,message:'Kontroller kalenderen'}];
  for(const [index,expected] of ['awaiting_activation','review_required'].entries()){
    const storage=transportRules.memoryStorage(),service=transportRules.createTredictSyncService({storage,transport:{available:true,syncWorkout:async()=>responses[index]},setTimer:()=>1,clearTimer:()=>{}});
    const action=event(index?'plan:workout-cancelled':'plan:workout-adjusted',value);service.queue(action,value);await service.flush();
    assert.equal(service.status(transportRules.stableExternalId(value)).status,expected);
    assert.equal(service.queue(action,value).idempotent,true);
  }
});

test('legacy Garmin queue migrates and resumes through Tredict',async()=>{
  const storage=transportRules.memoryStorage(),value=workout(),id=transportRules.stableExternalId(value),legacyKey='runnerbear_v1023_garmin_sync';
  storage.setItem(legacyKey,JSON.stringify({version:1,items:{[id]:{externalId:id,status:'not_synced',lastError:'training_api_unavailable'}},queue:[{externalId:id,event:event('plan:workout-adjusted',value),workout:value,hash:transportRules.workoutHash(value),queuedAt:new Date().toISOString(),attempt:0,nextAttemptAt:0}]}));
  const calls=[],service=transportRules.createTredictSyncService({storage,transport:{available:true,syncWorkout:async payload=>{calls.push(payload);return{workoutId:'td-migrated'}}},setTimer:()=>1,clearTimer:()=>{},now:()=>Date.now()});
  service.init();await service.flush();
  assert.equal(calls.length,1);assert.equal(service.status(id).status,'synced');assert.equal(service.all().queue.length,0);assert.ok(storage.getItem('runnerbear_v1024_tredict_sync'));
});

test('successful whole-plan reconcile clears only matching stale queue errors',()=>{
  const storage=transportRules.memoryStorage(),included=workout(),other=workout({workoutId:'cancelled-old',baseDs:'2026-08-11',externalId:'rb-cancelled-old'}),includedId=transportRules.stableExternalId(included),otherId=transportRules.stableExternalId(other),key='runnerbear_v1024_tredict_sync';
  storage.setItem(key,JSON.stringify({version:2,items:{[includedId]:{externalId:includedId,status:'error',lastError:'old failure'},[otherId]:{externalId:otherId,status:'error',lastError:'keep'}},queue:[{externalId:includedId,workout:included,event:event('plan:workout-adjusted',included),hash:'h1'},{externalId:otherId,workout:other,event:event('plan:workout-cancelled',other),hash:'h2'}]}));
  const service=transportRules.createTredictSyncService({storage,stateKey:key,transport:{available:true,syncWorkout:async()=>({})},setTimer:()=>1,clearTimer:()=>{}});
  assert.equal(service.acceptRemote({ok:true,status:'awaiting-calendar-activation',planId:'plan-10'},[includedId]),1);
  assert.equal(service.status(includedId).status,'awaiting_activation');assert.equal(service.status(includedId).lastError,'');assert.equal(service.status(otherId).status,'error');assert.equal(service.all().queue.length,1);
});

test('calendar helpers identify RunnerBear markers and preserve scheduled time',async()=>{
  const helpers=await import('../cloudflare/tredict-calendar-sync.mjs');
  const rows=helpers.plannedRows({_embedded:{plannedTrainingList:[{id:'11',date:'2026-08-17T06:30:00.000Z',structuredWorkout:{title:'Rolig',notes:'[RB:rb-workout-1]'}}]}});
  const row=helpers.findPlannedWorkout(rows,{externalId:'RB-WORKOUT-1',date:'2026-08-17',title:'Rolig'});
  assert.equal(row.id,'11');assert.equal(helpers.rowExternalId(row),'rb-workout-1');assert.equal(helpers.scheduledDateTime(row,'2026-08-20'),'2026-08-20T06:30:00.000Z');
});

test('v10.24 app names the real Tredict transport and removes the Garmin API placeholder',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1024.js'),'utf8'),data=fs.readFileSync(path.join(root,'runnerbear-data-v1024.js'),'utf8'),cloud=fs.readFileSync(path.join(root,'cloud/runnerbear-cloud/src/index-v982.js'),'utf8'),bridge=fs.readFileSync(path.join(root,'cloudflare/runnerbear-tredict-worker.mjs'),'utf8');
  assert.match(ui,/RunnerBear → Tredict → Garmin/);assert.match(ui,/Klar i Tredict – aktiver planen/);assert.match(ui,/Tredict-kalender/);
  assert.match(ui,/TREDICT_HORIZON_DAYS=10/);assert.match(ui,/addDays\(today\(\),horizon-1\)/);assert.match(ui,/rullerende 10-dagersperioden/);
  assert.doesNotMatch(ui,/Training API/);assert.doesNotMatch(ui,/Tredict-fallback/);assert.match(data,/RunnerBearTredictTransport/);
  assert.match(cloud,/\/api\/outbound\/tredict\/reconcile/);assert.match(cloud,/changePlannedWorkoutDate/);assert.match(bridge,/plannedTraining\/changeDate/);
  assert.match(cloud,/structuralChange/);assert.match(bridge,/TREDICT_MCP/);assert.match(bridge,/plan-creation/);assert.match(bridge,/MCP fallback/);assert.match(bridge,/llmDescription/);assert.match(data,/acceptRemote/);
});

test('Mer render reuses parsed data, schedule and match calculations within one render',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1024.js'),'utf8');
  assert.match(ui,/const readCache=new Map\(\)/);
  assert.match(ui,/if\(renderCache\?\.schedule\)return renderCache\.schedule/);
  assert.match(ui,/if\(renderCache\?\.activities\)return renderCache\.activities/);
  assert.match(ui,/if\(renderCache\?\.matches\)return renderCache\.matches/);
  assert.match(ui,/finally\{renderCache=previous\}/);
});

test('Mer opens progressively and hydrates heavy insight work while the browser is idle',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1024.js'),'utf8');
  assert.match(ui,/moreShellHtml/);assert.match(ui,/requestIdleCallback\(hydrate/);assert.match(ui,/moreRenderReady&&!moreRenderDirty/);
});

test('Mer sync health ignores stale queue items outside the current ten-day plan',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1024.js'),'utf8');
  assert.match(ui,/currentTransportIds=new Set\(planQueue/);assert.match(ui,/filter\(x=>currentTransportIds\.has/);
});

test('an exact server-side plan signature outranks an older local queue error',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1024.js'),'utf8');
  assert.match(ui,/remoteCurrentAction=current&&!active&&published/);assert.match(ui,/transportLabel=active\?'Automatisk':remoteCurrentAction\?'Aktiver én gang':transportError/);
});
