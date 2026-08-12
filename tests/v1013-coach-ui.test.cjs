const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('runnerbear-v107-coach-os.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('runnerbear-v1013-coach-ui.css','utf8');
const manifest=JSON.parse(fs.readFileSync('site.webmanifest','utf8'));
const version=JSON.parse(fs.readFileSync('runnerbear-version.json','utf8'));

test('v10.13 mounts one coach-first brand and navigation system',()=>{
  assert.match(html,/runnerbear-v1013-coach-ui\.css\?v=1013/);
  assert.match(html,/>Mål<\/button>/);
  assert.match(app,/Coachens beslutning/);
  assert.match(app,/version:'10\.13'/);
  assert.match(css,/Garmin owns the raw record\. RunnerBear owns the next decision\./);
});

test('today switches from the prescription to a result-first coach surface',()=>{
  assert.match(app,/Dagens resultat/);
  assert.match(app,/Coachens vurdering/);
  assert.match(app,/Vis full coachanalyse/);
  assert.match(app,/Vis opprinnelig plan/);
  assert.match(app,/nextWorkoutHtml/);
});

test('plan defaults to a focused week and offers four-week context',()=>{
  assert.match(app,/>Uke<\/button>/);
  assert.match(app,/>4 uker<\/button>/);
  assert.match(app,/Planen åpner på i dag/);
  assert.match(app,/Gjennomførte økter og coachanalyser/);
});

test('Achilles protection replaces an easy run with low-impact Zwift',()=>{
  assert.match(app,/Zwift · akillesavlastning/);
  assert.match(app,/45–60 min svært rolig sykling/);
  assert.match(app,/ingen aggressive hældropp under trinnnivå/i);
  assert.match(app,/Ingen treningsgjeld/);
});

test('PWA and live build identify the same production release',()=>{
  assert.equal(manifest.start_url,'/?app=v1013');
  assert.equal(version.build,'10.13');
  assert.equal(version.channel,'live');
});
