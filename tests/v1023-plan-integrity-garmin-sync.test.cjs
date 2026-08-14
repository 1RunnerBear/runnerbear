const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const rules=require('../runnerbear-v1023-plan-integrity.js');
const readiness=require('../runnerbear-v1022-readiness.js');
const quality={type:'quality',title:'20 × 45/15',desc:'Kontrollert terskel',detail:'Jevne drag.',km:10};

function workout(overrides={}){
  return{workoutId:'2026-08-17',baseDs:'2026-08-17',originalDate:'2026-08-17',date:'2026-08-17',type:'easy',title:'8 km rolig',km:8,structure:[{type:'warmup',minutes:10}],...overrides};
}
function event(type,value,detail={}){return rules.planEvent(type,value,{newDate:value.date,...detail})}
function timerHarness(){const calls=[];return{calls,setTimer:fn=>{calls.push(fn);return calls.length},clearTimer:()=>{}}}

test('session status distinguishes completed, replaced, planned, moved, expired and cancelled',()=>{
  const easy={type:'easy',title:'8 km rolig',km:8,baseDs:'2026-08-17',ds:'2026-08-17'};
  const run={id:'run-1',date:'2026-08-17',sportType:'running',title:'Rolig løp',distance:7900,duration:2800,heartrate:136};
  assert.equal(rules.classifySession({plan:easy,activity:run,today:'2026-08-17'}).code,'completed');
  assert.equal(rules.classifySession({plan:easy,activity:{...run,id:'row-1',sportType:'rowing',title:'Concept2',distance:8500,power:155},today:'2026-08-17'}).code,'replaced');
  assert.equal(rules.classifySession({plan:easy,today:'2026-08-16'}).code,'planned');
  assert.equal(rules.classifySession({plan:{...easy,ds:'2026-08-19'},today:'2026-08-18'}).code,'moved');
  assert.equal(rules.classifySession({plan:easy,today:'2026-08-18'}).code,'expired');
  assert.equal(rules.classifySession({plan:easy,today:'2026-08-16',cancelled:true}).code,'cancelled');
});

test('activity on the original date cannot complete a workout moved to another date',()=>{
  const plan={type:'easy',title:'8 km rolig',km:8,baseDs:'2026-08-17',ds:'2026-08-19'};
  const oldDateRun={id:'run-old',date:'2026-08-17',sportType:'running',title:'Rolig løp',distance:8000,heartrate:135};
  const status=rules.classifySession({plan,activity:oldDateRun,today:'2026-08-18'});
  assert.equal(status.code,'moved');
  assert.equal(status.terminal,false);
});

test('same-day cross training replaces a run without falsely completing it',()=>{
  const plan={type:'easy',title:'8 km rolig',km:8,baseDs:'2026-08-17',ds:'2026-08-17'};
  const row={id:'row-1',date:'2026-08-17',sportType:'rowing',title:'Concept2 rolig',distance:9000,duration:2700,power:160};
  const status=rules.classifySession({plan,activity:row,today:'2026-08-17'});
  assert.equal(status.code,'replaced');
  assert.equal(status.actualActivityId,'');
  assert.equal(status.replacementActivityId,'row-1');
  assert.match(status.coach.message,/tas ikke igjen/i);
  assert.match(status.coach.consequence,/Ingen treningsgjeld/i);
});

test('safe same-week swap works and undo is an exact inverse',()=>{
  const rows=[
    {baseDs:'2026-08-17',ds:'2026-08-17',week:34,type:'easy',status:'planned',locked:false},
    {baseDs:'2026-08-18',ds:'2026-08-18',week:34,type:'rest',status:'planned',locked:false},
    {baseDs:'2026-08-20',ds:'2026-08-20',week:34,type:'quality',status:'planned',locked:false},
  ];
  const moved=rules.validateSwap({rows,sourceBaseDs:'2026-08-17',targetBaseDs:'2026-08-18',today:'2026-08-16'});
  assert.equal(moved.ok,true);
  assert.equal(moved.rows.find(x=>x.baseDs==='2026-08-17').ds,'2026-08-18');
  const undone=rules.validateSwap({rows:moved.rows,sourceBaseDs:'2026-08-17',targetBaseDs:'2026-08-18',today:'2026-08-16'});
  assert.deepEqual(undone.rows,rows);
});

