const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const NOW='2026-08-29T08:00:00.000Z';
const today={workoutId:'wo-today',localDate:'2026-08-29',slotIndex:0,status:'scheduled',sport:'running',workoutType:'easy',title:'8 km rolig',intent:'aerob kontinuitet',plannedDistanceM:8000,plannedDurationSeconds:3000};
const yesterday={workoutId:'wo-yesterday',localDate:'2026-08-28',slotIndex:0,status:'completed',sport:'running',workoutType:'quality',title:'5 × 6 min terskel',intent:'threshold',plannedDistanceM:10000,plannedDurationSeconds:3900};
const decision={decisionId:'dec-current',planRevisionId:'pr-114',inputCursor:'pr-114:health-1',type:'keep',status:'proposed',confidence:'high',reasonCodes:[],evidence:[{kind:'plan'}],action:{affectedWorkoutIds:['wo-today'],change:{kind:'none'}},explanation:{title:'Følg dagens økt',summary:'Dagens signaler støtter den planlagte dosen.'},validUntil:'2099-08-29T18:00:00.000Z',createdAt:NOW};
const bootstrap={ok:true,planRevisionId:'pr-114',generatedAt:NOW,config:{timezone:'Europe/Oslo'},activePlan:{planRevisionId:'pr-114',items:[yesterday,today]},todayWorkout:today,coachDecision:decision,decisionHistory:[],coachBrief:{week:{priority:'Bevar kontinuiteten'}},bodyResponse:{state:'as_planned',stateLabel:'Kroppen støtter planen',confidence:'high',baselineStatus:{status:'established'}},recentActivities:[],responseEvents:[],responseCheckins:[]};

const resolved=(index,status='accepted')=>({decisionId:`dec-${index}`,planRevisionId:'pr-114',type:index%2?'reduce':'keep',status,confidence:'high',action:{affectedWorkoutIds:[`wo-${index}`]},explanation:{summary:`Kontrollert begrunnelse ${index}`},createdAt:`2026-08-${String(28-index).padStart(2,'0')}T08:00:00Z`});
const historic=index=>({workoutId:`wo-${index}`,localDate:`2026-08-${String(28-index).padStart(2,'0')}`,slotIndex:0,status:'completed',sport:'running',workoutType:'easy',title:`Rolig økt ${index}`,plannedDistanceM:7000});

test('coach continuity exposes plain-language confidence and at most three observed memories',async()=>{
  const {buildCoachContinuity,COACH_CONTINUITY_VERSION}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),history=[resolved(1),resolved(2,'rejected'),resolved(3,'auto_applied'),resolved(4,'undone')],items=[yesterday,today,...history.map((_,index)=>historic(index+1))],responseEvents=history.map((_,index)=>({event_type:'feedback:workout',local_date:items[index+2].localDate,payload:{workoutId:items[index+2].workoutId,responsePhase:'post_workout',control:index%2?'controlled':'borderline'}})),result=buildCoachContinuity({...bootstrap,activePlan:{planRevisionId:'pr-114',items},decisionHistory:history,responseEvents});
  assert.equal(result.version,COACH_CONTINUITY_VERSION);
  assert.equal(result.confidence.level,'high');
  assert.equal(result.confidence.label,'Godt beslutningsgrunnlag');
  assert.equal(result.memory.recent.length,3);
  assert.equal(result.memory.observedDecisions,3);
  assert.equal(result.memory.learnedResponses,3);
  assert.equal(result.memory.status,'available');
  assert.equal(result.safety.historyLimit,3);
  assert.equal(result.safety.planWritesByAi,false);
  assert.equal(result.safety.rawHealthValuesExposed,false);
  assert.doesNotMatch(JSON.stringify(result),/hrv_ms|sleep_seconds|rhr_bpm/);
});

