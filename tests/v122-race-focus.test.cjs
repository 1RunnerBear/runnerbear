const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const race=require('../runnerbear-v122-race-focus.js');
const calm=require('../runnerbear-v121-calm-flow.js');
const now=Date.parse('2026-09-28T10:00:00Z');
function fixture(at=now,date='2026-10-03'){
  const goal={id:'runfest-2026',name:'Runfest Sandnes',date,distance:'half',targetSeconds:4980,status:'active'};
  const item=(id,localDate,status='scheduled')=>({workoutId:id,planRevisionId:'pr-a',localDate,slotIndex:0,status,workoutType:'easy',title:id,plannedDistanceM:6000});
  return {now:at,goal,snapshot:{planRevisionId:'pr-a',flags:{coach_loop_ui:true},config:{timezone:'Europe/Oslo',goal:{...goal,mode:'race'}},activePlan:{planRevisionId:'pr-a',status:'active',items:[item('old','2026-09-25'),item('done','2026-09-28','completed'),item('next','2026-09-30'),item('race','2026-10-03'),item('after','2026-10-04')]},oneDecision:{version:'one-decision-2',planRevisionId:'pr-a',generatedAt:new Date(at).toISOString(),validUntil:new Date(at+3600000).toISOString(),freshness:'current',state:'follow',safety:{planWritesByAi:false}},bodyResponse:{version:'body-response-1',planRevisionId:'pr-a',state:'as_planned',freshness:{status:'fresh'},checkIn:{required:false},reasonCodes:[]}}};
}
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
test('Race Focus is read-only and selects only remaining final-week canonical sessions',()=>{
 const input=fixture(),before=JSON.stringify(input),view=race.model(input);
 assert.equal(view.available,true);assert.equal(view.phase,'week');assert.equal(view.days,5);assert.equal(view.todayVisible,true);
 assert.deepEqual(view.items.map(item=>item.workoutId),['next','race']);assert.equal(JSON.stringify(input),before);
 assert.doesNotMatch(fs.readFileSync('runnerbear-v122-race-focus.js','utf8'),/fetch\(|dispatchEvent|reconfigure\(|removeItem\(|setInterval/);
});
for(const [days,date,phase,visible] of [[25,'2026-10-23','preview',false],[8,'2026-10-06','preview',false],[7,'2026-10-05','week',true],[2,'2026-09-30','week',true],[1,'2026-09-29','eve',true],[0,'2026-09-28','race',true]])test(`calendar phase at ${days} days: ${phase}`,()=>{const view=race.model(fixture(now,date));assert.equal(view.days,days);assert.equal(view.phase,phase);assert.equal(view.todayVisible,visible)});
test('race mode ends after race date and never promotes a secondary race',()=>{const f=fixture(now,'2026-09-27');f.snapshot.config.goal.secondary=[{date:'2026-10-03',distance:'half'}];assert.equal(race.model(f).available,false)});
test('configured timezone, not browser timezone or UTC, controls race day',()=>{
 const f=fixture(Date.parse('2026-10-02T22:30:00Z'));assert.equal(race.model(f).phase,'race');
 f.snapshot.config.timezone='America/Los_Angeles';assert.equal(race.model(f).phase,'eve');
});
test('calendar differences survive both DST transitions and leap day',()=>{
 assert.equal(race.model(fixture(Date.parse('2026-03-28T11:00:00Z'),'2026-03-30')).days,2);
 assert.equal(race.model(fixture(Date.parse('2026-10-24T10:00:00Z'),'2026-10-26')).days,2);
 assert.equal(race.model(fixture(Date.parse('2028-02-28T11:00:00Z'),'2028-03-01')).days,2);
 assert.equal(race.day('2026-02-29'),null);assert.equal(race.day('2026-02-30'),null);assert.equal(race.day('2026-9-28'),null);
});
for(const [label,mutate] of [
 ['missing snapshot',f=>{f.snapshot=null}],['missing local goal',f=>{f.goal=null}],
 ['changed date',f=>{f.goal.date='2026-10-04'}],['changed name',f=>{f.goal.name='Another race'}],['changed distance',f=>{f.goal.distance='ten'}],['changed target',f=>{f.goal.targetSeconds=4900}],
 ['cancelled goal',f=>{f.goal.status='cancelled'}],['paused goal',f=>{f.goal.status='paused'}],['base mode',f=>{f.snapshot.config.goal.mode='base'}],
 ['invalid date',f=>{f.goal.date=f.snapshot.config.goal.date='2026-09-31'}],['invalid timezone',f=>{f.snapshot.config.timezone='not/a/timezone'}],['missing timezone',f=>{delete f.snapshot.config.timezone}],
 ['inactive plan',f=>{f.snapshot.activePlan.status='superseded'}],['wrong plan revision',f=>{f.snapshot.activePlan.planRevisionId='pr-old'}],['wrong item revision',f=>{f.snapshot.activePlan.items[0].planRevisionId='pr-old'}],['null item',f=>{f.snapshot.activePlan.items.push(null)}],['UI disabled',f=>{f.snapshot.flags.coach_loop_ui=false}],
 ])test(`fails closed for ${label}`,()=>{const f=fixture();mutate(f);assert.equal(race.model(f).available,false)});
for(const [label,mutate] of [
 ['required check-in',f=>{f.snapshot.bodyResponse.checkIn.required=true}],['pain state',f=>{f.snapshot.bodyResponse.state='pain'}],['contradictory pain reason',f=>{f.snapshot.bodyResponse.reasonCodes=['PAIN_REPORTED']}],['illness',f=>{f.snapshot.bodyResponse.reasonCodes=['ILLNESS']}],
 ['adjustment',f=>{f.snapshot.oneDecision.state='adjust'}],['clarification',f=>{f.snapshot.oneDecision.state='clarify'}],['unknown decision',f=>{f.snapshot.oneDecision.state='unknown'}],['refresh',f=>{f.snapshot.oneDecision.state='refresh'}],
 ['stale health',f=>{f.snapshot.bodyResponse.freshness.status='stale'}],['partial health',f=>{f.snapshot.bodyResponse.freshness.status='partial'}],['stale decision',f=>{f.snapshot.oneDecision.freshness='stale'}],
 ['expired decision',f=>{f.snapshot.oneDecision.validUntil=new Date(now).toISOString()}],['missing expiry',f=>{delete f.snapshot.oneDecision.validUntil}],['yesterday decision',f=>{f.snapshot.oneDecision.generatedAt=new Date(now-86400000).toISOString()}],['future decision',f=>{f.snapshot.oneDecision.generatedAt=new Date(now+120000).toISOString()}],
 ['unverified body',f=>{f.snapshot.bodyResponse.planRevisionId='pr-other'}],['unverified decision',f=>{f.snapshot.oneDecision.planRevisionId='pr-other'}],['unknown contract',f=>{f.snapshot.oneDecision.version='unknown'}],['no safety contract',f=>{delete f.snapshot.oneDecision.safety}],['no body',f=>{delete f.snapshot.bodyResponse}],
 ])test(`safety hides target and Today support: ${label}`,()=>{const f=fixture();mutate(f);const view=race.model(f);assert.equal(view.available,true);assert.equal(view.blocked,true);assert.equal(view.target,null);assert.equal(view.todayVisible,false);assert.ok(view.safetyCopy)});
test('midnight makes yesterday’s decision stale even before its nominal expiry',()=>{const f=fixture(Date.parse('2026-10-02T21:59:00Z'));f.now=Date.parse('2026-10-02T22:01:00Z');const view=race.model(f);assert.equal(view.phase,'race');assert.equal(view.blocked,true)});
test('canonical rest and result envelopes without an expiry get a bounded 15-minute display window',()=>{for(const state of ['rest','completed','reflect']){const f=fixture();f.snapshot.oneDecision.state=state;f.snapshot.oneDecision.validUntil=null;assert.equal(race.model(f).blocked,false);f.now+=15*60000;assert.equal(race.model(f).blocked,true)}});
test('real server rest contract is accepted without fabricating a coach decision',async()=>{const {buildOneDecision}=await import('../cloud/runnerbear-cloud/src/v113/one-decision.js');const f=fixture();f.snapshot.generatedAt=new Date(now).toISOString();f.snapshot.todayWorkout={workoutId:'rest',localDate:'2026-09-28',workoutType:'rest',sport:'rest',status:'scheduled'};f.snapshot.oneDecision=buildOneDecision(f.snapshot,{now:new Date(now).toISOString()});assert.equal(f.snapshot.oneDecision.state,'rest');assert.equal(f.snapshot.oneDecision.validUntil,null);assert.equal(race.model(f).blocked,false)});
test('an empty or partial window never invents missing workouts or rest days',()=>{const f=fixture();f.snapshot.activePlan.items=[];assert.deepEqual(race.model(f).items,[]);f.snapshot.activePlan.items=[{planRevisionId:'pr-a',localDate:'2026-09-31',status:'scheduled'}];assert.deepEqual(race.model(f).items,[])});
for(const distance of ['five','ten','half','marathon'])test(`exact finish and monotonic cumulative splits: ${distance}`,()=>{const ref=race.target({distance,targetSeconds:4980});assert.equal(ref.splits.at(-1).seconds,4980);assert.equal(ref.splits.at(-1).finish,true);assert.equal(ref.splits.length,5);ref.splits.forEach((row,i)=>{if(i)assert.ok(row.seconds>ref.splits[i-1].seconds)})});
test('half marathon uses 21.0975 km and missing or invalid target is not fabricated',()=>{const ref=race.target({distance:'half',targetSeconds:4980});assert.equal(ref.paceSeconds,4980/21.0975);assert.equal(ref.splits[0].seconds,1180);for(const targetSeconds of [0,-1,NaN,Infinity,'bad',null,90000])assert.equal(race.target({distance:'half',targetSeconds}),null)});
test('checkbox identity survives target edits and revisions, never a new goal/date',()=>{
 const s=storage(),f=fixture(),key=race.model(f).key;assert.equal(race.setChecked(s,key,'watch',true),true);assert.equal(race.checked(s,key).has('watch'),true);
 assert.equal(race.identity({...f.goal,targetSeconds:5100}),key);assert.notEqual(race.identity({...f.goal,id:'new-goal'}),key);assert.notEqual(race.identity({...f.goal,date:'2026-10-04'}),key);
 assert.equal(race.checked(s,race.identity({...f.goal,id:'new-goal'})).size,0);assert.equal(race.setChecked(s,key,'watch',false),true);assert.equal(race.checked(s,key).size,0);
 assert.equal(race.setChecked(s,key,'unknown',true),false);
});
test('checkbox storage failure is explicit, malformed storage is safe, history is bounded',()=>{
 const broken={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 assert.equal(race.checked(broken,'race').size,0);assert.equal(race.setChecked(broken,'race','watch',true),false);
 const s=storage();s.setItem(race.storageKey,'{bad');assert.equal(race.checked(s,'race').size,0);
 for(let i=0;i<20;i++)race.setChecked(s,'goal-'+i,'watch',true);
 assert.equal(JSON.parse(s.getItem(race.storageKey)).length,12);assert.equal(race.checked(s,'goal-0').size,0);
});
test('device-local race checklist is excluded from compatibility upload AND hydration',()=>{
 const source=fs.readFileSync('runnerbear-cloud-v1025.js','utf8'),fn=source.slice(source.indexOf('function safeKey('),source.indexOf('function localSnapshot('));
 const safeKey=vm.runInNewContext('('+fn.trim()+')',{CACHE:'runnerbear_tredict_cache_v1',LAST:'runnerbear_tredict_last_sync'});
 assert.equal(safeKey(race.storageKey),false);assert.equal(safeKey('runnerbear_v109_goals'),true);
 assert.match(source,/if\(!safeKey\(k\)\)continue/);assert.match(source,/if\(safeKey\(k\)&&typeof v==='string'/);
});
test('transport and plan changes beat race support; race beats passive review',()=>{assert.equal(calm.chooseSupport({transport:'error',race:'race'}),'error');assert.equal(calm.chooseSupport({change:'change',race:'race'}),'change');assert.equal(calm.chooseSupport({race:'race',review:'review',priority:'week'}),'race')});
test('UI preserves a single race support slot and accessible, read-only interaction boundaries',()=>{
 const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8');assert.match(ui,/race:raceFocusEntryHtml\(true\)/);assert.match(ui,/aria-labelledby="rb122RaceTitle"/);assert.match(ui,/aria-describedby="rb122ChecklistHelp"/);assert.match(ui,/if\(raceFocusOpen\)\{closeRaceFocus\(\);return\}/);assert.match(ui,/qsa\('summary,button/);
 const handlers=ui.slice(ui.indexOf("qsa('[data-rb122-race-open]')"),ui.indexOf("qsa('[data-rb121-insight]')"));assert.doesNotMatch(handlers,/reconfigure|write\(|state-dirty|uploadLocal|queueTredict|fetch\(/);assert.match(ui,/let raceClockSignature/);
});
