const test=require('node:test');
const assert=require('node:assert/strict');
const browser=require('../runnerbear-v11-bakken-engine.js');
const tredict=require('../runnerbear-tredict-outbound.js');

const config={
  profile:{baseKm:50,normalLow:48,normalHigh:52,upperLimit:55,targetWeeklyVolume:50},
  constraints:{runDays:[1,2,3,4,6],qualityDays:[1,3],longRunDay:6,alternativeDays:[0,5],maxRunDays:5,weeklyKmCap:55,avoidHillWorkouts:true},
  goal:{mode:'race',name:'10 km',date:'2026-11-15',distance:'ten',targetSeconds:2250,secondary:[]},
};

test('Workout Bank 2.0 contains the locked core prescriptions and no hill family',async()=>{
  const {QUALITY_LIBRARY,BAKKEN_ENGINE_VERSION,BAKKEN_WORKOUT_BANK_VERSION,BAKKEN_POLICY}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js'),byId=new Map(QUALITY_LIBRARY.map(row=>[row.id,row]));
  assert.equal(BAKKEN_ENGINE_VERSION,'11.7.0');assert.equal(BAKKEN_WORKOUT_BANK_VERSION,'2.0.0');assert.equal(BAKKEN_POLICY.avoidHillWorkouts,true);
  const expected={
    'threshold-6x6':[6,360,90], 'threshold-4x8':[4,480,180], 'threshold-3x10':[3,600,120], 'threshold-4x10':[4,600,90],
    'threshold-6x5':[6,300,45], 'threshold-10x3':[10,180,60], 'threshold-15x1':[15,60,30],
    'x-20x45-15':[20,45,15], 'x-30x45-15':[30,45,15], 'x-6x3':[6,180,90],
  };
  for(const [id,[repetitions,workSeconds,recoverySeconds]] of Object.entries(expected)){const row=byId.get(id);assert.ok(row,id);assert.deepEqual([row.main.repetitions,row.main.workSeconds,row.main.recoverySeconds],[repetitions,workSeconds,recoverySeconds])}
  assert.equal(QUALITY_LIBRARY.some(row=>/hill|bakke|motbakke/i.test(`${row.id} ${row.title} ${row.desc}`)),false);
  for(const id of ['threshold-5x8','threshold-3x12','threshold-24x45-15','threshold-12x400','x-10x60-hills'])assert.equal(byId.has(id),false,id);
  assert.equal(byId.get('x-8x2').availability,'specialist');assert.equal(byId.get('x-5x1000').availability,'specialist');
});

test('browser and server banks have structural parity',async()=>{
  const {QUALITY_LIBRARY}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js'),contract=row=>({id:row.id,family:row.family,stimulus:row.stimulus,workMinutes:row.workMinutes,cost:row.cost,availability:row.availability,goals:row.goals||[],phases:row.phases,main:row.main});
  assert.deepEqual(browser.QUALITY_BANK.map(contract),QUALITY_LIBRARY.map(contract));
  assert.equal(browser.WORKOUT_BANK_VERSION,'2.0.0');assert.equal(browser.POLICY.avoidHillWorkouts,true);
});

test('HOLD, REDUCE and RECOVERY cannot select X while moderate and full doses remain distinct',async()=>{
  const {selectQualitySession}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js');
  for(const responseMode of ['HOLD','REDUCE','RECOVERY'])for(let slot=0;slot<2;slot++)assert.equal(selectQualitySession({date:'2026-09-15',slot,config,responseMode}).session.stimulus,'threshold');
  const moderate=browser.QUALITY_BANK.find(row=>row.id==='x-20x45-15'),full=browser.QUALITY_BANK.find(row=>row.id==='x-30x45-15'),normalTen=browser.QUALITY_BANK.find(row=>row.id==='threshold-3x10'),highTen=browser.QUALITY_BANK.find(row=>row.id==='threshold-4x10');
  assert.deepEqual([moderate.dose,moderate.cost,moderate.workMinutes],['moderate',2,15]);assert.deepEqual([full.dose,full.cost,full.workMinutes],['full',3,22.5]);assert.equal(normalTen.dose,'moderate');assert.equal(highTen.requiresPositiveResponse,true);
  assert.notEqual(selectQualitySession({date:'2026-09-15',slot:0,config,responseMode:'NORMAL'}).session.id,'threshold-4x10');
});

