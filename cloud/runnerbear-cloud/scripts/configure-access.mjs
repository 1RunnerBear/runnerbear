import fs from 'node:fs';

const ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const OWNER_EMAIL = String(process.env.RUNNERBEAR_OWNER_EMAIL || 'torbjorn.forre@gmail.com').trim().toLowerCase();
const APP_DOMAIN = String(process.env.RUNNERBEAR_APP_DOMAIN || 'app.runnerbear.workers.dev').trim().toLowerCase();
const SESSION = '720h';
const API = 'https://api.cloudflare.com/client/v4';

if (!ACCOUNT_ID || !API_TOKEN) throw new Error('Cloudflare account/token missing');

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
    const details = (data.errors || []).map((e) => `${e.code || ''} ${e.message || ''}`.trim()).join('; ');
    const error = new Error(`Cloudflare API ${response.status}: ${details || response.statusText}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data.result;
}

function body(value) {
  return { method: 'POST', body: JSON.stringify(value) };
}

async function ensureOrganization() {
  try {
    const org = await cf(`/accounts/${ACCOUNT_ID}/access/organizations`);
    if (org?.auth_domain) return org;
  } catch (error) {
    if (![400, 404].includes(error.status)) throw error;
  }
  const suffix = ACCOUNT_ID.slice(0, 8).toLowerCase();
  return cf(`/accounts/${ACCOUNT_ID}/access/organizations`, body({
    name: 'RunnerBear',
    auth_domain: `runnerbear-${suffix}`,
    session_duration: SESSION,
    auto_redirect_to_identity: false,
  }));
}

async function ensureOtp() {
  const list = await cf(`/accounts/${ACCOUNT_ID}/access/identity_providers`);
  const existing = (Array.isArray(list) ? list : []).find((x) => x?.type === 'onetimepin');
  if (existing) return existing;
  return cf(`/accounts/${ACCOUNT_ID}/access/identity_providers`, body({
    name: 'RunnerBear email code',
    type: 'onetimepin',
    config: {},
  }));
}

async function applications() {
  const result = await cf(`/accounts/${ACCOUNT_ID}/access/apps?per_page=100`);
  return Array.isArray(result) ? result : [];
}

async function ensureApp(apps, domain, name, otpId) {
  const existing = apps.find((x) => String(x?.domain || '').toLowerCase() === domain.toLowerCase());
  if (existing) return existing;
  return cf(`/accounts/${ACCOUNT_ID}/access/apps`, body({
    name,
    domain,
    type: 'self_hosted',
    session_duration: SESSION,
    allowed_idps: otpId ? [otpId] : undefined,
  }));
}

async function policies(appId) {
  const result = await cf(`/accounts/${ACCOUNT_ID}/access/apps/${appId}/policies?per_page=100`);
  return Array.isArray(result) ? result : [];
}

function ruleEmail(policy) {
  return (policy?.include || []).some((rule) => String(rule?.email?.email || '').toLowerCase() === OWNER_EMAIL);
}

async function ensureOwnerPolicy(app) {
  const rows = await policies(app.id);
  const unsafe = rows.filter((p) => ['allow', 'bypass'].includes(p?.decision) && p?.name !== 'RunnerBear owner');
  if (unsafe.length) {
    throw new Error(`RunnerBear Access app has unexpected permissive policies: ${unsafe.map((p) => p.name || p.id).join(', ')}`);
  }
  const existing = rows.find((p) => p?.name === 'RunnerBear owner' && p?.decision === 'allow' && ruleEmail(p));
  if (existing) return existing;
  return cf(`/accounts/${ACCOUNT_ID}/access/apps/${app.id}/policies`, body({
    name: 'RunnerBear owner',
    decision: 'allow',
    include: [{ email: { email: OWNER_EMAIL } }],
    session_duration: SESSION,
  }));
}

async function ensureHealthBypass(app) {
  const rows = await policies(app.id);
  const existing = rows.find((p) => p?.name === 'RunnerBear health public' && p?.decision === 'bypass');
  if (existing) return existing;
  return cf(`/accounts/${ACCOUNT_ID}/access/apps/${app.id}/policies`, body({
    name: 'RunnerBear health public',
    decision: 'bypass',
    include: [{ everyone: {} }],
  }));
}

function teamDomain(authDomain) {
  const value = String(authDomain || '').replace(/\/+$/, '');
  if (/^https:\/\//i.test(value)) return value;
  if (value.includes('.')) return `https://${value}`;
  return `https://${value}.cloudflareaccess.com`;
}

const organization = await ensureOrganization();
const otp = await ensureOtp();
let apps = await applications();
const mainApp = await ensureApp(apps, APP_DOMAIN, 'RunnerBear', otp.id);
await ensureOwnerPolicy(mainApp);
apps = await applications();
const healthApp = await ensureApp(apps, `${APP_DOMAIN}/health`, 'RunnerBear health', otp.id);
await ensureHealthBypass(healthApp);

const result = {
  ok: true,
  build: '9.8.1',
  appDomain: APP_DOMAIN,
  appId: mainApp.id,
  aud: mainApp.aud,
  teamDomain: teamDomain(organization.auth_domain),
  ownerEmail: OWNER_EMAIL,
  loginMethod: 'onetimepin',
  sessionDuration: SESSION,
  healthBypass: true,
  checkedAt: new Date().toISOString(),
};

fs.writeFileSync('access-status.json', `${JSON.stringify(result, null, 2)}\n`);
if (!result.aud || !result.teamDomain) throw new Error('Access application did not return AUD/team domain');

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `aud=${result.aud}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `team_domain=${result.teamDomain}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `app_id=${result.appId}\n`);
}

console.log(JSON.stringify({ ok: true, appDomain: result.appDomain, teamDomain: result.teamDomain, loginMethod: result.loginMethod, sessionDuration: result.sessionDuration }));
