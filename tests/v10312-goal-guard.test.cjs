const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const baseConfig={
  profile:{baseKm:50,normalLow:48,normalHigh:52,upperLimit:55,targetWeeklyVolume:50},
  constraints:{runDays:[1,2,3,4,6],qualityDays:[1,4],longRunDay:6,alternativeDays:[0,5],maxRunDays:5,weeklyKmCap:55},
  goal:{mode:'race',name:'Bergen Maraton',date:'2026-10-12',distance:'half',targetSeconds:4980,secondary:[{id:'haugesund-half',name:'Haugesund halvmaraton',date:'2026-09-14',distance:'half',effort:'race',status:'active'}]},
};

test('goal guard restores the most recently paused future A goal without touching B races',async()=>{
  const {restorePausedPrimaryGoalState}=await import('../cloud/runnerbear-cloud/src/v1031/goal-model.js');
  const state={mode:'base',primary:null,secondary:baseConfig.goal.secondary,history:[{id:'old',name:'Historisk løp',date:'2026-05-01',status:'paused'},{id:'bergen-a',name:'Bergen Maraton',date:'2026-10-12',distance:'half',targetSeconds:4980,status:'paused',closedAt:'2026-08-24T09:00:00.000Z'}]};
  const result=restorePausedPrimaryGoalState(state,'2026-08-24','2026-08-24T10:00:00.000Z');
  assert.equal(result.changed,true);assert.equal(result.state.mode,'race');assert.equal(result.state.primary.id,'bergen-a');assert.equal(result.state.primary.status,'active');assert.equal(result.state.primary.closedAt,undefined);assert.deepEqual(result.state.secondary,baseConfig.goal.secondary);assert.equal(result.state.history.length,1);
});

test('release repair recreates an absent A goal once and keeps the authorized B race',async()=>{
  const {createReleaseGoalRepairState}=await import('../cloud/runnerbear-cloud/src/v1031/goal-model.js'),request={id:'bergen-half-2026',name:'Bergen Maraton',date:'2026-10-12',distance:'half',targetSeconds:'4980',secondary:baseConfig.goal.secondary};
  const result=createReleaseGoalRepairState({mode:'base',primary:null,secondary:[],history:[]},request,'2026-08-24','2026-08-24T11:00:00.000Z');
  assert.equal(result.changed,true);assert.equal(result.state.mode,'race');assert.equal(result.state.primary.id,'bergen-half-2026');assert.equal(result.state.primary.targetSeconds,4980);assert.equal(result.state.secondary[0].id,'haugesund-half');
  assert.equal(createReleaseGoalRepairState(result.state,request,'2026-08-24','2026-08-24T11:01:00.000Z').changed,false);
});

test('B race is canonical, replaces one quality dose, and preserves a valid race week',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1031/plan-engine.js'),result=generateGoalPlan(baseConfig,'2026-08-24'),race=result.rows.find(row=>row.plannedLoad?.bRace?.id==='haugesund-half'),week=result.validation.weeks.find(row=>row.week==='2026-09-14');
  assert.equal(result.validation.valid,true);assert.equal(race.localDate,'2026-09-14');assert.equal(race.workoutType,'race');assert.equal(race.lockLevel,'system');assert.equal(race.plannedDistanceM,21100);assert.equal(week.expectedQualitySessions,2);assert.equal(week.actualQualitySessions,2);assert.equal(week.safetyOverrideReason,'B-løpsuke');
});

test('six-day rhythm keeps unique workout identity when Saturday quality precedes Sunday recovery',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1031/plan-engine.js'),config={...baseConfig,constraints:{...baseConfig.constraints,runDays:[0,1,2,3,5,6],qualityDays:[2,5],longRunDay:6,alternativeDays:[4],maxRunDays:6}},result=generateGoalPlan(config,'2026-08-24'),ids=result.rows.map(row=>row.workoutId);
  assert.equal(result.validation.valid,true);assert.equal(new Set(ids).size,ids.length);assert.equal(result.validation.issues.some(issue=>issue.code==='HARD_DAY_ADJACENCY'),false);
});

test('removing a B race removes its canonical identity on the next reflow',async()=>{
  const {generateGoalPlan,reflowFuturePlan}=await import('../cloud/runnerbear-cloud/src/v1031/plan-engine.js'),first=generateGoalPlan(baseConfig,'2026-08-24'),next=reflowFuturePlan(first.rows,{...baseConfig,goal:{...baseConfig.goal,secondary:[]}},'2026-08-24','goal_changed');
  assert.equal(next.validation.valid,true);assert.equal(next.rows.some(row=>row.plannedLoad?.bRace),false);assert.equal(next.rows.some(row=>row.workoutId.startsWith('wo-b-race-')),false);
});

test('base-mode selection requires explicit confirmation and secondary races reach canonical config',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v1031-source.js','utf8'),client=fs.readFileSync('runnerbear-cloud-v1031.js','utf8'),routes=fs.readFileSync('cloud/runnerbear-cloud/src/v1031/routes.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1031.js','utf8');
  assert.match(ui,/data-rb109-goal-editor='base'/);assert.match(ui,/data-rb109-base-form/);assert.doesNotMatch(ui,/data-rb109-base-mode/);assert.match(ui,/restoreAccidentallyPausedGoal/);assert.match(client,/goal:\{mode:goal\.mode\|\|'race'.+secondary\}/);assert.match(routes,/repairAccidentalGoalState/);assert.match(routes,/canonicalGoal=currentConfig\?\.goal\?\.mode==='race'/);assert.doesNotMatch(routes,/!currentGoalActive/);assert.match(routes,/goal:auto-restored/);assert.match(entry,/path==='\/health'&&env\.GOAL_REPAIR_RELEASE/);assert.match(entry,/goalGuardAudit/);assert.match(entry,/goalGuard/);assert.match(entry,/goalRepair/);
});
