const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const planRevisionId='pr-1031';
const row=(workoutId,localDate,overrides={})=>({workoutId,lineageId:workoutId,planRevisionId,localDate,slotIndex:0,status:'scheduled',sport:'running',workoutType:'easy',title:'8 km rolig',intent:'easy',prescription:{version:1},plannedDistanceM:8000,plannedLoad:{integrity:{targetWeeklyVolume:50,expectedQualitySessions:2}},source:'test',lockLevel:'none',...overrides});

test('weekly review distinguishes running, alternative training and missed work without false running kilometres',async()=>{
  const {buildWeeklyReview}=await import('../cloud/runnerbear-cloud/src/v1031/review-engine.js'),plan={planRevisionId,items:[
    row('easy','2026-08-17'),row('quality','2026-08-18',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold',plannedDistanceM:10000}),row('crossed','2026-08-19'),row('missed','2026-08-20')
  ]},activities=[
    {source_id:'garmin-1',date:'2026-08-17',sport_type:'running',distance_m:8100},
    {source_id:'garmin-2',date:'2026-08-18',sport_type:'running',distance_m:10100},
    {source_id:'c2-1',date:'2026-08-19',sport_type:'rowing',distance_m:10000,duration_seconds:2400}
  ],review=buildWeeklyReview({plan,activities,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(review.version,'weekly-review-1');assert.equal(review.planRevisionId,planRevisionId);assert.equal(review.totals.completedDistanceM,18200);assert.equal(review.totals.alternativeSessions,1);assert.equal(review.totals.missedSessions,1);assert.equal(review.sessions.find(x=>x.workoutId==='crossed').actualDistanceM,0);assert.equal(review.attention,'watch');
});

test('missed workout evaluation is forward-only and creates no training debt',async()=>{
  const {buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v1031/review-engine.js'),yesterday=row('missed','2026-08-23',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold'}),future=row('future','2026-08-27',{workoutType:'quality',title:'20 × 45/15',intent:'threshold'}),plan={planRevisionId,items:[yesterday,future]},proposal=buildRealignmentProposal({plan,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(proposal.trigger,'missed_workout');assert.equal(proposal.status,'unchanged');assert.equal(proposal.trainingDebt,false);assert.equal(proposal.affectedWorkoutIds.length,0);assert.deepEqual(proposal.rows,plan.items);assert.match(proposal.summary,/flyttes ikke blindt/i);
});

test('explicit illness removes only unlocked future running inside 72 hours and never increases dose',async()=>{
  const {buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v1031/review-engine.js'),past=row('past','2026-08-23',{status:'completed'}),today=row('today','2026-08-24',{workoutType:'quality',title:'6 × 6 min terskel',intent:'threshold',plannedDistanceM:11000}),tomorrow=row('tomorrow','2026-08-25'),locked=row('race','2026-08-26',{workoutType:'race',title:'Løp',lockLevel:'system'}),later=row('later','2026-08-27'),plan={planRevisionId,items:[past,today,tomorrow,locked,later]},events=[{event_id:'ill-1',occurred_at:'2026-08-24T07:00:00Z',local_date:'2026-08-24',payload:{illness:true,responseDate:'2026-08-24'}}],proposal=buildRealignmentProposal({plan,events,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'});
  assert.equal(proposal.trigger,'illness_reported');assert.equal(proposal.status,'needs_input');assert.equal(proposal.autoEligible,false);assert.equal(proposal.rows.find(x=>x.workoutId==='past').status,'completed');assert.equal(proposal.rows.find(x=>x.workoutId==='today').sport,'rest');assert.equal(proposal.rows.find(x=>x.workoutId==='tomorrow').plannedDistanceM,0);assert.equal(proposal.rows.find(x=>x.workoutId==='race').workoutType,'race');assert.equal(proposal.rows.find(x=>x.workoutId==='later').plannedDistanceM,8000);assert.equal(proposal.trainingDebt,false);
});

test('alternative training replaces aerobic support with zero mechanical running credit',async()=>{
  const {buildRealignmentProposal}=await import('../cloud/runnerbear-cloud/src/v1031/review-engine.js'),plan={planRevisionId,items:[row('today','2026-08-24'),row('future','2026-08-25')]},activities=[{source_id:'row-1',date:'2026-08-24',sport_type:'rowing',title:'Concept2 40 min',duration_seconds:2400,distance_m:10000}],proposal=buildRealignmentProposal({plan,activities,today:'2026-08-24',generatedAt:'2026-08-24T08:00:00Z'}),replacement=proposal.rows.find(x=>x.workoutId==='today');
  assert.equal(proposal.trigger,'alternative_training');assert.equal(proposal.autoEligible,true);assert.equal(replacement.status,'replaced');assert.equal(replacement.sport,'cross');assert.equal(replacement.plannedDistanceM,0);assert.equal(replacement.plannedLoad.realignment.originalDistanceM,8000);assert.match(proposal.consequence,/ingen løpskilometer/i);
});

test('sync repair classifies activation, source and structural conflicts with explicit verification only',async()=>{
  const {buildSyncRepair,canExplicitlyVerify}=await import('../cloud/runnerbear-cloud/src/v1031/sync-repair.js'),operations=[
    {operation_id:'a',workout_id:'w1',plan_revision_id:planRevisionId,operation_type:'create',status:'review_required',last_error:'PLAN_ACTIVATION_REQUIRED',title:'8 km rolig'},
    {operation_id:'b',workout_id:'w2',plan_revision_id:planRevisionId,operation_type:'move',status:'review_required',last_error:'SOURCE_NOT_FOUND'},
    {operation_id:'c',workout_id:'w3',plan_revision_id:planRevisionId,operation_type:'cancel',status:'review_required',last_error:'STRUCTURAL_CHANGE_REQUIRES_REVIEW'}
  ],repair=buildSyncRepair(operations,planRevisionId);
  assert.equal(repair.attention,'action');assert.equal(repair.counts.actionRequired,3);assert.deepEqual(repair.items.map(x=>x.kind),['activation_required','source_missing','structural_review']);assert.equal(canExplicitlyVerify(operations[2]),true);assert.match(repair.items[2].verifyLabel,/kontroller/i);
});

test('10.31 uses a new entrypoint and exposes accessible review and repair UI',()=>{
  const config=fs.readFileSync('cloud/runnerbear-cloud/wrangler.jsonc','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1031.js','utf8'),base=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1031-base.js','utf8'),ui=fs.readFileSync('runnerbear-ui-v1031-source.js','utf8'),manifest=JSON.parse(fs.readFileSync('runnerbear-v1031-assets.json','utf8'));
  assert.match(config,/index-v1031\.js/);assert.match(entry,/v1031\/routes\.js/);assert.match(base,/v1031\/routes\.js/);assert.match(ui,/function weeklyReviewCardHtml/);assert.match(ui,/role="dialog" aria-modal="true" aria-labelledby="rb1031ReviewTitle"/);assert.match(ui,/data-rb1031-sync-verify/);assert.ok(manifest.styles.includes('runnerbear-v1031-coach-package.css'));
});

test('bootstrap keeps realignment forward-only without returning a duplicate full plan payload',()=>{
  const readModel=fs.readFileSync('cloud/runnerbear-cloud/src/v1031/read-model.js','utf8');
  assert.match(readModel,/function publicRealignment\(proposal\)/);
  assert.match(readModel,/const \{rows,changes,\.\.\.summary\}=proposal/);
  assert.match(readModel,/realignmentProposal:publicRealignment\(realignmentProposal\)/);
});
