const test=require('node:test');
const assert=require('node:assert/strict');
const {structuredWorkout,assessSession,selectComparableSessions,matchAllowed}=require('../runnerbear-v1012-analysis.js');

const sixBySix={type:'quality',title:'6 × 6 min subterskel',desc:'60 s rolig jogg. Totalt ca. 13 km.',detail:'Start ca. 4:10–4:12/km og jobb kontrollert mot 4:03–4:05. Puls hovedsakelig 160–170.',km:13,ds:'2026-08-11'};
const blocks=(durations)=>durations.map((duration,index)=>({index:index+1,duration,pace:248-index,hr:164+index*.5}));
const run=({distance=13_000,workBlocks=blocks([360,360,360,360,360,360]),confidence='high',workHr=166,workPace=245,hrDrift=4,heartrate=160}={})=>({id:'run-1',sportType:'running',duration:4500,distance,heartrate,detail:{analysis:{workBlocks,confidence,workHr,workPace,hrDrift,workDuration:workBlocks.reduce((sum,x)=>sum+x.duration,0)}}});

test('structured 6 × 6 model separates main work from the 12–14 km total corridor',()=>{
  const model=structuredWorkout(sixBySix);
  assert.equal(model.mainLabel,'6 × 6 min subterskel');
  assert.equal(model.expectedIntervals,6);
  assert.deepEqual([model.total.low,model.total.high],[12,14]);
  assert.equal(model.recoveryLabel,'1:00 rolig jogg mellom dragene');
});

test('45/15 structure preserves series recovery and race times are not parsed as pace',()=>{
  const intervals=structuredWorkout({type:'quality',title:'3 × 10 × 45/15',desc:'2 min rolig mellom seriene. Totalt ca. 10 km.',detail:'Serie 1 ~3:58, serie 2 ~3:53, serie 3 ~3:48–3:52 hvis kontroll.',km:10});
  assert.equal(intervals.expectedIntervals,30);
  assert.match(intervals.recoveryLabel,/2:00 rolig jogg mellom seriene/);
  const race=structuredWorkout({type:'race',title:'RUNFEST 21K',detail:'A: 1:23 dersom alt er grønt. B: ca. 1:24–1:25 ellers.',km:21.1});
  assert.equal(race.paceLabel,'Lett');
});

test('six confirmed 6-minute reps produce a high-confidence planned result',()=>{
  const result=assessSession({plan:sixBySix,activity:run()});
  assert.equal(result.code,'planned');
  assert.equal(result.confidence.code,'high');
  assert.equal(result.confidence.confirmed,6);
  assert.match(result.review,/6 planlagte arbeidsdrag er bekreftet/);
});

test('a seventh short period is reported as extra and never as 7 of about 6',()=>{
  const result=assessSession({plan:sixBySix,activity:run({workBlocks:blocks([360,360,360,360,360,360,75])})});
  assert.equal(result.code,'planned');
  assert.equal(result.confidence.confirmed,6);
  assert.equal(result.confidence.extras,1);
  assert.match(result.review,/Én kortere arbeidsperiode/);
  assert.doesNotMatch(result.review,/7 av omtrent 6/);
});

test('15.6 km is measured 1.6 km above the corridor rather than 20 percent above 13 km',()=>{
  const result=assessSession({plan:sixBySix,activity:run({distance:15_600})});
  assert.equal(result.code,'controlled');
  assert.equal(Number(result.deltaKm.toFixed(1)),1.6);
  assert.match(result.review,/1,6 km over planens øvre ramme/);
});

test('quality without a detected work section has limited confidence and no full-hit verdict',()=>{
  const result=assessSession({plan:sixBySix,activity:run({workBlocks:[],confidence:'summary',workHr:0,workPace:0})});
  assert.equal(result.code,'limited');
  assert.equal(result.title,'Begrenset analysegrunnlag');
  assert.doesNotMatch(`${result.title} ${result.review}`,/Fulltreff/);
});

test('three of six confirmed reps are classified as partially completed',()=>{
  const result=assessSession({plan:sixBySix,activity:run({distance:8_500,workBlocks:blocks([360,360,360]),confidence:'medium'})});
  assert.equal(result.code,'partial');
  assert.equal(result.status.label,'Delvis gjennomført');
});

test('an easy run above 76 percent of max HR becomes a controlled deviation',()=>{
  const plan={type:'easy',title:'7 km rolig',detail:'HR ca. 130–142.',km:7,ds:'2026-08-12'};
  const result=assessSession({plan,activity:run({distance:7_000,workBlocks:[],workHr:0,workPace:0,heartrate:145}),maxHr:188});
  assert.equal(result.code,'controlled');
  assert.match(result.title,/høyere kostnad/);
});

test('Concept2 is accepted as the completed flexible aerobic alternative',()=>{
  const plan={type:'cross',title:'Concept2 lett / hvile',desc:'30–40 min meget rolig eller full hvile.',km:0,ds:'2026-08-15',flexible:true};
  const activity={id:'row-1',sportType:'misc',subSportType:'generic',title:'Concept2 RowErg',duration:2100,distance:8000,power:170,heartrate:130};
  const result=assessSession({plan,activity,flexible:true,maxHr:188});
  assert.equal(result.code,'planned');
  assert.match(result.title,/Concept2/);
  assert.match(result.consequence,/Ingen joggetur/);
});

test('comparisons require the same workout family, and an excluded Garmin activity cannot rematch',()=>{
  const sessions=[
    {plan:{...sixBySix,ds:'2026-08-01'},activity:run()},
    {plan:{type:'easy',title:'7 km rolig',km:7,ds:'2026-08-05'},activity:run({distance:7000,workBlocks:[]})}
  ];
  assert.equal(selectComparableSessions({...sixBySix,ds:'2026-08-11'},sessions,'run').length,1);
  assert.equal(matchAllowed({activityId:'wrong',excludedId:'wrong'}),false);
  assert.equal(matchAllowed({activityId:'correct',excludedId:'wrong'}),true);
});