test('an explicit manual Workout Bank 2.0 choice survives canonical server programming',async()=>{
  const {programQualityWeek}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js'),row={workoutId:'wo-manual',lineageId:'lin-manual',localDate:'2026-09-15',slotIndex:0,status:'scheduled',sport:'running',workoutType:'quality',title:'Legacy quality',intent:'threshold',plannedDistanceM:12000,lockLevel:'none',explicitChoice:true,prescription:{version:1,legacy:{}},plannedLoad:{manualQualityChoice:{sessionId:'threshold-4x8',stimulus:'threshold'}}},next=programQualityWeek({rows:[row],allItems:[],config,week:'2026-09-14',expectedQuality:1})[0];
  assert.equal(next.plannedLoad.bakken.sessionId,'threshold-4x8');assert.equal(next.plannedLoad.bakken.workoutBankVersion,'2.0.0');assert.equal(next.explicitChoice,true);assert.equal(next.workoutId,row.workoutId);assert.equal(next.localDate,row.localDate);
});

test('future repair is history-safe, identity-safe, no-hill and idempotent',async()=>{
  const {repairFutureWorkoutBank}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js'),legacy=(date,status)=>({workoutId:`wo-${date}`,lineageId:`lin-${date}`,localDate:date,slotIndex:0,status,sport:'running',workoutType:'quality',title:'10 × 60 sek korte bakker',intent:'x',plannedDistanceM:9000,lockLevel:'user',explicitChoice:true,source:'runnerbear-v11.0',prescription:{version:2,main:{kind:'intervals',repetitions:10,workSeconds:60},legacy:{desc:'Kontrollert bakkeøkt.'}},plannedLoad:{manualMove:true,bakken:{engineVersion:'11.0.0',sessionId:'x-10x60-hills'}}}),past=legacy('2026-08-30','completed'),future=legacy('2026-09-02','scheduled'),before=JSON.stringify(past),first=repairFutureWorkoutBank({items:[past,future],config,today:'2026-08-31'}),repaired=first.rows[1];
  assert.equal(JSON.stringify(first.rows[0]),before);assert.equal(repaired.workoutId,future.workoutId);assert.equal(repaired.localDate,future.localDate);assert.equal(repaired.plannedLoad.manualMove,true);assert.equal(repaired.explicitChoice,true);assert.equal(repaired.plannedDistanceM,9000);assert.equal(repaired.plannedLoad.bakken.workoutBankVersion,'2.0.0');assert.doesNotMatch(`${repaired.title} ${repaired.prescription.legacy.desc}`,/hill|bakke|motbakke/i);
  const second=repairFutureWorkoutBank({items:first.rows,config,today:'2026-08-31'});assert.deepEqual(second.changedIds,[]);assert.deepEqual(second.rows,first.rows);
});

test('all locked time prescriptions serialize to exact Tredict repeat structures',()=>{
  const ids=['threshold-6x6','threshold-4x8','threshold-3x10','threshold-4x10','threshold-6x5','threshold-10x3','threshold-15x1','x-20x45-15','x-30x45-15','x-6x3'];
  for(const id of ids){const row=browser.QUALITY_BANK.find(item=>item.id===id),out=tredict.workout({externalId:id,date:'2026-09-01',type:'quality',title:row.title,desc:row.desc,detail:row.detail,stimulus:row.stimulus,km:row.km}),repeat=out.structuredWorkout.steps.find(step=>step.repetitions);assert.ok(repeat,id);assert.equal(repeat.repetitions,row.main.repetitions,id);assert.equal(repeat.steps[0].duration,row.main.workSeconds,id);assert.equal(repeat.steps[1].duration,row.main.recoverySeconds,id)}
});
