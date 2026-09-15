const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('runnerbear-v11.css','utf8'),ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8');
test('foundation cannot regress to runtime-selected color or navigation geometry',()=>{
 assert.doesNotMatch(css,/html\.rb107-ready/);
 assert.doesNotMatch(css,/html\.rb108-booting\s+\.(?:desktop-nav|bottom-nav)/);
 assert.match(css,/--canvas:#f5f3ed/);assert.match(css,/--paper:#fffdf8/);
 assert.match(css,/\.bottom-nav\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
test('hero prescriptions are outside the fixed media frame and bank images carry focal metadata',()=>{
 const fn=ui.slice(ui.indexOf('function workoutHeroHtml('),ui.indexOf('function todayCoachHtml('));
 assert.match(fn,/<\/button><section class="rb125-workout-information"/);
 assert.doesNotMatch(fn.split('</button>')[0],/rb119b-hero-metrics|esc\(recovery\)|esc\(main\)/);
 for(const name of ['tempo','intervals','race','urban','recovery','strength'])assert.match(ui,new RegExp(name+":\\{src:'[^']+',position:'[0-9]+% [0-9]+%'\\}"));
 assert.match(css,/\.rb119b-workout-hero\{aspect-ratio:16 \/ 10/);
 assert.match(css,/\.rb119b-goal-hero\{aspect-ratio:16 \/ 9/);
});