test('swap rejects cross-week, locked, terminal and adjacent-quality moves',()=>{
  const base=[
    {baseDs:'mon',ds:'2026-08-17',week:34,type:'quality',status:'planned',locked:false},
    {baseDs:'wed',ds:'2026-08-19',week:34,type:'rest',status:'planned',locked:false},
    {baseDs:'thu',ds:'2026-08-20',week:34,type:'quality',status:'planned',locked:false},
    {baseDs:'next',ds:'2026-08-24',week:35,type:'easy',status:'planned',locked:false},
  ];
  assert.equal(rules.validateSwap({rows:base,sourceBaseDs:'mon',targetBaseDs:'wed',today:'2026-08-16'}).code,'adjacent_quality');
  assert.equal(rules.validateSwap({rows:base,sourceBaseDs:'wed',targetBaseDs:'next',today:'2026-08-16'}).code,'cross_week');
  assert.equal(rules.validateSwap({rows:base.map(x=>x.baseDs==='wed'?{...x,locked:true}:x),sourceBaseDs:'mon',targetBaseDs:'wed',today:'2026-08-16'}).code,'locked');
  assert.equal(rules.validateSwap({rows:base.map(x=>x.baseDs==='wed'?{...x,status:'completed'}:x),sourceBaseDs:'mon',targetBaseDs:'wed',today:'2026-08-16'}).code,'history');
});

test('daily readiness covers all locked release scenarios without quality debt',()=>{
  assert.equal(readiness.dailyReadiness({subjective:{state:'fresh'},recovery:{available:true,level:'green'}},quality).severity,'green');
  assert.equal(readiness.dailyReadiness({subjective:{state:'tired'}},quality).severity,'yellow');
  assert.equal(readiness.dailyReadiness({subjective:{state:'heavy'}},quality).proposed.type,'rest');
  assert.equal(readiness.dailyReadiness({subjective:{state:'tired',reasons:['poor_sleep']}},quality).proposed.type,'easy');
  assert.equal(readiness.dailyReadiness({subjective:{state:'tired',reasons:['illness']}},quality).proposed.type,'rest');
  assert.equal(readiness.dailyReadiness({subjective:{state:'fresh',reasons:['achilles']}},quality).proposed.type,'cross');
});

test('stable Garmin identity survives moves while the workout hash changes',()=>{
  const original=workout(),moved=workout({date:'2026-08-19'});
  assert.equal(rules.stableExternalId(original),rules.stableExternalId(moved));
  assert.notEqual(rules.workoutHash(original),rules.workoutHash(moved));
});

test('Garmin sync sends move events and coalesces unchanged updates',async()=>{
  const calls=[],timers=timerHarness(),service=rules.createGarminSyncService({storage:rules.memoryStorage(),transport:{available:true,trainingApi:true,syncWorkout:async payload=>{calls.push(payload);return{workoutId:`garmin-${calls.length}`}}},setTimer:timers.setTimer,clearTimer:timers.clearTimer,debounceMs:0});
  const moved=workout({date:'2026-08-19'}),moveEvent=event('plan:workout-moved',moved,{previousDate:'2026-08-17'});
  service.queue(moveEvent,moved);await service.flush();
  assert.equal(calls.length,1);assert.equal(calls[0].operation,'reschedule');assert.equal(service.status(rules.stableExternalId(moved)).status,'synced');
  const duplicate=service.queue(moveEvent,moved);await service.flush();
  assert.equal(duplicate.idempotent,true);assert.equal(calls.length,1);
});

