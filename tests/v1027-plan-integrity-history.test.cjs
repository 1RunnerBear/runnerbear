const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const fromDate='2026-08-24';
const baseConfig={
  profile:{baseKm:50,normalLow:50,normalHigh:55,upperLimit:55,targetWeeklyVolume:50},
  constraints:{runDays:[0,1,2,3,5,6],qualityDays:[1,3],longRunDay:6,alternativeDays:[4],maxRunDays:6,weeklyKmCap:55},
  goal:{mode:'base',distance:'half',date:'',name:''},
};
const week=(rows,start)=>rows.filter(row=>row.localDate>=start&&row.localDate<=new Date(Date.parse(`${start}T12:00:00Z`)+6*86400000).toISOString().slice(0,10));
const km=rows=>rows.filter(row=>row.sport==='running').reduce((sum,row)=>sum+Number(row.plannedDistanceM||0)/1000,0);

test('A · two selected quality days produce exactly two quality sessions',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js'),result=generateGoalPlan(baseConfig,fromDate),rows=week(result.rows,fromDate),quality=rows.filter(row=>row.workoutType==='quality');
  assert.equal(result.validation.valid,true);assert.deepEqual(quality.map(row=>row.localDate),['2026-08-25','2026-08-27']);assert.equal(quality.length,2);
});

test('B · preference reflow moves quality to Wednesday and Saturday without touching history',async()=>{
  const {generateGoalPlan,previewPlan,historicalRowsUnchanged}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js'),initial=generateGoalPlan(baseConfig,fromDate),historical={...initial.rows[0],localDate:'2026-08-20',status:'completed',title:'Historisk terskel',prescription:{version:1,legacy:{coach:'bevart'}},plannedLoad:{historic:true}},config={...baseConfig,constraints:{...baseConfig.constraints,qualityDays:[2,5]}},result=previewPlan({currentItems:[historical,...initial.rows],historicalItems:[historical,...initial.rows],config,fromDate,trigger:'training_preferences_changed'}),rows=week(result.rows,fromDate);
  assert.equal(result.validation.valid,true);assert.deepEqual(rows.filter(row=>row.workoutType==='quality').map(row=>row.localDate),['2026-08-26','2026-08-29']);assert.equal(historicalRowsUnchanged([historical],result.rows,fromDate),true);assert.deepEqual(result.rows.find(row=>row.workoutId===historical.workoutId),historical);
});

test('B2 · a manual drag reflows the rest of the week and keeps the quality invariant',async()=>{
  const {generateGoalPlan,previewPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js'),initial=generateGoalPlan(baseConfig,fromDate),tuesday=initial.rows.find(row=>row.localDate==='2026-08-25'),wednesday=initial.rows.find(row=>row.localDate==='2026-08-26'),moved=initial.rows.map(row=>row.workoutId===tuesday.workoutId?{...row,localDate:wednesday.localDate,plannedLoad:{...row.plannedLoad,manualMove:true}}:row.workoutId===wednesday.workoutId?{...row,localDate:tuesday.localDate,plannedLoad:{...row.plannedLoad,manualMove:true}}:row),result=previewPlan({currentItems:moved,historicalItems:moved,config:baseConfig,fromDate,trigger:'plan_adjustment'}),rows=week(result.rows,fromDate);
  assert.equal(result.validation.valid,true);assert.equal(rows.filter(row=>row.workoutType==='quality').length,2);assert.ok(rows.find(row=>row.workoutId===tuesday.workoutId&&row.localDate==='2026-08-26'));
});

test('C · the preferred long-run day is respected and recorded',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js'),config={...baseConfig,constraints:{...baseConfig.constraints,longRunDay:5}},rows=week(generateGoalPlan(config,fromDate).rows,fromDate),long=rows.find(row=>row.intent==='long');
  assert.equal(long.localDate,'2026-08-29');assert.equal(long.plannedLoad.integrity.preferredLongRunDay,5);assert.equal(long.plannedLoad.integrity.longRunOverrideReason,'');
});

test('D · generated full-week totals use the canonical 50 km target, 50–55 normal range and 55 km cap',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js'),result=generateGoalPlan(baseConfig,fromDate);
  for(const state of result.validation.weeks){assert.ok(state.plannedKm<=55);if(!state.safetyOverrideReason)assert.ok(state.plannedKm>=50&&state.plannedKm<=55);assert.equal(state.targetWeeklyVolume,state.plannedKm)}
  assert.equal(result.validation.weeks[0].plannedKm,50);assert.equal(km(week(result.rows,fromDate)),50);
});

test('E · current-week UI separates planned, completed and remaining volume',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v1027-source.js','utf8');assert.match(ui,/km planlagt/);assert.match(ui,/km<\/b> gjennomført/);assert.match(ui,/km<\/b> gjenstår/);assert.match(ui,/remainingKm/);
});

test('F · history restoration is idempotent, stable-ID based and non-destructive',()=>{
  const repository=fs.readFileSync('cloud/runnerbear-cloud/src/v1027/repository.js','utf8'),recovery=fs.readFileSync('scripts/v1027-history-recovery.mjs','utf8'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8');
  assert.match(repository,/r\.status<>'draft' AND i\.local_date<\?2/);assert.match(repository,/rb_plan_days WHERE user_id=\?1 AND date<\?2/);assert.match(recovery,/ON CONFLICT\(user_id,source,source_id\) DO UPDATE/);assert.doesNotMatch(recovery,/DELETE FROM rb_activities/);assert.match(workflow,/runnerbear-pre-v113\.sql/);assert.match(workflow,/duplicate_external_ids/);
});

test('G · accepted coach state stays high contrast and calendar navigation stays enabled',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v1027-source.js','utf8'),css=fs.readFileSync('runnerbear-v1027-plan-integrity-history.css','utf8');assert.match(ui,/Plan godkjent ✓/);assert.match(css,/button\.primary:disabled[^]*opacity:1/);assert.match(ui,/data-rb119c-month-step="-1"/);assert.match(ui,/data-rb113-week-step="-1"/);
});

test('H · refresh and replay are deterministic for the same canonical input',async()=>{
  const {generateGoalPlan,previewPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js'),first=generateGoalPlan(baseConfig,fromDate),a=previewPlan({currentItems:first.rows,historicalItems:first.rows,config:baseConfig,fromDate,trigger:'refresh'}),b=previewPlan({currentItems:first.rows,historicalItems:first.rows,config:baseConfig,fromDate,trigger:'refresh'});
  assert.deepEqual(a.rows,b.rows);assert.deepEqual(a.validation,b.validation);
});

test('I · canonical sync remains future-only with stable idempotency keys',async()=>{
  const {projectSync}=await import('../cloud/runnerbear-cloud/src/v1027/sync-projection.js'),items=[{workoutId:'past',lineageId:'past',localDate:'2026-08-20',status:'completed',sport:'running',title:'Past',prescription:{}},{workoutId:'future',lineageId:'future',localDate:'2026-08-25',status:'scheduled',sport:'running',title:'Future',prescription:{}}],a=projectSync(items,'pr-v1027','2026-08-21'),b=projectSync(items,'pr-v1027','2026-08-21');
  assert.equal(a.length,1);assert.equal(a[0].workoutId,'future');assert.equal(a[0].idempotencyKey,b[0].idempotencyKey);
});
