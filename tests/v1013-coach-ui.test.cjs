const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'runnerbear-v107-coach-os.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'runnerbear-v1013-coach-ui.css'),'utf8');
const polish=fs.readFileSync(path.join(root,'runnerbear-v1014-premium-polish.css'),'utf8');
const goalsMore=fs.readFileSync(path.join(root,'runnerbear-v1016-goals-more.css'),'utf8');
const ux=fs.readFileSync(path.join(root,'runnerbear-v1017-ux.css'),'utf8');
const planPreferences=fs.readFileSync(path.join(root,'runnerbear-v1018-plan-preferences.css'),'utf8');
const designSystem=fs.readFileSync(path.join(root,'runnerbear-v1019-design-system.css'),'utf8');
const screenFidelity=fs.readFileSync(path.join(root,'runnerbear-v1019b-screen-fidelity.css'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'site.webmanifest'),'utf8'));
const version=JSON.parse(fs.readFileSync(path.join(root,'runnerbear-version.json'),'utf8'));

test('v10.13 mounts one coach-first brand and navigation system',()=>{
  assert.match(html,/runnerbear-v1013-coach-ui\.css\?v=1013/);
  assert.match(html,/>Mål<\/button>/);
  assert.match(app,/Coachens vurdering/);
  assert.match(app,/version:'10\.19b'/);
  assert.match(css,/Garmin owns the raw record\. RunnerBear owns the next decision\./);
});

test('today switches from the prescription to a result-first coach surface',()=>{
  assert.match(app,/Dagens resultat/);
  assert.match(app,/Coachens vurdering/);
  assert.match(app,/Vis full coachanalyse/);
  assert.match(app,/Vis opprinnelig plan/);
});

test('plan defaults to one vertical fidelity week with long-term access',()=>{
  assert.match(app,/Din plan/);
  assert.match(app,/data-rb119b-plan-lens="week"/);
  assert.match(app,/data-rb119b-plan-lens="focus"/);
  assert.match(app,/data-rb119b-plan-lens="long"/);
  assert.match(app,/Gjennomførte økter og coachanalyser/);
});

test('Achilles protection replaces an easy run with low-impact Zwift',()=>{
  assert.match(app,/Zwift · akillesavlastning/);
  assert.match(app,/45–60 min svært rolig sykling/);
  assert.match(app,/ingen aggressive hældropp under trinnnivå/i);
  assert.match(app,/Ingen treningsgjeld/);
});

test('PWA and live build identify the same production release',()=>{
  assert.equal(manifest.start_url,'/?app=v1019b');
  assert.equal(version.build,'10.19b');
  assert.equal(version.channel,'live');
});

test('v10.16 presents goals as evidence gates instead of misleading progress',()=>{
  assert.match(html,/runnerbear-v1016-goals-more\.css\?v=1016/);
  assert.match(app,/Veien mot målet/);
  assert.match(app,/data-rb116-open-gate/);
  assert.match(app,/Godkjennes bare med stabil pust/);
  assert.match(app,/Trend vises etter 3 valide terskeløkter/);
  assert.doesNotMatch(goalsMore,/rb115-goal-track/);
});

test('v10.19b keeps More insight-first while preserving real controls',()=>{
  assert.match(app,/Mer innsikt/);
  assert.match(app,/Terskelhistorikk/);
  assert.match(app,/Skorotasjon/);
  assert.match(app,/Bakken-prinsippene/);
  assert.match(app,/data-rb108-publish-plan/);
  assert.match(app,/data-rb107-control="autopilot"/);
  assert.match(app,/data-rb109-goal-open/);
});

test('v10.19b gives Today three explicit, mutually exclusive states',()=>{
  assert.match(html,/runnerbear-v1017-ux\.css\?v=1017/);
  assert.match(app,/Dagens økt/);
  assert.match(app,/Aktivitet registrert · analyse pågår/);
  assert.match(app,/Dagens resultat/);
  assert.doesNotMatch(app,/function nextWorkoutHtml/);
  assert.doesNotMatch(app,/Ett signal fortjener oppmerksomhet/);
});