test('a completed workout without feedback becomes one calm post-workout action',async()=>{
  const {buildCoachContinuity,buildOneDecisionV2}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),completed={...today,status:'completed'},input={...bootstrap,todayWorkout:completed,activePlan:{planRevisionId:'pr-114',items:[yesterday,completed]}},continuity=buildCoachContinuity(input),result=buildOneDecisionV2(input,continuity);
  assert.equal(continuity.followUp.phase,'post_workout');
  assert.equal(continuity.followUp.workoutId,'wo-today');
  assert.equal(result.version,'one-decision-2');
  assert.equal(result.state,'reflect');
  assert.equal(result.primaryAction.kind,'complete_feedback');
  assert.equal(result.primaryAction.workoutId,'wo-today');
  assert.equal(result.proposal,null);
});

test('an observed activity closes the loop even before plan status catches up',async()=>{
  const {buildCoachContinuity,buildOneDecisionV2}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),input={...bootstrap,recentActivities:[{source_id:'garmin-today',date:'2026-08-29',payload:{workoutId:'wo-today'}}]},continuity=buildCoachContinuity(input),result=buildOneDecisionV2(input,continuity);
  assert.equal(continuity.followUp.phase,'post_workout');
  assert.equal(result.state,'reflect');
  assert.equal(result.primaryAction.kind,'complete_feedback');
  assert.equal(result.primaryAction.workoutId,'wo-today');
});

test('post-workout feedback opens exactly one next-morning check-in',async()=>{
  const feedback={event_type:'feedback:workout',local_date:'2026-08-28',payload:{workoutId:'wo-yesterday',responsePhase:'post_workout',control:'controlled'}},input={...bootstrap,responseEvents:[feedback]},module=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),continuity=module.buildCoachContinuity(input),result=module.buildOneDecisionV2(input,continuity);
  assert.equal(continuity.followUp.required,true);
  assert.equal(continuity.followUp.phase,'next_morning');
  assert.equal(result.state,'clarify');
  assert.equal(result.primaryAction.kind,'complete_checkin');
  assert.equal(result.primaryAction.workoutId,'wo-yesterday');
  const resolvedInput={...input,responseCheckins:[{localDate:'2026-08-29',workoutId:'wo-yesterday',responsePhase:'next_morning'}]};
  assert.equal(module.buildCoachContinuity(resolvedInput).followUp.required,false);
});

test('safe deterministic adjustment keeps priority over the follow-up loop',async()=>{
  const {buildCoachContinuity,buildOneDecisionV2}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),reduce={...decision,type:'reduce',reasonCodes:['POOR_SLEEP'],action:{affectedWorkoutIds:['wo-today'],change:{kind:'reduce_duration',reductionPercent:20}},explanation:{title:'Reduser dagens dose',summary:'En mindre dose gir nødvendig margin.'}},feedback={event_type:'feedback:workout',local_date:'2026-08-28',payload:{workoutId:'wo-yesterday',responsePhase:'post_workout'}},input={...bootstrap,coachDecision:reduce,responseEvents:[feedback]},continuity=buildCoachContinuity(input),result=buildOneDecisionV2(input,continuity);
  assert.equal(continuity.followUp.phase,'next_morning');
  assert.equal(result.state,'adjust');
  assert.equal(result.primaryAction.kind,'review_adjustment');
  assert.equal(result.proposal.reductionPercent,20);
  assert.equal(result.proposal.confirmationRequired,true);
});

test('plan-revision mismatch fails closed and the release audit locks safety limits',async()=>{
  const {buildCoachContinuity,buildOneDecisionV2,closedLoopAudit}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),continuity={...buildCoachContinuity(bootstrap),planRevisionId:'pr-old'},result=buildOneDecisionV2(bootstrap,continuity),audit=closedLoopAudit();
  assert.equal(result.state,'refresh');
  assert.equal(result.primaryAction.kind,'open_workout');
  assert.equal(result.proposal,null);
  assert.equal(audit.ok,true);
  assert.equal(audit.oneDecisionVersion,'one-decision-2');
  assert.equal(audit.continuityVersion,'coach-continuity-1');
  assert.equal(audit.maximumReductionPercent,20);
  assert.equal(audit.historyLimit,3);
  assert.equal(audit.planWritesByAi,false);
});

