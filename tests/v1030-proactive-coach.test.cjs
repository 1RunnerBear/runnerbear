const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const engine=()=>import(pathToFileURL(path.join(root,'cloud/runnerbear-cloud/src/v1027/coach-engine.js')).href);
const plan={planRevisionId:'pr-current',items:[
  {workoutId:'wo-easy',planRevisionId:'pr-current',localDate:'2026-08-24',workoutType:'easy',title:'Rolig 8 km',status:'scheduled'},
  {workoutId:'wo-quality',planRevisionId:'pr-current',localDate:'2026-08-25',workoutType:'quality',title:'Terskel 5 × 6 min',status:'scheduled'},
  {workoutId:'wo-long',planRevisionId:'pr-current',localDate:'2026-08-29',workoutType:'easy',title:'Langtur 18 km',status:'scheduled'}
]};
const decision={decisionId:'dec-1',planRevisionId:'pr-current',inputCursor:'cursor-1',type:'keep',status:'proposed',reasonCodes:[],action:{affectedWorkoutIds:['wo-easy'],change:{kind:'none'}},explanation:{title:'Planen står',summary:'Dagens signaler støtter planen.',weekImpact:'Resten av uken står uendret.'},validUntil:'2026-08-24T16:00:00.000Z'};

test('canonical coach brief answers today, why and what changes next',async()=>{
  const {buildCoachBrief}=await engine(),brief=buildCoachBrief({plan,decision,today:'2026-08-24',now:'2026-08-24T10:00:00.000Z'});
  assert.equal(brief.version,'coach-brief-1');
  assert.equal(brief.planRevisionId,'pr-current');
  assert.equal(brief.inputCursor,'cursor-1');
  assert.equal(brief.freshness,'current');
  assert.equal(brief.today.actionLabel,'Følg dagens økt');
  assert.equal(brief.today.planChanged,false);
  assert.equal(brief.week.priority,'Beskytt neste kvalitetsøkt');
  assert.equal(brief.week.nextKeyWorkout.workoutId,'wo-quality');
  assert.deepEqual(brief.week.keyWorkoutIds,['wo-quality','wo-long']);
});

test('expired or mismatched decisions cannot be presented as current',async()=>{
  const {buildCoachBrief}=await engine();
  for(const candidate of [{...decision,validUntil:'2026-08-24T09:00:00.000Z'},{...decision,planRevisionId:'pr-old'}]){
    const brief=buildCoachBrief({plan,decision:candidate,today:'2026-08-24',now:'2026-08-24T10:00:00.000Z'});
    assert.equal(brief.freshness,'stale');
    assert.equal(brief.attention,'action');
    assert.equal(brief.today.actionKind,'wait_for_data');
    assert.equal(brief.today.planChanged,false);
    assert.deepEqual(brief.today.affectedWorkoutIds,[]);
  }
});

test('a changed coach decision explains affected workouts and week impact',async()=>{
  const {buildCoachBrief}=await engine(),brief=buildCoachBrief({plan,decision:{...decision,type:'reduce',reasonCodes:['POOR_SLEEP'],action:{affectedWorkoutIds:['wo-easy'],change:{kind:'reduce_duration',reductionPercent:20}},explanation:{title:'Kortere rolig økt',summary:'Søvnen tilsier mindre dose.',weekImpact:'Bare dagens dose reduseres.'}},today:'2026-08-24',now:'2026-08-24T10:00:00.000Z'});
  assert.equal(brief.attention,'action');
  assert.equal(brief.today.planChanged,true);
  assert.deepEqual(brief.today.affectedWorkoutIds,['wo-easy']);
  assert.match(brief.week.watch[0],/Søvnen/);
  assert.equal(brief.week.nextChange,'Bare dagens dose reduseres.');
});

test('proactive coach UI exposes weekly priority and explicit plan status',()=>{
  const ui=read('runnerbear-ui-v1027-source.js');
  assert.match(ui,/function proactiveCoachBrief\(\)/);
  assert.match(ui,/Denne ukens prioritet/);
  assert.match(ui,/Hva kan endres/);
  assert.match(ui,/Ingen planendring/);
  assert.match(ui,/Neste vurdering/);
});

test('all four goal tiles are accessible explanations in a modal above the view',()=>{
  const ui=read('runnerbear-ui-v1027-source.js'),css=read('runnerbear-v1030-proactive-coach.css');
  for(const key of ['goal','five','direction','gate'])assert.match(ui,new RegExp(`key:'${key}'`));
  assert.match(ui,/data-rb1030-goal-insight/);
  assert.match(ui,/role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"rb1030GoalInsightTitle\"/);
  assert.match(ui,/Målet krever tydelig framgang/);
  assert.match(ui,/uten å jage farten eller skape treningsgjeld/);
  assert.match(css,/\.rb1030-goal-insight-modal\{z-index:12500\}/);
  assert.match(css,/min-height:132px/);
});

test('bootstrap read model returns the canonical coach brief',()=>{
  const model=read('cloud/runnerbear-cloud/src/v1027/read-model.js');
  assert.match(model,/buildCoachBrief\(\{plan,decision:coachDecision,today,now:generatedAt\}\)/);
  assert.match(model,/coachDecision,coachBrief,readiness/);
});
