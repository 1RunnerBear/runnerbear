const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const planRevisionId='pr-1031';
const row=(workoutId,localDate,overrides={})=>({workoutId,lineageId:workoutId,planRevisionId,localDate,slotIndex:0,status:'scheduled',sport:'running',workoutType:'easy',title:'8 km rolig',intent:'easy',prescription:{version:1},plannedDistanceM:8000,plannedLoad:{integrity:{targetWeeklyVolume:50,expectedQualitySessions:2}},source:'test',lockLevel:'none',...overrides});

test('weekly review distinguishes running, alternative training and missed work without false running kilometres',async()=>{
  const {buildWeeklyReview}=await import('../cloud/runnerbear-cloud/src/v11/review-engine.js'),plan={planRevisionId,items:[
    row('easy','2026-08-17'),row('quality','2026-08-18',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold',plannedDistanceM:10000}),row('crossed','2026-08-19'),row('missed','2026-08-20')
  ]},activities=[
    {source_id:'garmin-1',date:'2026-08-17',sport_type:'running',distance_m:8100,duration_seconds:2700},
    {source_id:'garmin-2',date:'2026-08-18',sport_type:'running',distance_m:10100,duration_seconds:3600},
    {source_id:'c2-1',date:'2026-08-19',sport_type:'rowing',distance_m:10000,duration_seconds:2400}
  ],review=buildWeeklyReview({plan,activities,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(review.version,'weekly-review-1');assert.equal(review.planRevisionId,planRevisionId);assert.equal(review.totals.completedDistanceM,18200);assert.equal(review.totals.completedDurationSeconds,6300);assert.equal(review.totals.plannedQualitySessions,1);assert.equal(review.totals.completedQualitySessions,1);assert.equal(review.totals.alternativeSessions,1);assert.equal(review.totals.missedSessions,1);assert.equal(review.sessions.find(x=>x.workoutId==='crossed').actualDistanceM,0);assert.equal(review.attention,'watch');assert.match(review.coachComment,/uten treningsgjeld/i);
});

test('weekly review summarizes quality, long run, total distance, running time and coach assessment',async()=>{
  const {buildWeeklyReview}=await import('../cloud/runnerbear-cloud/src/v11/review-engine.js'),plan={planRevisionId,items:[
    row('quality-1','2026-08-18',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold',plannedDistanceM:10000}),
    row('quality-2','2026-08-21',{workoutType:'quality',title:'20 × 45/15',intent:'threshold',plannedDistanceM:9000}),
    row('long','2026-08-23',{title:'17 km langtur',intent:'long',plannedDistanceM:17000}),
    row('easy','2026-08-20',{plannedDistanceM:8000}),
  ]},activities=[
    {source_id:'a1',date:'2026-08-18',sport_type:'running',distance_m:10100,duration_seconds:3300},
    {source_id:'a2',date:'2026-08-21',sport_type:'running',distance_m:9200,duration_seconds:3000},
    {source_id:'a3',date:'2026-08-23',sport_type:'running',distance_m:17200,duration_seconds:5460},
    {source_id:'a4',date:'2026-08-20',sport_type:'running',distance_m:7900,duration_seconds:2700},
  ],review=buildWeeklyReview({plan,activities,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(review.totals.completedQualitySessions,2);assert.equal(review.totals.plannedQualitySessions,2);assert.equal(review.longRun.completed,true);assert.equal(review.longRun.actualDistanceM,17200);assert.equal(review.longRun.actualDurationSeconds,5460);assert.equal(review.totals.completedDistanceM,44400);assert.equal(review.totals.completedDurationSeconds,14460);assert.equal(review.headline,'Sterk og balansert uke');assert.match(review.coachComment,/Alle planlagte kvalitetsøkter og langturen/);
});

test('missed workout evaluation is forward-only and creates no training debt',async()=>{
  const {buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v11/review-engine.js'),yesterday=row('missed','2026-08-23',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold'}),future=row('future','2026-08-27',{workoutType:'quality',title:'20 × 45/15',intent:'threshold'}),plan={planRevisionId,items:[yesterday,future]},proposal=buildRealignmentProposal({plan,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(proposal.trigger,'missed_workout');assert.equal(proposal.status,'unchanged');assert.equal(proposal.trainingDebt,false);assert.equal(proposal.affectedWorkoutIds.length,0);assert.deepEqual(proposal.rows,plan.items);assert.match(proposal.summary,/flyttes ikke blindt/i);
});

test('explicit illness removes only unlocked future running inside 72 hours and never increases dose',async()=>{
  const {buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v11/review-engine.js'),past=row('past','2026-08-23',{status:'completed'}),today=row('today','2026-08-24',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold',plannedDistanceM:11000}),tomorrow=row('tomorrow','2026-08-25'),locked=row('race','2026-08-26',{workoutType:'race',title:'Løp',lockLevel:'system'}),later=row('later','2026-08-27'),plan={planRevisionId,items:[past,today,tomorrow,locked,later]},events=[{event_id:'ill-1',occurred_at:'2026-08-24T07:00:00Z',local_date:'2026-08-24',payload:{illness:true,responseDate:'2026-08-24'}}],proposal=buildRealignmentProposal({plan,events,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(proposal.trigger,'illness_reported');assert.equal(proposal.status,'needs_input');assert.equal(proposal.autoEligible,false);assert.equal(proposal.rows.find(x=>x.workoutId==='past').status,'completed');assert.equal(proposal.rows.find(x=>x.workoutId==='today').sport,'rest');assert.equal(proposal.rows.find(x=>x.workoutId==='tomorrow').plannedDistanceM,0);assert.equal(proposal.rows.find(x=>x.workoutId==='race').workoutType,'race');assert.equal(proposal.rows.find(x=>x.workoutId==='later').plannedDistanceM,8000);assert.equal(proposal.trainingDebt,false);
});

test('alternative training replaces aerobic support with zero mechanical running credit',async()=>{
  const {buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v11/review-engine.js'),plan={planRevisionId,items:[row('today','2026-08-24'),row('future','2026-08-25')]},activities=[{source_id:'row-1',date:'2026-08-24',sport_type:'rowing',title:'Concept2 40 min',duration_seconds:2400,distance_m:10000}],proposal=buildRealignmentProposal({plan,activities,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'}),replacement=proposal.rows.find(x=>x.workoutId==='today');
  assert.equal(proposal.trigger,'alternative_training');assert.equal(proposal.autoEligible,true);assert.equal(replacement.status,'replaced');assert.equal(replacement.sport,'cross');assert.equal(replacement.plannedDistanceM,0);assert.equal(replacement.plannedLoad.realignment.originalDistanceM,8000);assert.match(proposal.consequence,/ingen løpskilometer/i);
});

test('sync repair classifies activation, source and structural conflicts with explicit verification only',async()=>{
  const {buildSyncRepair,canExplicitlyVerify}=await import('../cloud/runnerbear-cloud/src/v11/sync-repair.js'),operations=[
    {operation_id:'a',workout_id:'w1',plan_revision_id:planRevisionId,operation_type:'create',status:'review_required',last_error:'PLAN_ACTIVATION_REQUIRED',title:'8 km rolig'},
    {operation_id:'b',workout_id:'w2',plan_revision_id:planRevisionId,operation_type:'move',status:'review_required',last_error:'SOURCE_NOT_FOUND'},
    {operation_id:'c',workout_id:'w3',plan_revision_id:planRevisionId,operation_type:'cancel',status:'review_required',last_error:'STRUCTURAL_CHANGE_REQUIRES_REVIEW'}
  ],repair=buildSyncRepair(operations,planRevisionId);
  assert.equal(repair.attention,'action');assert.equal(repair.counts.actionRequired,3);assert.deepEqual(repair.items.map(x=>x.kind),['activation_required','source_missing','structural_review']);assert.equal(canExplicitlyVerify(operations[2]),true);assert.match(repair.items[2].verifyLabel,/kontroller/i);
});

test('v11.6 preserves the locked wrapper chain and accessible review and repair UI',()=>{
  const config=fs.readFileSync('cloud/runnerbear-cloud/wrangler.jsonc','utf8'),contextual=fs.readFileSync('cloud/runnerbear-cloud/src/index-v116.js','utf8'),ux=fs.readFileSync('cloud/runnerbear-cloud/src/index-v115.js','utf8'),release=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1141.js','utf8'),current=fs.readFileSync('cloud/runnerbear-cloud/src/index-v114.js','utf8'),oneDecision=fs.readFileSync('cloud/runnerbear-cloud/src/index-v113.js','utf8'),previous=fs.readFileSync('cloud/runnerbear-cloud/src/index-v112.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11.js','utf8'),base=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11-base.js','utf8'),ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
  assert.match(config,/index-v116\.js/);assert.match(contextual,/\.\/index-v115\.js/);assert.match(ux,/\.\/index-v1141\.js/);assert.match(release,/\.\/index-v114\.js/);assert.match(current,/\.\/index-v113\.js/);assert.match(oneDecision,/\.\/index-v112\.js/);assert.match(previous,/\.\/index-v11\.js/);assert.match(entry,/v11\/routes\.js/);assert.match(base,/v11\/routes\.js/);assert.match(ui,/function weeklyReviewCardHtml/);assert.match(ui,/role="dialog" aria-modal="true" aria-labelledby="rb1031ReviewTitle"/);assert.match(ui,/data-rb1031-sync-verify/);assert.ok(manifest.styles.includes('runnerbear-v1031-coach-package.css'));
});

test('bootstrap keeps realignment forward-only without returning a duplicate full plan payload',()=>{
  const readModel=fs.readFileSync('cloud/runnerbear-cloud/src/v11/read-model.js','utf8');
  assert.match(readModel,/function publicRealignment\(proposal\)/);
  assert.match(readModel,/const \{rows,changes,\.\.\.summary\}=proposal/);
  assert.match(readModel,/realignmentProposal:publicRealignment\(realignmentProposal\)/);
});

test('rolling sync uses one durable binding and moves the same external workout id',async()=>{
  const {projectRollingSync,stableExternalId}=await import('../cloud/runnerbear-cloud/src/v11/sync-projection.js'),item=row('quality-stable','2026-08-27',{workoutType:'quality'}),binding={workout_id:item.workoutId,status:'confirmed',confirmed_date:'2026-08-26'},operations=projectRollingSync([item],planRevisionId,'2026-08-24','tredict',[binding]);
  assert.equal(operations.length,1);assert.equal(operations[0].operationType,'move');assert.equal(operations[0].payload.previousDate,'2026-08-26');assert.equal(stableExternalId(item.workoutId),'rb-workout-quality-stable');assert.equal(projectRollingSync([item],planRevisionId,'2026-08-24','tredict',[{...binding,confirmed_date:item.localDate}]).length,0);
});

test('startup paints verified cache before revalidation and legacy plan publishing yields to canonical sync',()=>{
  const canonical=fs.readFileSync('runnerbear-cloud-v11.js','utf8'),legacy=fs.readFileSync('runnerbear-cloud-v1025.js','utf8'),html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8');
  assert.match(canonical,/const cached=verifiedCache\(\);\s*if\(cached\)\{install\(cached\)/);assert.match(legacy,/function canonicalSyncOwner\(\)/);assert.match(legacy,/if\(!IS_CLOUD\|\|canonicalSyncOwner\(\)\)return/);assert.match(html,/runnerbear-data-v11\.js\?v=11602" defer/);assert.doesNotMatch(ui,/canonicalSyncBannerHtml\(\)[^\n]+data-rb1028-sync-retry/);
});

test('sync binding migration enforces one provider identity per canonical workout',()=>{
  const migration=fs.readFileSync('cloud/runnerbear-cloud/migrations/0006_sync_bindings.sql','utf8'),routes=fs.readFileSync('cloud/runnerbear-cloud/src/v11/routes.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11.js','utf8');
  assert.match(migration,/PRIMARY KEY\(user_id,destination,workout_id\)/);assert.match(migration,/UNIQUE\(user_id,destination,stable_external_id\)/);assert.match(routes,/remoteWorkoutId:operation\.remote_workout_id/);assert.match(routes,/INSERT INTO rb_sync_bindings/);assert.match(entry,/reconcileActiveSyncProjection/);
});
