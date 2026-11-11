const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'runnerbear-v20-health.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function harness({ payload, status = 200, body = null, fetcher, timers } = {}) {
  const listeners = {};
  const health = { innerHTML: '', addEventListener(name, handler) { listeners['health:' + name] = handler; } };
  const fetched = [];
  const switches = [];
  const window = {
    RunnerBearCloudV11: { snapshot: () => ({
      planRevisionId: 'rev-1',
      bodyResponse: body ? { ...body, version: 'body-response-1', planRevisionId: 'rev-1' } : null,
    }) },
    RunnerBearCoachOS: { switchView: (name) => switches.push(name) },
    addEventListener(name, handler) { listeners[name] = handler; },
  };
  const context = {
    window,
    document: {
      getElementById: (id) => id === 'health' ? health : null,
    },
    fetch: async (url, options) => {
      fetched.push(url);
      if(fetcher)return fetcher(url,options);
      return { ok: status === 200, json: async () => payload };
    },
    Intl, AbortController, setTimeout:timers?.setTimeout||setTimeout, clearTimeout:timers?.clearTimeout||clearTimeout,
    requestAnimationFrame: (fn) => fn(),
  };
  vm.runInNewContext(script, context, { filename: 'runnerbear-v20-health.js' });
  return { health, listeners, fetched, switches, control: window.RunnerBearV20Health };
}

const sample = {
  ok: true,
  windowDays: 7,
  dateTo: '2026-11-10',
  daysWithAnyData: 6,
  metrics: {
    hrvMs: { median: 41, samples: 6 },
    sleepSeconds: { median: 25920, samples: 6 },
    restingHeartRateBpm: { median: 50, samples: 6 },
    spo2AveragePct: { mean: 95, samples: 6 },
    spo2MinimumPct: { lowestRecorded: 84, samples: 6 },
  },
  recordedMinimumBelow90Nights: 2,
};

test('the four navigation tabs are present twice, and original settings view is preserved', () => {
  for (const name of ['today', 'plan', 'health', 'race']) {
    assert.equal((html.match(new RegExp('data-tab="' + name + '"', 'g')) || []).length, 2);
  }
  assert.equal((html.match(/data-tab="more"/g) || []).length, 0);
  assert.match(html, /id="more" class="view"/);
  assert.match(html, /runnerbear-v20-health\.js\?v=13301/);
});

test('health view uses the API and displays real metrics with coverage', async () => {
  const app = harness({ payload: sample, body: { freshness: { status: 'fresh' }, summary: 'Testvurdering fra data' } });
  app.control.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(app.fetched, ['/api/v2/health/trends?window=7']);
  assert.match(app.health.innerHTML, /Slik svarer kroppen/);
  assert.match(app.health.innerHTML, /41/);
  assert.match(app.health.innerHTML, /7 t 12 min/);
  assert.match(app.health.innerHTML, /6 av 7 dager/);
  assert.match(app.health.innerHTML, /Testvurdering fra data/);
});

test('missing values do not become normal readings or invented values', async () => {
  const app = harness({ payload: { ...sample, metrics: { ...sample.metrics, hrvMs: { median: null, samples: 0 } } } });
  app.control.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.health.innerHTML, /Mangler/);
  assert.match(app.health.innerHTML, /venter fortsatt på et bekreftet helsegrunnlag/);
  assert.doesNotMatch(app.health.innerHTML, /Testvurdering/);
});

test('breathing screen separates recorded minima from diagnosis', async () => {
  const app = harness({ payload: { ...sample, windowDays: 30 } });
  app.control.open('breathing');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(app.fetched, ['/api/v2/health/sleep-breathing?window=30']);
  assert.match(app.health.innerHTML, /Nattlig SpO₂/);
  assert.match(app.health.innerHTML, /ikke antall pustestopp/);
  assert.match(app.health.innerHTML, /snakke med fastlegen/);
  assert.match(app.health.innerHTML, /6 av 30 netter/);
});

test('error state offers retry instead of a fabricated health summary', async () => {
  const app = harness({ payload: null, status: 503 });
  app.control.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.health.innerHTML, /Prøv igjen/);
  assert.doesNotMatch(app.health.innerHTML, /41 ms/);
});

test('cache separates endpoints, reuses fresh data and deduplicates concurrent requests',async()=>{
 let resolve;const app=harness({fetcher:()=>new Promise(r=>{resolve=r})});
 const first=app.control.open();const duplicate=app.control.loadRange(7);assert.equal(app.fetched.length,1);
 resolve({ok:true,json:async()=>sample});await Promise.all([first,duplicate]);
 await app.control.open();assert.equal(app.fetched.length,1);
 const breathing=app.control.open('breathing');resolve({ok:true,json:async()=>({...sample,windowDays:30})});await breathing;
 const seven=app.control.loadRange(7);assert.equal(app.fetched.length,3);resolve({ok:true,json:async()=>sample});await seven;
 assert.match(app.fetched[2],/sleep-breathing/);
});
test('superseded requests abort and late responses cannot replace the selected range',async()=>{
 const calls=[];const app=harness({fetcher:(url,options)=>new Promise(resolve=>calls.push({resolve,options}))});
 const old=app.control.open();const latest=app.control.loadRange(90);assert.equal(calls[0].options.signal.aborted,true);
 calls[1].resolve({ok:true,json:async()=>({...sample,windowDays:90,daysWithAnyData:89})});await latest;
 calls[0].resolve({ok:true,json:async()=>sample});await old;
 assert.match(app.health.innerHTML,/89 av 90 dager/);assert.doesNotMatch(app.health.innerHTML,/6 av 7 dager/);
});
test('timeout offers retry and keeps previous valid data during retry',async()=>{
 let expire;const app=harness({payload:sample,timers:{setTimeout:fn=>{expire=fn;return 1},clearTimeout:()=>{}}});
 await app.control.open();assert.match(app.health.innerHTML,/41/);
 // Force a refresh; successful payload still retained while request runs.
 const refresh=app.control.loadRange(7,true);assert.match(app.health.innerHTML,/Viser sist hentede/);await refresh;
 const slow=harness({timers:{setTimeout:fn=>{expire=fn;return 1},clearTimeout:()=>{}},fetcher:(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'}))))});
 const pending=slow.control.open();expire();await pending;assert.match(slow.health.innerHTML,/lang tid/);assert.match(slow.health.innerHTML,/Prøv igjen/);
});
test('switching to cached overview clears the aborted request before another breathing load',async()=>{
 const calls=[];const app=harness({fetcher:(url,options)=>new Promise(resolve=>calls.push({resolve,options}))});
 const overview=app.control.open();calls[0].resolve({ok:true,json:async()=>sample});await overview;
 const pending=app.control.open('breathing');await app.control.open('overview');assert.equal(calls[1].options.signal.aborted,true);
 const again=app.control.open('breathing');assert.equal(calls.length,3);
 calls[2].resolve({ok:true,json:async()=>({...sample,windowDays:30})});await again;
 calls[1].resolve({ok:true,json:async()=>({...sample,windowDays:30})});await pending;
 assert.match(app.health.innerHTML,/Nattlig SpO₂/);
});