test('swapping two days emits two Garmin reschedules and inverse undo updates',async()=>{
  const calls=[],service=rules.createGarminSyncService({storage:rules.memoryStorage(),transport:{available:true,trainingApi:true,syncWorkout:async payload=>{calls.push(payload);return{}}},setTimer:()=>1,clearTimer:()=>{},debounceMs:0});
  const a=workout({date:'2026-08-18'}),b=workout({workoutId:'2026-08-18',baseDs:'2026-08-18',originalDate:'2026-08-18',date:'2026-08-17',title:'Hvile',type:'rest',km:0});
  service.queue(event('plan:workout-moved',a,{previousDate:'2026-08-17'}),a);service.queue(event('plan:workout-moved',b,{previousDate:'2026-08-18'}),b);await service.flush();
  assert.equal(calls.length,2);assert.ok(calls.every(x=>x.operation==='reschedule'));
  const undoA={...a,date:'2026-08-17'},undoB={...b,date:'2026-08-18'};
  service.queue(event('plan:workout-moved',undoA,{previousDate:'2026-08-18'}),undoA);service.queue(event('plan:workout-moved',undoB,{previousDate:'2026-08-17'}),undoB);await service.flush();
  assert.equal(calls.length,4);
});

test('sync failure preserves local plan, exposes retry and recovers',async()=>{
  const storage=rules.memoryStorage(),timers=timerHarness();storage.setItem('runnerbear_plan_fixture',JSON.stringify({date:'2026-08-19',title:'8 km rolig'}));let attempts=0;
  const service=rules.createGarminSyncService({storage,transport:{available:true,trainingApi:true,syncWorkout:async()=>{attempts++;if(attempts===1)throw new Error('temporary Garmin failure');return{workoutId:'g-1'}}},setTimer:timers.setTimer,clearTimer:timers.clearTimer,retryDelays:[0,0],debounceMs:0});
  const value=workout({date:'2026-08-19'}),id=rules.stableExternalId(value);service.queue(event('plan:workout-moved',value,{previousDate:'2026-08-17'}),value);await service.flush();
  assert.equal(service.status(id).status,'error');assert.match(service.status(id).lastError,/temporary Garmin failure/);assert.deepEqual(JSON.parse(storage.getItem('runnerbear_plan_fixture')),{date:'2026-08-19',title:'8 km rolig'});
  assert.equal(service.retry(id),1);await service.flush();assert.equal(service.status(id).status,'synced');assert.equal(attempts,2);
});

test('pending queue survives reload and syncs when Training API becomes available',async()=>{
  const storage=rules.memoryStorage(),value=workout(),id=rules.stableExternalId(value),blocked=rules.createGarminSyncService({storage,transport:{available:false,trainingApi:false},setTimer:()=>1,clearTimer:()=>{}});
  blocked.queue(event('plan:workout-adjusted',value),value);assert.equal(blocked.status(id).status,'not_synced');assert.equal(blocked.all().queue.length,1);
  const calls=[],resumed=rules.createGarminSyncService({storage,transport:{available:true,trainingApi:true,syncWorkout:async payload=>{calls.push(payload);return{}}},setTimer:()=>1,clearTimer:()=>{}});resumed.init();await resumed.flush();
  assert.equal(calls.length,1);assert.equal(resumed.status(id).status,'synced');assert.equal(resumed.all().queue.length,0);
});

test('v10.23 UI exposes honest auto-sync, mobile long press and accessible fallback',()=>{
  const ui=fs.readFileSync(path.join(root,'runnerbear-ui-v1023.js'),'utf8'),css=fs.readFileSync(path.join(root,'runnerbear-v1023.css'),'utf8');
  assert.match(ui,/Frisk/);assert.match(ui,/Litt redusert/);assert.match(ui,/Klart redusert/);
  assert.match(ui,/setTimeout\(\(\)=>\{if\(beginDrag\(row,'mobile'\)\).*\},380\)/);
  assert.match(ui,/data-rb107-move-to/);assert.match(ui,/validateSwap/);assert.match(ui,/Angre/);
  assert.match(ui,/Garmin kalenderpublisering venter på Training API-tilgang/);assert.match(ui,/Kalenderdiagnostikk \/ Tredict-fallback/);
  assert.match(ui,/runnerbear:state-dirty/);assert.match(fs.readFileSync(path.join(root,'cloud/runnerbear-cloud/src/index.js'),'utf8'),/runnerbear_v1023_garmin_sync/);
  assert.doesNotMatch(ui,/Send til Garmin/);
  assert.match(css,/rb1023-drop-valid/);assert.match(css,/prefers-reduced-motion/);
});
