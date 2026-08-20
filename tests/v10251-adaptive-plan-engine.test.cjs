const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const model=require('../runnerbear-v10251-adaptive-plan.js');
const transportModel=require('../runnerbear-v1024-tredict-transport.js');

const week=[
  {baseDs:'2026-08-17',ds:'2026-08-17',week:1,type:'rest',title:'Hvile'},
  {baseDs:'2026-08-18',ds:'2026-08-18',week:1,type:'quality',title:'6 × 6 min terskel'},
  {baseDs:'2026-08-19',ds:'2026-08-19',week:1,type:'easy',title:'8 km rolig'},
  {baseDs:'2026-08-20',ds:'2026-08-20',week:1,type:'easy',title:'7 km rolig'},
  {baseDs:'2026-08-21',ds:'2026-08-21',week:1,type:'quality',title:'20 × 45/15'},
  {baseDs:'2026-08-22',ds:'2026-08-22',week:1,type:'easy',title:'16 km langtur'},
  {baseDs:'2026-08-23',ds:'2026-08-23',week:1,type:'cross',title:'Concept2 · rolig'}
];
const preferences={runDays:[1,2,3,4,6],qualityDays:[1,4],longRunDay:6,alternativeDays:[0,5]};

test('changing long-run day replans only future rows and preserves stimulus',()=>{
  const rows=week.map(row=>row.ds<'2026-08-20'?{...row,terminal:true}:row),result=model.replanFuture(rows,preferences,{today:'2026-08-20'}),long=result.rows.find(row=>model.stimulusForWorkout(row)==='long');
  assert.equal(long.ds,'2026-08-23');
  assert.equal(result.rows.find(row=>row.baseDs==='2026-08-18').ds,'2026-08-18');
  assert.equal(model.stimulusForWorkout(long),'long');
  assert.equal(result.valid,true);
});

test('quality-day preference moves the threshold stimulus without converting it to X',()=>{
  const prefs={...preferences,qualityDays:[2,4]},result=model.replanFuture(week,prefs,{today:'2026-08-17'}),threshold=result.rows.filter(row=>model.stimulusForWorkout(row)==='threshold');
  assert.deepEqual(threshold.map(row=>row.ds),['2026-08-19','2026-08-21']);
  assert.equal(threshold.every(row=>model.stimulusForWorkout(row)==='threshold'),true);
});

test('drag preview moves Tuesday to Thursday and rejects adjacent quality',()=>{
  const safe=week.map(row=>row.baseDs==='2026-08-21'?{...row,type:'easy',title:'7 km rolig'}:row),preview=model.previewMove({rows:safe,sourceBaseDs:'2026-08-18',targetBaseDs:'2026-08-20',today:'2026-08-17',preferences});
  assert.equal(preview.ok,true);
  assert.equal(preview.directRows.find(row=>row.baseDs==='2026-08-18').ds,'2026-08-20');
  const unsafe=model.previewMove({rows:week,sourceBaseDs:'2026-08-18',targetBaseDs:'2026-08-20',today:'2026-08-17',preferences});
  assert.equal(unsafe.ok,false);
  assert.equal(unsafe.code,'adjacent_quality');
});

test('quality bank ranks same-stimulus sessions first and keeps X separate',()=>{
  const ranked=model.rankWorkoutBank({plan:week[1],intendedStimulus:'threshold',weekMode:'NORMAL',daysToNextQuality:3,daysToLongRun:4});
  assert.equal(ranked[0].stimulus,'threshold');
  assert.equal(ranked.filter(row=>row.stimulus==='x').every(row=>row.suitabilityScore<ranked[0].suitabilityScore),true);
  assert.equal(model.stimulusForWorkout(model.QUALITY_BANK.find(row=>row.id==='threshold-20x45-15')),'threshold');
});

test('missed quality is not blindly moved into the next quality day',()=>{
  const result=model.missedWorkoutDecision({missed:week[1],future:[week[4]],healthTrend:'normal'});
  assert.equal(result.action,'drop');
  assert.match(result.message,/flyttes ikke blindt/i);
});

test('one poor health signal does not trigger deload but a multi-day trend does',()=>{
  const one=model.decideWeekMode({healthSignals:[{level:'normal'},{level:'low'}],load7:50,load28Weekly:50});
  assert.equal(one.mode,'NORMAL');
  const trend=model.decideWeekMode({healthSignals:[{level:'negative'},{level:'low'},{level:'negative'}],load7:54,load28Weekly:50});
  assert.equal(trend.mode,'RECOVERY');
});

test('plan mutation carries immutable before/after specs and increments revision',()=>{
  const next=week.map(row=>row.baseDs==='2026-08-18'?{...row,ds:'2026-08-20',title:'20 × 45/15'}:row),mutation=model.createPlanMutation({previousRows:week,nextRows:next,previousRevision:142,type:'plan:workout-adjusted',reason:'test',now:'2026-08-20T12:00:00.000Z',id:'mutation-143'});
  assert.equal(mutation.planRevision,143);
  assert.equal(mutation.affected.length,1);
  assert.equal(mutation.affected[0].previousDate,'2026-08-18');
  assert.equal(mutation.affected[0].newWorkout.title,'20 × 45/15');
  assert.equal(mutation.syncStatus,'pending');
});

test('Tredict queue rejects stale revisions and only sends the newest plan state',async()=>{
  const sent=[],events=[],transport={available:true,syncWorkout:async payload=>{sent.push(payload);return{ok:true,planRevision:payload.workout.planRevision}}},service=transportModel.createTredictSyncService({storage:transportModel.memoryStorage(),transport:()=>transport,onEvent:(name,detail)=>events.push({name,detail}),setTimer:()=>0,clearTimer:()=>{},debounceMs:999999});
  const workout=(baseDs,date,revision)=>({baseDs,originalDate:baseDs,date,ds:date,type:'quality',title:'6 × 6 min terskel',km:12,planRevision:revision,mutationId:`mutation-${revision}`});
  const current=workout('2026-08-21','2026-08-22',143),stale=workout('2026-08-18','2026-08-19',142);
  assert.equal(service.queue(transportModel.planEvent('plan:workout-moved',current,{planRevision:143,mutationId:'mutation-143'}),current).queued,true);
  assert.equal(service.queue(transportModel.planEvent('plan:workout-moved',stale,{planRevision:142,mutationId:'mutation-142'}),stale).staleRevision,true);
  await service.flush();
  assert.deepEqual(sent.map(row=>row.workout.planRevision),[143]);
  assert.equal(service.all().latestRevision,143);
  assert.equal(events.some(row=>row.name==='tredict_sync_success'&&row.detail.mutationId==='mutation-143'),true);
});

test('generated app exposes coach-first surfaces and ten-day rolling sync',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1025.js'),'utf8');
  assert.match(ui,/Helsedata/);assert.match(ui,/Coachens vurdering/);assert.match(ui,/Hvorfor denne økten\?/);
  assert.match(ui,/RunnerBear Quality Bank/);assert.match(ui,/movePreviewModalHtml/);assert.match(ui,/planRevision/);
  assert.match(ui,/TREDICT_HORIZON_DAYS=10/);assert.match(ui,/Se grunnlaget/);assert.match(ui,/rolige støtteøkter/);
});