test('v10.17 makes coach changes visible, explained and reversible',()=>{
  assert.match(app,/function planChange/);
  assert.match(app,/function changeNoticeHtml/);
  assert.match(app,/Hvorfor\?/);
  assert.match(app,/Angre endringen/);
  assert.match(app,/data-rb117-undo-change/);
  assert.match(app,/planChange\(p\)\?'adjusted'/);
  assert.match(ux,/\.rb107-day-chip\.adjusted:before/);
  assert.match(app,/Coachlogg/);
});

test('v10.19b gives goal administration to Mål only',()=>{
  const goals=app.slice(app.indexOf('function goalsHtml'),app.indexOf('const KNOWN_SHOES'));
  const more=app.slice(app.indexOf('function moreHtml'),app.indexOf('function archivePrimary'));
  assert.match(goals,/data-rb109-goal-open/);
  assert.doesNotMatch(more,/data-rb109-goal-open/);
  assert.doesNotMatch(more,/Profil og mål/);
  assert.match(more,/Verktøy og innstillinger/);
});

test('v10.19b presents one week with three fidelity lenses',()=>{
  const plan=app.slice(app.indexOf('function planHtml'),app.indexOf('function secondaryGoalsHtml'));
  assert.match(html,/runnerbear-v1018-plan-preferences\.css\?v=1018/);
  assert.match(app,/rb119b-plan-list/);
  assert.match(plan,/>Uke</);
  assert.match(plan,/>Fokus</);
  assert.match(plan,/>Langsiktig</);
  assert.doesNotMatch(plan,/data-rb107-plan-view="overview"/);
});

test('v10.18 exposes editable training preferences and migrates old rhythm',()=>{
  assert.match(app,/function migrateTrainingPreferences/);
  assert.match(app,/data-rb118-preferences-form/);
  assert.match(app,/Normalvolum/);
  assert.match(app,/Coachområde fra/);
  assert.match(app,/Foretrukne kvalitetsdager/);
  assert.match(app,/Alternative dager/);
  assert.match(app,/legacy\.weekRhythm/);
});

test('v10.18 supports four one-off day choices and semantic status tones',()=>{
  assert.match(app,/Kun denne dagen/);
  assert.match(app,/\['rest','moon','Hvile'\]/);
  assert.match(app,/runnerbear_v118_day_modes/);
  assert.match(planPreferences,/--rb118-approved/);
  assert.match(planPreferences,/--rb118-workout/);
  assert.match(planPreferences,/--rb118-attention/);
  assert.match(planPreferences,/--rb118-action/);
  assert.match(planPreferences,/--rb118-uncertain/);
});

test('v10.19 locks one calm premium design system across all four views',()=>{
  assert.match(html,/runnerbear-v1019-design-system\.css\?v=1019/);
  assert.match(designSystem,/Design Direction 1\.0 \/ Concept 1 \/ Premium rolig/);
  assert.match(designSystem,/--rb19-canvas:#f5f3ed/);
  assert.match(designSystem,/--rb19-forest:#16432f/);
  assert.match(designSystem,/\.rb107-today-head h1,\.rb107-section-head h1/);
  assert.match(designSystem,/\/\* Plan \*\//);
  assert.match(designSystem,/\/\* Mål \*\//);
  assert.match(designSystem,/\/\* Mer \*\//);
  assert.match(app,/coach:'<path/);
  assert.doesNotMatch(app,/rb116-coach-mark'>M</);
});

test('v10.19b builds source-of-truth screen structures instead of another token override',()=>{
  assert.match(html,/runnerbear-v1019b-screen-fidelity\.css\?v=1019b/);
  assert.match(app,/rb119b-workout-hero/);
  assert.match(app,/rb119b-plan-list/);
  assert.match(app,/rb119b-goal-corridor/);
  assert.match(app,/rb119b-threshold-card/);
  assert.match(screenFidelity,/runnerbear-v1019b-forest\.webp/);
  assert.match(screenFidelity,/--rb19b-display/);
  assert.match(screenFidelity,/\/\* I dag \*\//);
  assert.match(screenFidelity,/\/\* Plan \*\//);
  assert.match(screenFidelity,/\/\* Mål \*\//);
  assert.match(screenFidelity,/\/\* Mer \*\//);
  assert.doesNotMatch(html,/[●▤◎]/);
  assert.doesNotMatch(html,/[😴🦶⏱📅]/u);
});
