const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const baseConfig={
  profile:{baseKm:50,normalLow:48,normalHigh:52,upperLimit:55,targetWeeklyVolume:50},
  constraints:{runDays:[1,2,3,4,6],qualityDays:[1,3],longRunDay:6,alternativeDays:[0,5],maxRunDays:5,weeklyKmCap:55},
  goal:{mode:'race',name:'Bergen Maraton',date:'2026-10-12',distance:'half',targetSeconds:4980,secondary:[{id:'haugesund-half',name:'Haugesund halvmaraton',date:'2026-09-14',distance:'half',effort:'race',status:'active'}]},
};

const dayDiff=(a,b)=>Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/86400000);
const monday=value=>{const date=new Date(`${value}T12:00:00Z`),day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10)};

test('v11 programs every automatic future quality session and removes the double 5 × 1000 default',async()=>{
  const [{generateGoalPlan},{auditBakkenPlan}]=await Promise.all([import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),import('../cloud/runnerbear-cloud/src/v11/routes.js')]),result=generateGoalPlan(baseConfig,'2026-08-24'),quality=result.rows.filter(row=>row.workoutType==='quality'&&row.status==='scheduled');
  assert.equal(result.validation.valid,true);
  assert.ok(quality.length>4);
  assert.equal(quality.every(row=>row.prescription?.version===2&&row.plannedLoad?.bakken?.engineVersion==='11.0.0'),true);
  assert.equal(quality.some(row=>/Kvalitetsøkt · Bakken-motor/i.test(row.title)),false);
  const audit=auditBakkenPlan({items:result.rows},'2026-08-24');
  assert.equal(audit.ok,true);
  assert.deepEqual(audit.duplicateDefaultVo2Weeks,[]);
  assert.deepEqual(audit.ordinaryWeeksWithoutThreshold,[]);
});

test('ordinary two-quality weeks have one threshold anchor and distinct roles',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),result=generateGoalPlan({...baseConfig,goal:{mode:'race',name:'Hovedmål',date:'2027-01-18',distance:'half',secondary:[]}},'2026-08-24'),weeks=new Map();
  for(const row of result.rows.filter(row=>row.workoutType==='quality')){const key=monday(row.localDate);weeks.set(key,[...(weeks.get(key)||[]),row])}
  for(const rows of weeks.values())if(rows.length===2&&!['TAPER','RACE','TRANSITION'].includes(rows[0].plannedLoad.bakken.phase)){
    assert.equal(rows.some(row=>row.plannedLoad.bakken.stimulus==='threshold'),true);
    assert.notEqual(rows[0].plannedLoad.bakken.role,rows[1].plannedLoad.bakken.role);
    assert.notEqual(rows[0].plannedLoad.bakken.sessionId,rows[1].plannedLoad.bakken.sessionId);
  }
});

test('the same automatic session is not repeated inside the 14-day rotation window in base training',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),result=generateGoalPlan({...baseConfig,goal:{mode:'base',name:'',date:'',distance:'half',secondary:[]}},'2026-08-24'),bySession=new Map();
  for(const row of result.rows.filter(row=>row.workoutType==='quality')){const id=row.plannedLoad.bakken.sessionId;bySession.set(id,[...(bySession.get(id)||[]),row.localDate])}
  for(const dates of bySession.values())for(let index=1;index<dates.length;index++)assert.ok(dayDiff(dates[index],dates[index-1])>=14,`${dates[index-1]} and ${dates[index]} repeat inside 14 days`);
});

test('the 14-day rotation also holds through specific, taper and race phases',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),result=generateGoalPlan(baseConfig,'2026-08-24'),bySession=new Map();
  for(const row of result.rows.filter(row=>row.workoutType==='quality')){const id=row.plannedLoad.bakken.sessionId;bySession.set(id,[...(bySession.get(id)||[]),row.localDate])}
  for(const [id,dates] of bySession)for(let index=1;index<dates.length;index++)assert.ok(dayDiff(dates[index],dates[index-1])>=14,`${id}: ${dates[index-1]} and ${dates[index]} repeat inside 14 days`);
});

