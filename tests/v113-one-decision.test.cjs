const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const NOW='2026-08-28T10:00:00.000Z';
const workout={workoutId:'wo-today',localDate:'2026-08-28',status:'scheduled',sport:'running',workoutType:'easy',title:'10 km rolig',intent:'aerob kontinuitet',plannedDistanceM:10000,plannedDurationSeconds:3600};
const decision={decisionId:'dec-1',planRevisionId:'pr-1',inputCursor:'pr-1:health-1',type:'keep',status:'proposed',confidence:'high',reasonCodes:[],evidence:[],action:{affectedWorkoutIds:['wo-today'],change:{kind:'none'}},explanation:{title:'Følg dagens økt',summary:'Dagens signaler støtter den planlagte dosen.'},validUntil:'2099-08-28T16:00:00.000Z'};
const bootstrap={ok:true,planRevisionId:'pr-1',generatedAt:NOW,activePlan:{planRevisionId:'pr-1',items:[workout]},todayWorkout:workout,coachDecision:decision,coachBrief:{week:{priority:'Bevar kontinuiteten'}},bodyResponse:{state:'as_planned',stateLabel:'Kroppen støtter planen'}};

test('One Decision presents one current action with no more than three evidence items',async()=>{
  const {buildOneDecision,ONE_DECISION_VERSION}=await import('../cloud/runnerbear-cloud/src/v113/one-decision.js'),result=buildOneDecision(bootstrap,{now:NOW});
  assert.equal(result.version,ONE_DECISION_VERSION);
  assert.equal(result.planRevisionId,'pr-1');
  assert.equal(result.state,'follow');
  assert.equal(result.primaryAction.kind,'open_workout');
  assert.ok(result.evidence.length>=1&&result.evidence.length<=3);
  assert.equal(result.safety.planWritesByAi,false);
  assert.equal(result.safety.maximumReductionPercent,20);
});

test('a deterministic 20 percent reduction becomes an explicit before/after proposal',async()=>{
  const {buildOneDecision}=await import('../cloud/runnerbear-cloud/src/v113/one-decision.js'),reduce={...decision,type:'reduce',reasonCodes:['POOR_SLEEP','POST_WORKOUT_LOAD'],action:{affectedWorkoutIds:['wo-today'],change:{kind:'reduce_duration',reductionPercent:20}},explanation:{title:'I dag: kortere rolig økt',summary:'Kroppssignalene tilsier en mindre dose.'}},result=buildOneDecision({...bootstrap,coachDecision:reduce},{now:NOW});
  assert.equal(result.state,'adjust');
  assert.equal(result.primaryAction.kind,'review_adjustment');
  assert.equal(result.proposal.reductionPercent,20);
  assert.equal(result.proposal.before.plannedDistanceM,10000);
  assert.equal(result.proposal.after.plannedDistanceM,8000);
  assert.equal(result.proposal.after.plannedDurationSeconds,2880);
  assert.equal(result.proposal.confirmationRequired,true);
  assert.equal(result.proposal.undoAvailable,true);
  assert.equal(result.evidence.length,3);
});

test('unsafe, stale and revision-mismatched decisions fail closed',async()=>{
  const {buildOneDecision}=await import('../cloud/runnerbear-cloud/src/v113/one-decision.js'),unsafe={...decision,type:'reduce',action:{affectedWorkoutIds:['wo-today'],change:{kind:'reduce_duration',reductionPercent:21}}},expired={...decision,validUntil:'2026-08-28T09:59:59.000Z'},mismatch={...decision,planRevisionId:'pr-old'};
  for(const candidate of [unsafe,expired,mismatch]){
    const result=buildOneDecision({...bootstrap,coachDecision:candidate},{now:NOW});
    assert.equal(result.state,'refresh');
    assert.equal(result.primaryAction.kind,'open_workout');
    assert.equal(result.proposal,null);
  }
});

test('clarify, completed, rest and rejected decisions have stable safe actions',async()=>{
  const {buildOneDecision}=await import('../cloud/runnerbear-cloud/src/v113/one-decision.js'),clarify=buildOneDecision({...bootstrap,coachDecision:{...decision,type:'needs_input',reasonCodes:['PAIN']}},{now:NOW}),completed=buildOneDecision({...bootstrap,todayWorkout:{...workout,status:'completed'}},{now:NOW}),restWorkout={...workout,sport:'rest',workoutType:'rest',title:'Hvile',plannedDistanceM:0},rest=buildOneDecision({...bootstrap,todayWorkout:restWorkout,activePlan:{planRevisionId:'pr-1',items:[restWorkout]}},{now:NOW}),rejected=buildOneDecision({...bootstrap,coachDecision:{...decision,type:'reduce',status:'rejected'}},{now:NOW});
  assert.equal(clarify.primaryAction.kind,'complete_checkin');
  assert.equal(completed.primaryAction.kind,'view_result');
  assert.equal(rest.primaryAction.kind,'view_plan');
  assert.equal(rejected.state,'follow');
  assert.match(rejected.summary,/beholde gjeldende dose/i);
});

