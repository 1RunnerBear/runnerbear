const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=file=>fs.readFileSync(file,'utf8');

test('contextual coach is revision-bound, quiet by default and limited to one recommendation',async()=>{
  const {buildContextualCoach,contextualCoachAudit}=await import('../cloud/runnerbear-cloud/src/v116/contextual-coach.js');
  const coach=buildContextualCoach({
    planRevisionId:'plan-1',generatedAt:'2026-08-30T09:00:00Z',
    oneDecision:{planRevisionId:'plan-1',state:'follow',headline:'Følg planen',summary:'Rolig økt som planlagt.',evidence:[{label:'Stabil 28-dagers trend'},{label:'Ekstra bevis skal ikke vises'}],primaryAction:{kind:'open_workout',label:'Se dagens økt',workoutId:'run-1'}},
    bodyResponse:{planRevisionId:'plan-1',state:'as_planned',stateLabel:'Stabil trend',freshness:{status:'fresh'},baselineStatus:{status:'established'},recommendedAction:{label:'Planen står'}},
    weeklyReview:{planRevisionId:'plan-1',headline:'En kontrollert uke',coachComment:'Kvalitetsøktene traff målet.',learning:'God intensitetsstyring.',nextDirection:'Prioriter langturen.',dataQuality:'good'},
    goalConfidence:{level:'supported',sufficient:true,summary:'Utviklingen støtter A-målet.',nextEvidence:'Neste gateøkt.'},
  });
  assert.equal(coach.version,'contextual-coach-1');assert.equal(coach.planRevisionId,'plan-1');assert.equal(coach.mode,'background');
  assert.equal(coach.surfaces.today.visible,true);assert.equal(coach.surfaces.today.why,'Stabil 28-dagers trend');
  assert.equal(coach.surfaces.health.visible,false);assert.equal(coach.surfaces.plan.visible,false);assert.equal(coach.surfaces.postWorkout.visible,false);
  assert.equal(coach.surfaces.goal.visible,true);assert.equal(coach.surfaces.goal.headline,'Målretningen har støtte');
  assert.ok(coach.surfaces.weekly.priorities.length<=2);assert.equal(coach.safety.planWritesByAi,false);assert.equal(coach.safety.maximumReductionPercent,20);assert.equal(coach.safety.oneRecommendationPerSurface,true);
  const audit=contextualCoachAudit();assert.equal(audit.silentWhenNormal,true);assert.equal(audit.coachLive,false);assert.equal(audit.coachLiveRoutes,false);assert.equal(audit.navigationTabs,4);
});

test('contextual coach refuses stale decision state',async()=>{
  const {buildContextualCoach}=await import('../cloud/runnerbear-cloud/src/v116/contextual-coach.js');
  const coach=buildContextualCoach({planRevisionId:'plan-new',oneDecision:{planRevisionId:'plan-old',headline:'Stale'}});
  assert.equal(coach.surfaces.today.visible,false);assert.equal(coach.surfaces.today.reason,'no-current-decision');
});

test('production entrypoint returns Gone for every retired Coach Live route',async()=>{
  const {retiredCoachLiveResponse}=await import('../cloud/runnerbear-cloud/src/v116/contextual-coach.js'),response=retiredCoachLiveResponse(),body=await response.json();
  assert.equal(response.status,410);assert.equal(body.code,'COACH_LIVE_REMOVED');assert.equal(body.replacement,'contextual-coach-1');assert.equal(response.headers.get('cache-control'),'no-store');
  const entry=read('cloud/runnerbear-cloud/src/index-v116.js');assert.match(entry,/path==='\/api\/v2\/coach-live'\|\|path\.startsWith\('\/api\/v2\/coach-live\/'\)/);assert.match(entry,/return retiredCoachLiveResponse\(\)/);
});

test('current assets and production configuration contain no chat client or AI binding',()=>{
  const ui=read('runnerbear-ui-v11-source.js'),config=read('cloud/runnerbear-cloud/wrangler.jsonc'),compat=read('cloud/runnerbear-cloud/src/index-v112.js'),reliability=read('cloud/runnerbear-cloud/src/index-v1141.js'),manifest=JSON.parse(read('runnerbear-v11-assets.json'));
  assert.doesNotMatch(ui,/Coach Live|coachLive|coach-live|data-rb112|rb112|COACH_LIVE|coach_live/);
  assert.match(ui,/surfaces\?\.postWorkout/);assert.match(ui,/context\.healthTrend/);assert.match(ui,/context\?\.whatWentWell/);
  assert.match(config,/src\/index-v118\.js/);assert.doesNotMatch(config,/"binding":\s*"AI"|COACH_LIVE_MODEL|@cf\/zai-org/);
  assert.doesNotMatch(compat,/handleCoachLive|coachLiveAudit|DEFAULT_COACH_LIVE_MODEL|env\.AI|env\.DB/);assert.doesNotMatch(reliability,/\.\/v112\/coach-live\.js/);
  assert.equal(manifest.build,'12.0.0');assert.equal(manifest.styles.at(-1),'runnerbear-v12-concept-one.css');
});

test('production gates accept only Gone or the private Access guard for retired chat',()=>{
  const deploy=read('.github/workflows/runnerbear-cloud-deploy.yml'),rollout=read('.github/workflows/runnerbear-coach-loop-rollout.yml'),health=read('scripts/verify-v116-health.mjs');
  for(const workflow of [deploy,rollout]){
    assert.match(workflow,/410\)/);
    assert.match(workflow,/301\|302\|303\|307\|308\|401\|403\)/);
    assert.match(workflow,/Retired Coach Live route unexpectedly remained reachable/);
  }
  assert.match(deploy,/COACH_LIVE_REMOVED/);assert.match(deploy,/contextual-coach-1/);
  assert.match(rollout,/COACH_LIVE_REMOVED/);assert.match(rollout,/contextual-coach-1/);
  assert.match(health,/x\.coachLive===false&&x\.coachLiveRoutes===false&&x\.coachLiveInference===false/);
});