test('5 × 1000 VO₂ is a restricted X candidate, never the generic half-marathon default',async()=>{
  const {QUALITY_LIBRARY,selectQualitySession}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js'),candidate=QUALITY_LIBRARY.find(row=>row.id==='x-5x1000');
  assert.deepEqual(candidate.goals,['five','ten']);
  assert.deepEqual(candidate.phases,['SPECIFIC']);
  for(const date of ['2026-08-25','2026-09-01','2026-09-08','2026-09-22']){
    const selected=selectQualitySession({date,slot:1,config:baseConfig,responseMode:'NORMAL'});
    assert.notEqual(selected.session.id,'x-5x1000');
  }
});

test('a costly quality response reduces only the next unlocked quality session with evidence',async()=>{
  const [{generateGoalPlan},{adaptNextQuality}]=await Promise.all([import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js')]),generated=generateGoalPlan({...baseConfig,goal:{...baseConfig.goal,secondary:[]}},'2026-08-24'),quality=generated.rows.filter(row=>row.workoutType==='quality').sort((a,b)=>a.localDate.localeCompare(b.localDate)),completed={...quality[0],status:'completed'},items=generated.rows.map(row=>row.workoutId===completed.workoutId?completed:row),event={event_id:'feedback-quality-high-cost-1',event_type:'feedback:workout',local_date:completed.localDate,occurred_at:`${completed.localDate}T18:00:00.000Z`,payload:{workoutId:completed.workoutId,responseDate:completed.localDate,rpe:9,pain:0,control:'uncontrolled',responsePhase:'next_morning'}},adaptation=adaptNextQuality({items,events:[event],config:baseConfig,today:completed.localDate});
  assert.ok(adaptation);
  assert.equal(adaptation.signal.mode,'REDUCE');
  assert.equal(adaptation.after.plannedLoad.bakken.evidenceId,event.event_id);
  assert.equal(adaptation.after.plannedLoad.bakken.stimulus,'threshold');
  assert.ok(adaptation.after.plannedDistanceM<=adaptation.before.plannedDistanceM);
  assert.equal(adaptation.rows.filter(row=>JSON.stringify(items.find(before=>before.workoutId===row.workoutId))!==JSON.stringify(row)).length,1);
  assert.equal(adaptNextQuality({items:adaptation.rows,events:[event],config:baseConfig,today:completed.localDate}),null);
});

test('HOLD response returns to a low-cost threshold family instead of X',async()=>{
  const {selectQualitySession}=await import('../cloud/runnerbear-cloud/src/v11/bakken-engine.js'),config={...baseConfig,goal:{mode:'race',name:'Hovedmål',date:'2026-09-30',distance:'half',secondary:[]}},selection=selectQualitySession({date:'2026-08-25',slot:1,config,responseMode:'HOLD'});
  assert.equal(selection.session.stimulus,'threshold');
  assert.equal(selection.family,'threshold_short');
  assert.notEqual(selection.session.id,'x-5x1000');
});

test('a legacy manually moved quality keeps its date but receives the v11 prescription',async()=>{
  const [legacy,current]=await Promise.all([import('../cloud/runnerbear-cloud/src/v1031/plan-engine.js'),import('../cloud/runnerbear-cloud/src/v11/plan-engine.js')]),old=legacy.generateGoalPlan({...baseConfig,goal:{...baseConfig.goal,secondary:[]}},'2026-08-24'),quality=old.rows.find(row=>row.workoutType==='quality'),date=quality.localDate,rows=old.rows.map(row=>row.workoutId===quality.workoutId?{...row,plannedLoad:{...(row.plannedLoad||{}),manualMove:true}}:row),next=current.reflowFuturePlan(rows,{...baseConfig,goal:{...baseConfig.goal,secondary:[]}},'2026-08-24','bakken_v11_release'),repaired=next.rows.find(row=>row.workoutId===quality.workoutId);
  assert.equal(next.validation.valid,true);
  assert.equal(repaired.localDate,date);
  assert.equal(repaired.plannedLoad.manualMove,true);
  assert.equal(repaired.plannedLoad.bakken.engineVersion,'11.0.0');
  assert.equal(repaired.prescription.version,2);
});

test('B race remains canonical and replaces one quality dose without training debt',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),result=generateGoalPlan(baseConfig,'2026-08-24'),race=result.rows.find(row=>row.plannedLoad?.bRace?.id==='haugesund-half'),weekRows=result.rows.filter(row=>monday(row.localDate)==='2026-09-14'),quality=weekRows.filter(row=>['quality','race'].includes(row.workoutType));
  assert.equal(result.validation.valid,true);
  assert.equal(race.workoutType,'race');
  assert.equal(race.lockLevel,'system');
  assert.equal(quality.length,2);
  assert.equal(quality.filter(row=>row.workoutType==='quality').length,1);
  assert.equal(quality.find(row=>row.workoutType==='quality').plannedLoad.bakken.engineVersion,'11.0.0');
  assert.match(weekRows.find(row=>row.plannedLoad?.integrity)?.plannedLoad.integrity.safetyOverrideReason,/B-løpsuke/);
});