test('expired coach confidence is never presented as current',async()=>{
  const {buildCoachContinuity,buildOneDecisionV2}=await import('../cloud/runnerbear-cloud/src/v114/closed-loop.js'),input={...bootstrap,coachDecision:{...decision,validUntil:'2026-08-29T07:59:59.000Z'},bodyResponse:{...bootstrap.bodyResponse,confidence:'low'}},continuity=buildCoachContinuity(input),result=buildOneDecisionV2(input,continuity);
  assert.equal(continuity.confidence.level,'low');
  assert.equal(continuity.confidence.label,'Begrenset beslutningsgrunnlag');
  assert.equal(continuity.confidence.evidenceCount,0);
  assert.equal(result.state,'refresh');
});

test('Coach Live receives minimized continuity context without plan-write authority',async()=>{
  const {minimizeCoachContext,buildSystemPrompt}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js'),context=minimizeCoachContext({...bootstrap,decisionHistory:[resolved(1)]},{surface:'today'}),prompt=buildSystemPrompt(context),source=fs.readFileSync('cloud/runnerbear-cloud/src/v112/coach-live.js','utf8');
  assert.equal(context.oneDecision.version,'one-decision-2');
  assert.equal(context.coachContinuity.version,'coach-continuity-1');
  assert.ok(context.coachContinuity.memory.recent.length<=3);
  assert.match(prompt,/observerte råd, valg og respons/);
  assert.match(prompt,/påstå aldri at et råd forårsaket/);
  assert.match(prompt,/strukturerte oppfølgingssvaret/);
  assert.doesNotMatch(source,/(INSERT INTO|UPDATE|DELETE FROM) rb_plan_/);
});

test('Closed Loop UI stays inside One Decision with accessible disclosure and four static requests',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),css=fs.readFileSync('runnerbear-v114-closed-loop.css','utf8'),html=fs.readFileSync('index.html','utf8'),manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
  assert.match(ui,/function coachContinuity\(\)/);
  assert.match(ui,/<details class="rb114-coach-memory">/);
  assert.match(ui,/Tidligere respons/);
  assert.match(ui,/complete_feedback/);
  assert.match(ui,/targetWorkoutId/);
  assert.match(ui,/reflect:'Etter økten'/);
  assert.match(css,/locked Concept 1 \/ Premium calm/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.ok(manifest.styles.includes('runnerbear-v114-closed-loop.css'));
  assert.doesNotMatch(html,/data-tab="coach"|data-tab="health"/);
  assert.equal((html.match(/<(?:link|script)\b[^>]+(?:runnerbear-v11\.css|runnerbear-(?:core|ui|data)-v11\.js)/g)||[]).length,4);
});

test('v11.4 release remains intact beneath the v11.4.1 reliability wrapper',()=>{
  const release=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1141.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v114.js','utf8'),config=fs.readFileSync('cloud/runnerbear-cloud/wrangler.jsonc','utf8'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8'),repository=fs.readFileSync('cloud/runnerbear-cloud/src/v11/repository.js','utf8'),readModel=fs.readFileSync('cloud/runnerbear-cloud/src/v11/read-model.js','utf8');
  assert.match(config,/src\/index-v116\.js/);
  assert.match(release,/\.\/index-v114\.js/);
  assert.match(entry,/\.\/index-v113\.js/);
  assert.match(entry,/\['\/api\/v2\/bootstrap','\/health'\]/);
  assert.doesNotMatch(entry,/\/api\/v2\/coach-continuity/);
  assert.match(entry,/\{decisionHistory,responseCheckins,\.\.\.publicBody\}=body/);
  assert.match(repository,/ORDER BY created_at DESC LIMIT \?2/);
  assert.match(readModel,/recentDecisionHistory\(env\.DB,userId\)/);
  assert.match(readModel,/ORDER BY occurred_at DESC LIMIT 30/);
  assert.match(workflow,/verify-v116-health\.mjs/);
  const healthGate=fs.readFileSync('scripts/verify-v116-health.mjs','utf8');
  assert.match(healthGate,/x\.cloudBuild==='11\.6\.0'/);
  assert.match(healthGate,/x\.oneDecisionVersion==='one-decision-2'/);
  assert.match(healthGate,/x\.coachContinuityVersion==='coach-continuity-1'/);
  assert.equal(fs.readdirSync('cloud/runnerbear-cloud/migrations').filter(name=>name.endsWith('.sql')).length,8);
});
