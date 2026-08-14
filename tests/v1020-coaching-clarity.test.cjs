const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const model=require('../runnerbear-v1020-coach-model.js');

test('v10.20 derives contiguous, non-overlapping personal intensity ranges',()=>{
  const result=model.deriveIntensityRanges({thresholdHr:173,maxHr:188});
  assert.equal(model.validateIntensityRanges(result),true);
  assert.deepEqual(result.ranges.map(x=>[x.key,x.min,x.max]),[
    ['recovery',null,132],
    ['easy',133,149],
    ['grey',150,159],
    ['threshold',160,173],
    ['above_threshold',174,null]
  ]);
  for(let bpm=80;bpm<=220;bpm+=1){
    const matches=result.ranges.filter(x=>(x.min==null||bpm>=x.min)&&(x.max==null||bpm<=x.max));
    assert.equal(matches.length,1,`${bpm} bpm must belong to exactly one displayed range`);
  }
});

test('v10.20 range invariant holds across plausible profiles',()=>{
  for(const profile of [{thresholdHr:160,maxHr:180},{thresholdHr:173,maxHr:188},{thresholdHr:184,maxHr:201},{thresholdHr:0,maxHr:195}]){
    assert.equal(model.validateIntensityRanges(model.deriveIntensityRanges(profile)),true,JSON.stringify(profile));
  }
});

test('coach decision and readiness use one centralized status scale',()=>{
  assert.deepEqual(model.coachDecision({rawLevel:'green',healthTone:'green',hasRecoverySignals:true}).readiness,{score:8,label:'Klar',copy:'Det er trygt å følge dagens plan.'});
  const margin=model.coachDecision({rawLevel:'green',healthTone:'neutral',hasRecoverySignals:false,message:'Alt er grønt.'});
  assert.equal(margin.key,'plan_margin');
  assert.match(margin.message,/ekstra kontroll/i);
  assert.equal(model.coachDecision({rawLevel:'red',healthTone:'yellow',hasRecoverySignals:true}).key,'adjust_day');
  assert.equal(model.coachDecision({rawLevel:'red',healthTone:'red',hasRecoverySignals:true}).key,'prioritize_recovery');
});

test('calendar day model covers required states',()=>{
  const base={today:'2026-08-14'};
  assert.equal(model.dayState({...base,date:'2026-08-15',planType:'quality'}).code,'planned');
  assert.equal(model.dayState({...base,date:'2026-08-11',planType:'quality'}).code,'missed');
  assert.equal(model.dayState({...base,date:'2026-08-11',planType:'quality',hasActivity:true}).code,'completed');
  assert.equal(model.dayState({...base,date:'2026-08-11',planType:'quality',hasActivity:true,deviates:true}).code,'completed_deviation');
  assert.equal(model.dayState({...base,date:'2026-08-16',planType:'rest'}).code,'rest');
  assert.equal(model.dayState({...base,date:'2026-08-16',planType:'cross'}).code,'alternative');
  assert.equal(model.dayState({...base,date:'2026-08-11',planType:'cross'}).code,'missed');
});

test('locked v10.20 interaction copy replaces the old competing actions',()=>{
  const root=path.resolve(__dirname,'..');
  const ui=fs.readFileSync(path.join(root,'runnerbear-v107-coach-os.js'),'utf8');
  assert.doesNotMatch(ui,/Start økt/);
  assert.doesNotMatch(ui,/Se grunnlaget/);
  assert.doesNotMatch(ui,/\bSone [1-5]\b/);
  assert.match(ui,/Hvorfor\?/);
  assert.match(ui,/data-rb1020-workout-open/);
  assert.match(ui,/data-rb1020-day-close/);
  assert.match(ui,/Hvordan beregnes dette\?/);
});
