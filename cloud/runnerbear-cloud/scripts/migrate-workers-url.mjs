import fs from 'node:fs';

const ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const LEGACY_SUBDOMAIN = 'torbjorn-forre';
const TARGET_SUBDOMAIN = 'runnerbear';
const LEGACY_WORKER = 'runnerbear-cloud';
const TARGET_WORKER = 'app';
const API = 'https://api.cloudflare.com/client/v4';
const mode = process.argv[2] || 'status';

if (!ACCOUNT_ID || !API_TOKEN) throw new Error('Cloudflare account/token missing');
if (!['status', 'apply'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);

async function cf(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const details = (data.errors || []).map((error) => `${error.code || ''} ${error.message || ''}`.trim()).join('; ');
    const failure = new Error(`Cloudflare API ${response.status}: ${details || response.statusText}`);
    failure.status = response.status;
    failure.errors = data.errors || [];
    throw failure;
  }
  return data.result;
}

function request(method, value) {
  return { method, body: JSON.stringify(value) };
}

async function changeSubdomain(from, to) {
  try {
    await cf(`/accounts/${ACCOUNT_ID}/workers/subdomain`, request('PUT', { subdomain: to }));
    return;
  } catch (error) {
    const alreadyAssociated = error.status === 409 && error.errors.some((item) => item?.code === 10036);
    if (!alreadyAssociated) throw error;
  }
  await cf(`/accounts/${ACCOUNT_ID}/workers/subdomain`, { method: 'DELETE' });
  try {
    await cf(`/accounts/${ACCOUNT_ID}/workers/subdomain`, request('PUT', { subdomain: to }));
  } catch (error) {
    await cf(`/accounts/${ACCOUNT_ID}/workers/subdomain`, request('PUT', { subdomain: from })).catch(() => {});
    throw error;
  }
}

async function state() {
  const [subdomainResult, workersResult] = await Promise.all([
    cf(`/accounts/${ACCOUNT_ID}/workers/subdomain`),
    cf(`/accounts/${ACCOUNT_ID}/workers/workers?per_page=100`),
  ]);
  const workers = Array.isArray(workersResult) ? workersResult : [];
  const legacy = workers.find((worker) => worker?.name === LEGACY_WORKER);
  const target = workers.find((worker) => worker?.name === TARGET_WORKER);
  if (legacy && target && legacy.id !== target.id) {
    throw new Error(`Cannot rename ${LEGACY_WORKER}: a different ${TARGET_WORKER} Worker already exists`);
  }
  if (!legacy && !target) throw new Error(`Neither ${LEGACY_WORKER} nor ${TARGET_WORKER} exists`);
  const subdomain = String(subdomainResult?.subdomain || '').toLowerCase();
  if (![LEGACY_SUBDOMAIN, TARGET_SUBDOMAIN].includes(subdomain)) {
    throw new Error(`Unexpected workers.dev subdomain: ${subdomain || '(empty)'}`);
  }
  return { subdomain, legacy, target };
}

function writeOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`);
}

let current = await state();
writeOutput({
  legacy_worker: Boolean(current.legacy),
  needs_migration: Boolean(current.legacy) || current.subdomain !== TARGET_SUBDOMAIN,
});

if (mode === 'apply') {
  let changedSubdomain = false;
  if (current.subdomain !== TARGET_SUBDOMAIN) {
    await changeSubdomain(current.subdomain, TARGET_SUBDOMAIN);
    changedSubdomain = true;
  }
  try {
    if (current.legacy) {
      await cf(
        `/accounts/${ACCOUNT_ID}/workers/workers/${encodeURIComponent(current.legacy.id || LEGACY_WORKER)}`,
        request('PATCH', { name: TARGET_WORKER }),
      );
    }
  } catch (error) {
    if (changedSubdomain) {
      await changeSubdomain(TARGET_SUBDOMAIN, LEGACY_SUBDOMAIN).catch(() => {});
    }
    throw error;
  }
  current = await state();
  if (current.subdomain !== TARGET_SUBDOMAIN || !current.target || current.legacy) {
    throw new Error('Cloudflare URL migration did not reach the expected final state');
  }
}

console.log(JSON.stringify({
  ok: true,
  mode,
  subdomain: current.subdomain,
  worker: current.target?.name || current.legacy?.name,
  targetUrl: `https://${TARGET_WORKER}.${TARGET_SUBDOMAIN}.workers.dev`,
}));