test('manual quality-bank choices stay explicit and outside automatic repair',()=>{
  const client=fs.readFileSync('runnerbear-cloud-v11.js','utf8'),transport=fs.readFileSync('runnerbear-cloud-v1025.js','utf8'),routes=fs.readFileSync('cloud/runnerbear-cloud/src/v11/routes.js','utf8'),engine=fs.readFileSync('cloud/runnerbear-cloud/src/v11/bakken-engine.js','utf8');
  assert.match(client,/manualQuality=workoutType==='quality'&&!!row\.workoutBankId/);
  assert.match(client,/explicitChoice:Object\.hasOwn\(explicitModes,row\.baseDs\)\|\|manualQuality/);
  assert.match(routes,/row\.explicitChoice!==true/);
  assert.match(engine,/row\.explicitChoice===true/);
  assert.match(transport,/window\.RunnerBearCloudV1031\|\|window\.RunnerBearCloudV1027/);
  assert.match(client,/window\.RunnerBearCloudV1031=window\.RunnerBearCloudV11/);
});

test('v11 UI exposes coach rationale and all three quality-bank stimulus groups',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),browser=fs.readFileSync('runnerbear-v11-bakken-engine.js','utf8'),model=require('../runnerbear-v11-bakken-engine.js'),ranked=model.rankWorkoutBank({intendedStimulus:'race_specific',phase:'specific',goalDistance:'half',weekMode:'NORMAL'});
  assert.match(ui,/Bakken Adaptive Coach/);
  assert.match(ui,/Løpsspesifikke økter/);
  assert.match(ui,/X-økter · eget stimulus/);
  assert.match(ui,/meta\.rationale/);
  assert.match(browser,/x-5x1000/);
  assert.match(browser,/family:'race_specific'/);
  assert.equal(ranked.find(row=>row.stimulus==='race_specific').id,'specific-half-3x3000');
  assert.equal(ranked.some(row=>row.id==='x-5x1000'),false);
  assert.equal(model.rankWorkoutBank({goalDistance:'ten',phase:'specific'}).some(row=>row.id==='x-5x1000'),true);
});

test('v11 release and production gates are locked to the Bakken audit',()=>{
  const planEngine=fs.readFileSync('cloud/runnerbear-cloud/src/v11/plan-engine.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11.js','utf8'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8'),healthGate=fs.readFileSync('scripts/verify-v116-health.mjs','utf8'),html=fs.readFileSync('index.html','utf8');
  assert.doesNotMatch(planEngine,/index\s*%\s*2.+5\s*[×x]\s*1000/is);
  assert.match(entry,/repairBakkenV11Plan/);
  assert.match(entry,/bakkenPlanAudit/);
  assert.match(workflow,/verify-v116-health\.mjs/);
  assert.match(healthGate,/x\.bakkenPlanAudit\?\.ok===true/);
  assert.match(healthGate,/x\.bakkenEngineVersion==='11\.0\.0'/);
  assert.match(html,/runnerbear-core-v11\.js\?v=11600/);
});
