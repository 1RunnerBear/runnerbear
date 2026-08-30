const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=file=>fs.readFileSync(file,'utf8');

test('v11.5 makes Coach Live a structured decision workspace',()=>{
  const ui=read('runnerbear-ui-v11-source.js'),css=read('runnerbear-v115-premium-ux.css'),manifest=JSON.parse(read('runnerbear-v11-assets.json'));
  assert.match(ui,/function coachLiveAnswerHtml/);
  assert.match(ui,/Mitt råd\|Hvorfor\|Planen/);
  assert.match(ui,/aria-relevant="additions text"/);
  assert.match(ui,/Vurderer planen/);
  assert.match(ui,/Ingen plan endres her/);
  assert.match(ui,/enterkeyhint="send"/);
  assert.match(ui,/!e\.shiftKey&&!e\.isComposing/);
  assert.match(css,/decision workspace, not a generic chat window/);
  assert.match(css,/\.rb115-coach-section/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.deepEqual(manifest.styles.slice(-3),['runnerbear-v113-one-decision.css','runnerbear-v114-closed-loop.css','runnerbear-v115-premium-ux.css']);
  assert.equal(manifest.styles.length,26);
  assert.ok(!manifest.styles.includes('runnerbear-v112-coach-live.css'));
  assert.ok(!manifest.styles.includes('runnerbear-v1141-reliability.css'));
});

test('v11.5 locks one accessible dialog contract without changing coach authority',()=>{
  const ui=read('runnerbear-ui-v11-source.js'),css=read('runnerbear-v115-premium-ux.css'),entry=read('cloud/runnerbear-cloud/src/index-v115.js'),config=read('cloud/runnerbear-cloud/wrangler.jsonc'),workflow=read('.github/workflows/runnerbear-cloud-deploy.yml');
  assert.match(ui,/\[role="dialog"\]\[aria-modal="true"\]/);
  assert.match(ui,/button:not\(\[disabled\]\).*textarea:not\(\[disabled\]\)/);
  assert.match(css,/One calm contract for every dialog and sheet/);
  assert.match(css,/\.rb1020-modal,\.rb109-modal/);
  assert.match(entry,/premiumUxAudit/);
  assert.match(entry,/coachLiveStructured:true/);
  assert.match(entry,/unifiedDialogContract:true/);
  assert.match(entry,/keyboardFocusTrap:true/);
  assert.match(entry,/planWritesByAi:false/);
  assert.match(entry,/maximumReductionPercent:20/);
  assert.match(entry,/navigationTabs:4/);
  assert.match(config,/src\/index-v115\.js/);
  assert.match(workflow,/premiumUxAudit\?\.ok!==true/);
  assert.match(workflow,/Number\(x\.premiumUxAudit\?\.maximumReductionPercent\|\|0\)!==20/);
});
