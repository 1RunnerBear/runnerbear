const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'runnerbear-ui-v1025.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'runnerbear-v1013-coach-ui.css'),'utf8');
const polish=fs.readFileSync(path.join(root,'runnerbear-v1014-premium-polish.css'),'utf8');
const goalsMore=fs.readFileSync(path.join(root,'runnerbear-v1016-goals-more.css'),'utf8');
const ux=fs.readFileSync(path.join(root,'runnerbear-v1017-ux.css'),'utf8');
const planPreferences=fs.readFileSync(path.join(root,'runnerbear-v1018-plan-preferences.css'),'utf8');
const designSystem=fs.readFileSync(path.join(root,'runnerbear-v1019-design-system.css'),'utf8');
const screenFidelity=fs.readFileSync(path.join(root,'runnerbear-v1019b-screen-fidelity.css'),'utf8');
const finalFidelity=fs.readFileSync(path.join(root,'runnerbear-v1019c-final-fidelity.css'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'site.webmanifest'),'utf8'));
const version=JSON.parse(fs.readFileSync(path.join(root,'runnerbear-version.json'),'utf8'));
const assets=JSON.parse(fs.readFileSync(path.join(root,'runnerbear-v1025-assets.json'),'utf8'));

function assertCanonicalStyle(source){
  assert.match(html,/runnerbear-v1025\.css\?v=10251/);
  assert.ok(assets.styles.includes(source),`${source} remains in the canonical stylesheet`);
}

test('v10.13 mounts one coach-first brand and navigation system',()=>{
  assertCanonicalStyle('runnerbear-v1013-coach-ui.css');
  assert.match(html,/>Mål<\/button>/);
  assert.match(app,/Coachens vurdering/);
  assert.match(app,/version:'10\.25\.1'/);
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
  assert.equal(manifest.start_url,'/?app=v10251');
  assert.equal(version.build,'10.25.1');
  assert.equal(version.channel,'live');
});

test('v10.16 presents goals as evidence gates instead of misleading progress',()=>{
  assertCanonicalStyle('runnerbear-v1016-goals-more.css');
  assert.match(app,/Veien mot målet/);
  assert.match(app,/data-rb116-open-gate/);
  assert.match(app,/Godkjennes bare med stabil pust/);
  assert.match(app,/Trend vises når grunnlaget er sammenlignbart/);
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
  assertCanonicalStyle('runnerbear-v1017-ux.css');
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
  assertCanonicalStyle('runnerbear-v1018-plan-preferences.css');
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
  assertCanonicalStyle('runnerbear-v1019-design-system.css');
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
  assertCanonicalStyle('runnerbear-v1019b-screen-fidelity.css');
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

test('v10.19c uses a contextual premium hero bank instead of one forest image',()=>{
  assertCanonicalStyle('runnerbear-v1019c-final-fidelity.css');
  assert.match(app,/const HERO_BANK=/);
  for(const name of ['tempo','intervals','race','urban','recovery','strength']){
    assert.match(app,new RegExp(`runnerbear-hero-${name}-v1019c\\.webp`));
    assert.ok(fs.existsSync(path.join(root,`runnerbear-hero-${name}-v1019c.webp`)));
  }
  assert.match(app,/heroNameForWorkout/);
  assert.match(app,/heroNameForGoal/);
  assert.match(finalFidelity,/var\(--rb119c-hero\)/);
});

test('v10.19c makes Today coach-led with interpreted health and load signals',()=>{
  assert.match(app,/Coachen følger med/);
  assert.match(app,/function coachWatchHtml/);
  assert.match(app,/Søvn/);
  assert.match(app,/HRV/);
  assert.match(app,/Restitusjon/);
  assert.match(app,/Belastning/);
  assert.match(app,/Kroppssjekk/);
  assert.match(finalFidelity,/\.rb119c-health-grid/);
});

test('v10.19c gives Plan a useful month, focus and long-term hierarchy',()=>{
  assert.match(app,/function monthCalendarHtml/);
  assert.match(app,/data-rb119c-month-focus/);
  assert.match(app,/data-rb119c-calendar-day/);
  assert.match(app,/function focusHtml/);
  assert.match(app,/function longTermHtml/);
  assert.match(app,/function dayViewHtml/);
  assert.match(app,/state\.planDayViewOpen\?dayPlan:normalPlan/);
  assert.match(finalFidelity,/\.rb119c-month-grid/);
  assert.match(finalFidelity,/\.rb119c-focus/);
  assert.match(finalFidelity,/\.rb119c-long/);
});

test('v10.19c ships the final outline icons in initial navigation markup',()=>{
  const nav=html.slice(html.indexOf('<nav class="bottom-nav"'),html.indexOf('</nav></div>'));
  assert.equal((nav.match(/class="rb107-icon"/g)||[]).length,4);
  assert.doesNotMatch(nav,/[●▤◎]/);
});