test('Coach Live receives One Decision but retains no plan-write authority',async()=>{
  const {minimizeCoachContext,buildSystemPrompt}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js'),context=minimizeCoachContext(bootstrap,{surface:'today'}),prompt=buildSystemPrompt(context),source=fs.readFileSync('cloud/runnerbear-cloud/src/v112/coach-live.js','utf8');
  assert.equal(context.oneDecision.version,'one-decision-2');
  assert.equal(context.oneDecision.state,'follow');
  assert.match(prompt,/strukturerte beslutning/);
  assert.match(prompt,/lag aldri et eget planforslag/);
  assert.doesNotMatch(source,/(INSERT INTO|UPDATE|DELETE FROM) rb_plan_/);
});

test('v11.3 UI locks one primary decision, accessible confirmation and the four-request budget',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),css=fs.readFileSync('runnerbear-v113-one-decision.css','utf8'),html=fs.readFileSync('index.html','utf8'),manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
  assert.match(ui,/function oneDecisionHeroHtml/);
  assert.doesNotMatch(ui,/Oppdater Garmin-data|stale:'Oppdater data'|if\(kind==='refresh_data'\)/);
  assert.match(ui,/stale:'Oppdateres automatisk'/);
  assert.match(html,/runnerbear-ui-v11\.js\?v=12000/);
  assert.match(ui,/aria-labelledby=\"rb113DecisionTitle\"/);
  assert.match(ui,/function oneDecisionProposalModalHtml/);
  assert.match(ui,/aria-labelledby=\"rb113ProposalTitle\"/);
  assert.match(ui,/data-rb113-proposal-resolve=\"accept\"/);
  assert.match(ui,/data-rb113-proposal-resolve=\"reject\"/);
  assert.match(ui,/decisionSurface=oneDecision\(\)\?/);
  assert.doesNotMatch(html,/data-tab="coach"|data-tab="health"/);
  assert.equal((html.match(/<(?:link|script)\b[^>]+(?:runnerbear-v11\.css|runnerbear-(?:core|ui|data)-v11\.js)/g)||[]).length,4);
  assert.ok(manifest.styles.includes('runnerbear-v113-one-decision.css'));
  assert.match(css,/locked Concept 1/);
  assert.match(css,/min-height:50px/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('release chain preserves the v11.3 contract without a new endpoint or schema',()=>{
  const entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v113.js','utf8'),release=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1141.js','utf8'),current=fs.readFileSync('cloud/runnerbear-cloud/src/index-v114.js','utf8'),config=fs.readFileSync('cloud/runnerbear-cloud/wrangler.jsonc','utf8'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8'),repository=fs.readFileSync('cloud/runnerbear-cloud/src/v11/repository.js','utf8'),routes=fs.readFileSync('cloud/runnerbear-cloud/src/v11/routes.js','utf8');
  assert.match(config,/src\/index-v118\.js/);
  assert.match(entry,/path==='\/api\/v2\/bootstrap'/);
  assert.match(current,/\.\/index-v113\.js/);
  assert.match(release,/\.\/index-v114\.js/);
  assert.doesNotMatch(entry,/\/api\/v2\/one-decision/);
  assert.match(entry,/oneDecisionVersion:ONE_DECISION_VERSION/);
  assert.match(workflow,/verify-v116-health\.mjs/);
  assert.match(fs.readFileSync('scripts/verify-v116-health.mjs','utf8'),/x\.oneDecisionAudit\?\.ok===true/);
  assert.match(repository,/status IN \('proposed','auto_applied','accepted','rejected'\)/);
  assert.match(routes,/decision\.status!=='proposed'/);
  assert.match(routes,/reductionPercent>20/);
  assert.match(routes,/SAFE_ADJUSTMENT_REJECTED/);
  assert.equal(fs.readdirSync('cloud/runnerbear-cloud/migrations').filter(name=>name.endsWith('.sql')).length,10);
});
