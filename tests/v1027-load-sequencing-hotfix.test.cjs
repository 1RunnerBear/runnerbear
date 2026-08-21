const test=require('node:test');
const assert=require('node:assert/strict');

const baseConfig={
  profile:{baseKm:50,normalLow:50,normalHigh:55,upperLimit:55,targetWeeklyVolume:50},
  constraints:{runDays:[1,2,3,4,6],qualityDays:[1,4],longRunDay:6,alternativeDays:[0,5],maxRunDays:5,weeklyKmCap:55},
  goal:{mode:'base',distance:'half',date:'',name:''},
};
const row=(date,type,km,title,extra={})=>({workoutId:`w-${date}-${type}`,lineageId:`l-${date}-${type}`,localDate:date,slotIndex:0,status:'scheduled',sport:['easy','quality'].includes(type)?'running':type,workoutType:type,title:title||type,intent:type==='quality'?'threshold':type,plannedDistanceM:km*1000,lockLevel:'none',prescription:{version:1,main:type==='quality'?{kind:'intervals'}:{kind:'continuous'}},plannedLoad:{},...extra});

test('late-week volume target is not treated as debt and dumped into Sunday',async()=>{
  const {previewPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js');
  const rows=[
    row('2026-08-18','quality',10,'Terskel',{status:'completed',lockLevel:'system'}),
    row('2026-08-19','easy',7,'7 km rolig',{status:'completed',lockLevel:'system'}),
    row('2026-08-20','easy',8,'8 km rolig',{status:'completed',lockLevel:'system'}),
    row('2026-08-21','quality',10,'3 × 10 × 45/15',{prescription:{version:1,main:{kind:'intervals'},legacy:{desc:'Alternativ eller hvile',detail:'Serie 1 ~3:58, serie 2 ~3:53, serie 3 ~3:48–3:52 hvis kontroll.'}}}),
    row('2026-08-23','easy',17,'17 km rolig langtur',{intent:'long'}),
  ];
  const config={...baseConfig,constraints:{...baseConfig.constraints,runDays:[1,2,3,6],qualityDays:[1,3],alternativeDays:[0,4,5],maxRunDays:4}};
  const result=previewPlan({currentItems:rows,historicalItems:rows,config,fromDate:'2026-08-21',trigger:'training_preferences_changed'}),friday=result.rows.find(r=>r.localDate==='2026-08-21'),sunday=result.rows.find(r=>r.localDate==='2026-08-23');
  assert.equal(result.validation.valid,true,JSON.stringify(result.validation.issues));
  assert.equal(friday.workoutType,'cross');
  assert.equal(friday.title,'Alternativ eller hvile');
  assert.equal(friday.plannedDistanceM,0);
  assert.doesNotMatch(friday.prescription?.legacy?.detail||'',/Serie 1|3:58/);
  assert.equal(sunday.intent,'long');
  assert.ok(sunday.plannedDistanceM/1000<=18,`unsafe Sunday long run: ${sunday.plannedDistanceM/1000} km`);
  assert.equal(sunday.plannedLoad.integrity.volumeDebtSuppressed,true);
  assert.match(sunday.plannedLoad.integrity.volumeReason,/ikke treningsgjeld/);
});

test('generated recovery rows cannot retain stale threshold instructions',async()=>{
  const {previewPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js');
  const dirty=row('2026-08-21','quality',10,'Terskel',{prescription:{version:1,main:{kind:'intervals'},legacy:{desc:'Terskel',detail:'Serie 1 ~3:58'}}});
  const config={...baseConfig,constraints:{...baseConfig.constraints,runDays:[1,2,3,6],qualityDays:[1,3],alternativeDays:[0,4,5],maxRunDays:4}};
  const result=previewPlan({currentItems:[dirty,row('2026-08-23','easy',17,'17 km rolig langtur',{intent:'long'})],config,fromDate:'2026-08-21',trigger:'training_preferences_changed'}),friday=result.rows.find(r=>r.localDate==='2026-08-21');
  assert.equal(friday.workoutType,'cross');
  assert.equal(friday.prescription.main.kind,'recovery');
  assert.match(friday.prescription.legacy.detail,/Restitusjonsdag/);
  assert.doesNotMatch(friday.prescription.legacy.detail,/3:58|Serie/);
});

test('a Sunday long run blocks Monday quality across the week boundary',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js');
  const config={...baseConfig,constraints:{...baseConfig.constraints,runDays:[0,1,2,3,4,6],qualityDays:[0,3],longRunDay:6,alternativeDays:[5],maxRunDays:6}};
  const result=generateGoalPlan(config,'2026-08-24'),first=result.rows.filter(r=>r.localDate>='2026-08-24'&&r.localDate<='2026-08-30'),second=result.rows.filter(r=>r.localDate>='2026-08-31'&&r.localDate<='2026-09-06');
  assert.equal(result.validation.valid,true,JSON.stringify(result.validation.issues));
  assert.ok(first.some(r=>r.localDate==='2026-08-30'&&r.intent==='long'));
  assert.notEqual(second.find(r=>r.localDate==='2026-08-31')?.workoutType,'quality');
});

test('normal full weeks still hit the canonical target without exceeding long-run cap',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v1027/plan-engine.js');
  const config={profile:{baseKm:50,normalLow:50,normalHigh:55,upperLimit:55,targetWeeklyVolume:50},constraints:{runDays:[0,1,2,3,5,6],qualityDays:[1,3],longRunDay:6,alternativeDays:[4],maxRunDays:6,weeklyKmCap:55},goal:{mode:'base',distance:'half',date:'',name:''}},result=generateGoalPlan(config,'2026-08-24'),week=result.rows.filter(r=>r.localDate>='2026-08-24'&&r.localDate<='2026-08-30'),long=week.find(r=>r.intent==='long');
  assert.equal(result.validation.valid,true,JSON.stringify(result.validation.issues));
  assert.equal(week.filter(r=>r.sport==='running').reduce((sum,r)=>sum+r.plannedDistanceM/1000,0),50);
  assert.ok(long.plannedDistanceM/1000<=18);
});
