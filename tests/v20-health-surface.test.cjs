const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'runnerbear-v20-health.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function harness({ payload, status = 200, body = null } = {}) {
  const listeners = {};
  const health = { innerHTML: '', addEventListener(name, handler) { listeners['health:' + name] = handler; } };
  const settings = { addEventListener(name, handler) { listeners['settings:' + name] = handler; } };
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
      querySelector: (selector) => selector === '[data-rb20-settings]' ? settings : null,
    },
    fetch: async (url) => {
      fetched.push(url);
      return { ok: status === 200, json: async () => payload };
    },
    Intl,
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

test('the four navigation tabs are present twice, and settings remain reachable', () => {
  for (const name of ['today', 'plan', 'health', 'race']) {
    assert.equal((html.match(new RegExp('data-tab="' + name + '"', 'g')) || []).length, 2);
  }
  assert.equal((html.match(/data-tab="more"/g) || []).length, 0);
  assert.match(html, /data-rb20-settings/);
  assert.match(html, /id="more" class="view"/);
  assert.match(html, /runnerbear-v20-health\.js\?v=20001/);
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
  assert.match(app.health.innerHTML, /Vi trenger bekreftede, ferske data/);
  assert.doesNotMatch(app.health.innerHTML, /Testvurdering/);
});

test('breathing screen separates recorded minima from diagnosis', async () => {
  const app = harness({ payload: { ...sample, windowDays: 28 } });
  app.control.open('breathing');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(app.fetched, ['/api/v2/health/trends?window=28']);
  assert.match(app.health.innerHTML, /Nattlig SpO₂/);
  assert.match(app.health.innerHTML, /ikke antall pustestopp/);
  assert.match(app.health.innerHTML, /snakke med fastlegen/);
  assert.match(app.health.innerHTML, /24 av 28 netter|6 av 28 netter/);
});

test('error state offers retry instead of a fabricated health summary', async () => {
  const app = harness({ payload: null, status: 503 });
  app.control.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.health.innerHTML, /Prøv igjen/);
  assert.doesNotMatch(app.health.innerHTML, /41 ms/);
});
