const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const model=require('../runnerbear-v1022-readiness.js');
const plan={type:'quality',title:'20 × 45/15',desc:'Kontrollert kvalitet',detail:'Samme fart gjennom serien.',km:10,shoe:'Evo SL'};

test('fresh plus normal recovery keeps the plan',()=>{
  const result=model.dailyReadiness({subjective:{state:'fresh'},recovery:{available:true,level:'green'},training:{nextWorkoutType:'quality'}},plan);
  assert.equal(result.severity,'green');
  assert.equal(result.key,'plan_stands');
  assert.equal(result.proposed.changed,false);
});

test('one tired signal reduces quality volume without increasing intensity',()=>{
  const result=model.dailyReadiness({subjective:{state:'tired'},recovery:{available:true,level:'green'}},plan);
  assert.equal(result.severity,'yellow');
  assert.equal(result.key,'plan_margin');
  assert.match(result.proposed.title,/15 × 45\/15/);
  assert.ok(result.proposed.km<plan.km);
  assert.match(result.proposed.detail,/ikke øk farten/i);
});

test('tired plus reported poor sleep adjusts a quality day',()=>{
  const result=model.dailyReadiness({subjective:{state:'tired',reasons:['poor_sleep']},recovery:{available:true,level:'green'}},plan);
  assert.equal(result.severity,'orange');
  assert.equal(result.key,'adjust_day');
  assert.equal(result.proposed.type,'easy');
  assert.match(result.proposed.title,/35 min svært rolig/i);
});

test('poor sleep plus low HRV prioritizes recovery',()=>{
  const result=model.dailyReadiness({subjective:{state:'tired',reasons:['poor_sleep']},recovery:{available:true,level:'yellow',flags:['hrv'],hrvLow:true}},plan);
  assert.equal(result.severity,'red');
  assert.equal(result.key,'prioritize_recovery');
  assert.equal(result.proposed.type,'rest');
});

test('Achilles overrides freshness with a low-impact proposal',()=>{
  const result=model.dailyReadiness({subjective:{state:'fresh'},recovery:{available:true,level:'green'},injury:{achilles:true}},plan);
  assert.equal(result.severity,'red');
  assert.equal(result.proposed.type,'cross');
  assert.match(result.proposed.title,/Concept2/);
  assert.match(result.proposed.detail,/Ingen treningsgjeld/i);
});

test('illness never proposes quality',()=>{
  const result=model.dailyReadiness({subjective:{state:'tired',reasons:['illness']}},plan);
  assert.equal(result.severity,'red');
  assert.equal(result.proposed.type,'rest');
  assert.doesNotMatch(result.proposed.title,/45\/15/);
});

test('all supported subjective causes normalize into one readiness input',()=>{
  const reasons=['poor_sleep','fatigue','heavy_legs','stress','illness','achilles'];
  const input=model.normalizeReadinessInput({subjective:{state:'tired',reasons:[...reasons,'unknown']}});
  assert.deepEqual(input.subjective.reasons,reasons);
  assert.equal(input.injury.achilles,true);
});

test('reduced quality keeps the workout type and never increases intensity',()=>{
  const result=model.dailyReadiness({subjective:{state:'tired'}},plan);
  assert.equal(result.proposed.type,'quality');
  assert.match(result.proposed.title,/15 × 45\/15/);
  assert.match(result.proposed.detail,/Kutt volum, ikke øk farten/);
  assert.equal(result.proposed.changed,true);
});

test('intensity ranges remain contiguous and distribution sums to 100',()=>{
  const legacy=require('../runnerbear-v1020-coach-model.js');
  const ranges=legacy.deriveIntensityRanges({thresholdHr:173,maxHr:188}).ranges;
  assert.equal(legacy.validateIntensityRanges(ranges),true);
  const activities=[
    {id:'run-a',date:'2026-08-14T08:00:00Z',sportType:'running',duration:1000,distance:3000,detail:{heartRateBins:[[120,180],[140,610],[155,100],[165,90],[180,20]]}},
    {id:'row-a',date:'2026-08-13T08:00:00Z',sportType:'rowing',duration:1000,distance:4000,detail:{heartRateBins:[[165,1000]]}},
    {id:'bike-a',date:'2026-08-12T08:00:00Z',sportType:'cycling',duration:1000,distance:20000,detail:{heartRateBins:[[155,1000]]}},
  ];
  const result=model.intensityDistribution({activities,ranges,now:new Date('2026-08-14T12:00:00Z')});
  assert.equal(result.available,true);
  assert.equal(result.totalActivities,1);
  assert.equal(result.coveredActivities,1);
  assert.equal(result.rows.reduce((sum,row)=>sum+row.percent,0),100);
  assert.deepEqual(result.rows.map(row=>row.seconds),[180,610,100,90,20]);
});

