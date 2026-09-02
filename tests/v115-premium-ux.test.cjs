const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=file=>fs.readFileSync(file,'utf8');

test('v11.6 replaces the decision chat with contextual coach surfaces',()=>{
  const ui=read('runnerbear-ui-v11-source.js'),css=read('runnerbear-v116-contextual-coach.css'),manifest=JSON.parse(read('runnerbear-v11-assets.json'));
  assert.match(ui,/function contextualCoach\(/);
  assert.match(ui,/function contextualHealthStripHtml\(/);
  assert.match(ui,/function contextualWorkoutCoachHtml\(/);
  assert.match(ui,/function contextualPlanNoticeHtml\(/);
  assert.match(ui,/surfaces\?\.goal/);
  assert.match(ui,/Coachens råd/);
  assert.match(ui,/Etter økten/);
  assert.doesNotMatch(ui,/Coach Live|coachLive|coach-live|data-rb112|rb112/);
  assert.match(css,/The coach speaks once, in context/);
  assert.match(css,/\.rb116-workout-coach/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.deepEqual(manifest.styles.slice(-4),['runnerbear-v113-one-decision.css','runnerbear-v114-closed-loop.css','runnerbear-v116-contextual-coach.css','runnerbear-v12-concept-one.css']);
  assert.equal(manifest.styles.length,27);
  assert.ok(!manifest.styles.includes('runnerbear-v112-coach-live.css'));
  assert.ok(!manifest.styles.includes('runnerbear-v1141-reliability.css'));
  assert.ok(!manifest.styles.includes('runnerbear-v115-premium-ux.css'));
});

test('v11.6 keeps one accessible dialog contract and locks contextual coach authority',()=>{
  const ui=read('runnerbear-ui-v11-source.js'),css=read('runnerbear-v116-contextual-coach.css'),entry=read('cloud/runnerbear-cloud/src/v116/contextual-coach.js'),config=read('cloud/runnerbear-cloud/wrangler.jsonc'),workflow=read('.github/workflows/runnerbear-cloud-deploy.yml');
  assert.match(ui,/\[role="dialog"\]\[aria-modal="true"\]/);
  assert.match(ui,/button:not\(\[disabled\]\).*textarea:not\(\[disabled\]\)/);
  assert.match(css,/One calm contract for every dialog and sheet/);
  assert.match(css,/\.rb1020-modal,\.rb109-modal/);
  assert.match(entry,/mode:'background'/);
  assert.match(entry,/silentWhenNormal:true/);
  assert.match(entry,/oneRecommendationPerSurface:true/);
  assert.match(entry,/planWritesByAi:false/);
  assert.match(entry,/maximumReductionPercent:20/);
  assert.match(entry,/navigationTabs:4/);
  assert.match(entry,/coachLive:false/);
  assert.match(config,/src\/index-v118\.js/);
  assert.doesNotMatch(config,/COACH_LIVE_MODEL|"binding":\s*"AI"/);
  assert.match(workflow,/verify-v116-health\.mjs/);
  assert.match(workflow,/coach_live_removed/);
});
