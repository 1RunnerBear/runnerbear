const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const read=file=>fs.readFileSync(file,'utf8');
const planItem=(id,date,slot=0)=>({workoutId:id,planRevisionId:'pr-12',localDate:date,slotIndex:slot,status:'scheduled'});
const snapshot=items=>({
  planRevisionId:'pr-12',
  activePlan:{planRevisionId:'pr-12',status:'active',items},
  todayWorkout:items[0]||null,
  coachDecision:{planRevisionId:'pr-12'},
  bodyResponse:{planRevisionId:'pr-12'},
});

test('One Truth rejects inactive, mixed and duplicate plan identities before paint',()=>{
  const core=require('../runnerbear-v1026-coach-loop.js'),valid=snapshot([planItem('wo-a','2026-09-02'),planItem('wo-b','2026-09-03')]);
  assert.deepEqual(core.assertRevision(valid),{ok:true,planRevisionId:'pr-12',itemCount:2});
  assert.equal(core.assertRevision({...valid,activePlan:{...valid.activePlan,status:'superseded'}}).code,'INACTIVE_PLAN_REVISION');
  assert.equal(core.assertRevision({...valid,coachDecision:{planRevisionId:'pr-old'}}).code,'DECISION_REVISION_MISMATCH');
  assert.equal(core.assertRevision(snapshot([planItem('wo-a','2026-09-02'),planItem('wo-a','2026-09-03')])).code,'DUPLICATE_WORKOUT_ID');
  assert.equal(core.assertRevision(snapshot([planItem('wo-a','2026-09-02'),planItem('wo-b','2026-09-02')])).code,'DUPLICATE_PLAN_SLOT');
});

test('One Decision never turns generic weekly attention into a false required action',()=>{
  const contract=require('../runnerbear-v12-decision-contract.js'),body={state:'as_planned',stateLabel:'Innenfor normalen',summary:'Alle biomarkører er stabile.'};
  const follow=contract.presentation({decision:{state:'follow',primaryAction:{kind:'open_workout'}},body,brief:{attention:'action'}});
  assert.equal(follow.actionRequired,false);assert.equal(follow.weekTone,'normal');assert.equal(follow.weekStatus,'Planen står');
  const adjust=contract.presentation({decision:{state:'adjust',primaryAction:{kind:'review_adjustment'},proposal:{}},body,brief:{attention:'normal'}});
  assert.equal(adjust.actionRequired,true);assert.equal(adjust.weekStatus,'Handling kreves');assert.match(adjust.healthSummary,/samlet belastning og treningsrespons/);
  const clarify=contract.presentation({decision:{state:'clarify',primaryAction:{kind:'complete_checkin'}},body});
  assert.equal(clarify.actionRequired,true);assert.match(clarify.healthSummary,/ett kort svar/);
});

test('canonical Cloud load performs no parallel legacy bootstrap or client sync timer',()=>{
  const listeners={},fetches=[],storage=new Map(),classList={add(){},remove(){},toggle(){}};
  const window={RunnerBearRelease:{build:'12.0.0'},RunnerBearCloudV11:{refresh:async()=>({})},RunnerBearV1025:{},addEventListener:(name,fn)=>{listeners[name]=fn},dispatchEvent(){}};
  const document={hidden:false,documentElement:{classList},querySelector:()=>null,getElementById:()=>null,addEventListener:(name,fn)=>{listeners[`document:${name}`]=fn},body:{appendChild(){}}};
  const context={window,document,location:{origin:'https://app.runnerbear.workers.dev',hostname:'app.runnerbear.workers.dev',search:'',href:'https://app.runnerbear.workers.dev/'},localStorage:{get length(){return storage.size},key:index=>[...storage.keys()][index]||null,getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},sessionStorage:{},fetch:async(...args)=>{fetches.push(args);return{ok:true,json:async()=>({})}},MutationObserver:class{observe(){}},URL,URLSearchParams,JSON,Date,Number,String,Object,Array,Map,Set,Math,Promise,console:{info(){},warn(){},error(){}},setTimeout,clearTimeout,setInterval:()=>{throw new Error('canonical mode must not create an interval')},clearInterval,performance:{now:()=>0}};
  vm.runInNewContext(read('runnerbear-cloud-v1025.js'),context);
  assert.equal(typeof listeners.load,'function');listeners.load();
  assert.equal(fetches.length,0);
  assert.equal(window.RunnerBearCloud.build,'12.0.0');
  assert.equal(typeof window.RunnerBearCloud.hydrateState,'function');
});

test('v12 UI keeps week first, month explicit and Concept 1 responsive',()=>{
  const ui=read('runnerbear-ui-v11-source.js'),css=read('runnerbear-v12-concept-one.css');
  assert.match(ui,/monthOpen:false/);
  assert.match(ui,/aria-expanded="\$\{state\.monthOpen\}" aria-controls="rb119cMonth"/);
  assert.match(ui,/state\.monthOpen\?monthCalendarHtml\(\):''/);
  assert.match(ui,/state\.monthOpen=!state\.monthOpen/);
  assert.match(ui,/\$\{completedEasy\}<\/b> av \$\{plannedEasy\.length\} rolige økter/);
  assert.match(ui,/canonicalAt=snapshot\?\.syncSource\?\.last_synced_at/);
  assert.match(css,/\.rb119b-plan,[\s\S]*max-width:920px/);
  assert.match(css,/locked Concept 1/);
});

test('v12 release, cache and state hydration use one current contract',()=>{
  const manifest=JSON.parse(read('runnerbear-v11-assets.json')),version=JSON.parse(read('runnerbear-version.json')),html=read('index.html'),headers=read('_headers'),readModel=read('cloud/runnerbear-cloud/src/v11/read-model.js'),healthGate=read('scripts/verify-v116-health.mjs');
  assert.equal(manifest.build,'12.0.0');assert.equal(version.build,'12.0.0');
  assert.equal(manifest.core[0],'runnerbear-v12-release.js');assert.ok(manifest.core.includes('runnerbear-v12-decision-contract.js'));
  assert.match(html,/runnerbear-core-v11\.js\?v=12000/);assert.match(html,/runnerbear-data-v11\.js\?v=12000/);
  for(const asset of ['runnerbear-core-v11.js','runnerbear-ui-v11.js','runnerbear-data-v11.js','runnerbear-v11.css'])assert.match(headers,new RegExp(`/${asset.replaceAll('.','\\.')}[\\s\\S]*immutable`));
  assert.match(headers,/\/runnerbear-version\.json[\s\S]*no-cache/);
  assert.match(readModel,/clientState:response\.clientState/);assert.match(readModel,/publicClientState\(parse\(state\?\.payload_json,\{\}\)\)/);
  assert.match(healthGate,/goalGuard\?\.activePrimary===true&&typeof x\.goalGuard\?\.restored==='boolean'/);
  assert.doesNotMatch(healthGate,/goalGuard\?\.restored===true/);
});