test('duplicate activities are counted once across sources',()=>{
  const legacy=require('../runnerbear-v1020-coach-model.js'),ranges=legacy.deriveIntensityRanges({thresholdHr:173,maxHr:188}).ranges,base={date:'2026-08-14T08:00:00Z',sportType:'running',duration:600,distance:2000,detail:{heartRateBins:[[140,600]]}};
  const result=model.intensityDistribution({activities:[{...base,id:'garmin-1'},{...base,id:'tredict-9'}],ranges,now:new Date('2026-08-14T12:00:00Z')});
  assert.equal(result.totalActivities,1);
  assert.equal(result.totalValidSeconds,600);
});

test('summary heart rate cannot fabricate zone time',()=>{
  const legacy=require('../runnerbear-v1020-coach-model.js'),ranges=legacy.deriveIntensityRanges({thresholdHr:173,maxHr:188}).ranges;
  const result=model.intensityDistribution({activities:[{id:'summary-only',date:'2026-08-14',sportType:'running',duration:3600,distance:10000,heartrate:150,heartrateMax:174}],ranges,now:new Date('2026-08-14T12:00:00Z')});
  assert.equal(result.available,false);
  assert.equal(result.coveredActivities,0);
  assert.equal(result.totalValidSeconds,0);
  assert.ok(result.rows.every(row=>row.percent===0));
});

test('rolling window excludes old and merely planned runs',()=>{
  const ranges=model.deriveIntensityRanges({thresholdHr:173,maxHr:188}).ranges;
  const activities=[
    {id:'recent',date:'2026-08-14',sportType:'running',duration:900,distance:3000,detail:{heartRateBins:[[140,900]]}},
    {id:'old',date:'2026-07-17',sportType:'running',duration:900,distance:3000,detail:{heartRateBins:[[165,900]]}},
    {id:'planned',date:'2026-08-13',sportType:'running',status:'planned',duration:900,distance:3000,detail:{heartRateBins:[[180,900]]}},
  ];
  const result=model.intensityDistribution({activities,ranges,now:new Date('2026-08-14T12:00:00Z')});
  assert.equal(result.totalActivities,1);
  assert.equal(result.totalValidSeconds,900);
  assert.equal(result.rows.find(row=>row.key==='easy').seconds,900);
});

test('Concept2, Zwift and strength are all excluded',()=>{
  const ranges=model.deriveIntensityRanges({thresholdHr:173,maxHr:188}).ranges;
  const activities=['rowing','cycling','strength'].map((sportType,index)=>({id:`other-${index}`,date:'2026-08-14',sportType,duration:900,distance:3000,detail:{heartRateBins:[[165,900]]}}));
  const result=model.intensityDistribution({activities,ranges,now:new Date('2026-08-14T12:00:00Z')});
  assert.equal(result.totalActivities,0);
  assert.equal(result.totalValidSeconds,0);
  assert.equal(result.available,false);
});

test('v10.23 UI keeps user control and removes fake intensity widths',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1023.js'),'utf8');
  assert.match(ui,/Form i dag/);
  assert.match(ui,/data-rb1022-accept/);
  assert.match(ui,/data-rb1022-keep/);
  assert.match(ui,/Behold planlagt økt/);
  assert.match(ui,/runnerbear_v1022_daily_readiness/);
  const areas=ui.slice(ui.indexOf('function intensityCardHtml'),ui.indexOf('function intensityDistributionCardHtml'));
  assert.doesNotMatch(areas,/x\.width/);
  assert.doesNotMatch(areas,/style="width:/);
  assert.match(ui,/Snittpuls og makspuls brukes ikke/);
});

test('keeping the planned workout removes only the explicit readiness adjustment',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1023.js'),'utf8');
  const keep=ui.slice(ui.indexOf('function keepPlannedWorkout'),ui.indexOf('function bind('));
  assert.match(keep,/clearReadinessAdjustment\(p\)/);
  assert.match(keep,/choice:'keep'/);
  assert.doesNotMatch(keep,/all\[p\.sourceLabel\]=/);
});

test('readiness never creates automatic quality debt',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1023.js'),'utf8');
  const autopilot=ui.slice(ui.indexOf('function runAutopilot'),ui.indexOf('function migrateDocumentedThreshold'));
  assert.match(autopilot,/user must explicitly accept/i);
  assert.match(autopilot,/return;/);
  assert.doesNotMatch(autopilot,/write\(K\.(?:adjustments|moves)/);
});

test('intensity profile selects latest threshold history and profile max HR',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1023.js'),'utf8');
  const profile=ui.slice(ui.indexOf('function intensityProfile'),ui.indexOf('function rangeLabel'));
  assert.match(profile,/latest=history\.at\(-1\)/);
  assert.match(profile,/latest\?\.hr\|\|profile\.thresholdHr/);
  assert.match(profile,/maxHr=Number\(profile\.maxHr/);
  assert.match(profile,/thresholdDate:latest\?\.date/);
});

test('Tredict detail compiler stores real HR time bins for recent runs',()=>{
  const bridge=fs.readFileSync(path.join(root,'cloudflare/runnerbear-tredict-worker.mjs'),'utf8');
  assert.match(bridge,/function heartRateBins/);
  assert.match(bridge,/heartRateBins:bins/);
  assert.match(bridge,/validHeartRateSeconds/);
  assert.match(bridge,/daysAgo\(28\)/);
});
