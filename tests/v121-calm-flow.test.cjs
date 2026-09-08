const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const calm=require('../runnerbear-v121-calm-flow.js');
const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
const review={weekStart:'2026-08-31',weekEnd:'2026-09-06',headline:'Jevn uke',totals:{completedDistanceM:48000},sessions:[{localDate:'2026-09-01',title:'Terskel',status:'completed'}]};
test('a read review stays quiet across revision and timestamp refreshes',()=>{
 const s=storage();calm.markSeen(s,'weekly-review',calm.reviewContent(review),'pr-a');
 assert.equal(calm.hasSeen(s,'weekly-review',calm.reviewContent({...review,planRevisionId:'pr-b',generatedAt:'later'})),true);
 assert.equal(calm.hasSeen(s,'weekly-review',calm.reviewContent({...review,totals:{completedDistanceM:50000}})),false);
 assert.equal(calm.hasSeen(s,'weekly-review',calm.reviewContent({...review,weekStart:'2026-09-07'})),false);
});
test('stable content identity ignores object key ordering and tolerates unavailable storage',()=>{
 assert.equal(calm.fingerprint({b:2,a:1}),calm.fingerprint({a:1,b:2}));
 const broken={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 assert.equal(calm.hasSeen(broken,'review',review),false);assert.doesNotThrow(()=>calm.markSeen(broken,'review',review));
});
test('one support slot prioritizes transport errors and changes without hiding the main decision',()=>{
 assert.equal(calm.chooseSupport({transport:'error',change:'undo',review:'review',priority:'week'}),'error');
 assert.equal(calm.chooseSupport({change:'undo',review:'review',priority:'week'}),'undo');
 assert.equal(calm.chooseSupport({review:'review',priority:'week'}),'review');
 assert.equal(calm.chooseSupport({priority:'week'}),'week');
});
test('normal sync states are silent; errors and review states remain visible',()=>{
 for(const s of ['confirmed','queued','processing','synced','pending','idle','busy'])assert.equal(calm.exceptionalSync(s),false);
 for(const s of ['failed_retryable','failed_terminal','review_required','error'])assert.equal(calm.exceptionalSync(s),true);
});
test('sync is only called delayed after ten minutes with a trustworthy timestamp',()=>{
 const now=Date.parse('2026-09-08T12:00:00Z');
 assert.equal(calm.syncDelayed('2026-09-08T11:59:00Z',now),false);
 assert.equal(calm.syncDelayed('2026-09-08T11:49:00Z',now),true);
 assert.equal(calm.syncDelayed(undefined,now),false);
});
test('canonical workout copy never inherits obsolete instructions from the static date',()=>{
 const vm=require('node:vm'),ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8');
 const fn=ui.slice(ui.indexOf('function canonicalRows()'),ui.indexOf('function effectiveSchedule()'));
 const rows=[{workoutId:'wo-2026-09-08',localDate:'2026-09-08',workoutType:'easy',title:'6 km rolig',plannedDistanceM:6000,prescription:{legacy:{}}}];
 const context={window:{RunnerBearPlanReadModel:{get:()=>({flags:{coach_loop_ui:true},planRevisionId:'pr-current',activePlan:{items:rows}})}},rawSchedule:()=>[{ds:'2026-09-08',label:'old',week:5,type:'quality',detail:'4:02/km threshold',desc:'Old workout'}],today:()=> '2026-09-08',read:()=>({}),K:{},dateFrom:x=>x,dayDiff:()=>0,formatDate:x=>x};
 const mapped=vm.runInNewContext(fn+';canonicalRows()',context)[0];
 assert.equal(mapped.type,'easy');assert.equal(mapped.detail,'');assert.equal(mapped.desc,'');assert.equal(mapped.planRevisionId,'pr-current');
});
test('five ordered design layers meet the 25 percent compressed CSS reduction gate',()=>{
 const zlib=require('node:zlib'),manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
 assert.equal(manifest.styles.length,5);
 const css=fs.readFileSync('runnerbear-v11.css');assert.ok(zlib.gzipSync(css,{level:9}).length<=48084*.75);
 assert.doesNotMatch(css.toString(),/rb108-shoe|rb119b-shoe|rb112/);
});
test('first launch rejects missing cache without throwing or accepting an old plan',()=>{
 const integrity=require('../runnerbear-v1026-coach-loop.js');
 for(const value of [null,undefined,{},'invalid'])assert.deepEqual(integrity.assertRevision(value),{ok:false,code:'MISSING_PLAN_REVISION'});
});
test('Calm Flow is presentation-only and preserves the original history source',()=>{
 const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),core=fs.readFileSync('runnerbear-v121-calm-flow.js','utf8');
 assert.doesNotMatch(ui,/shoesState|classifyShoe|shoeKm|replaceRetiredShoeInFuturePlan|data-rb108-shoe/);
 assert.doesNotMatch(core,/fetch\(|removeItem\(|queueTredict|reconfigure\(/);
 assert.match(ui,/control=\(\)=>localStorage.getItem\(K.control\)\|\|'suggest'/);
 assert.match(ui,/data-rb121-insight/);assert.match(ui,/insightOpen.has\(id\)\?render\(\):''/);
 assert.match(ui,/const drafts=new Map/);assert.match(ui,/el.open=details.get\(key\)/);
 assert.doesNotMatch(ui,/data-rb119b-plan-lens="focus"/);
});
