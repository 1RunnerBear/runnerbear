import { createRemoteJWKSet, jwtVerify } from 'jose';

const BUILD = '10.21';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const MAX_BODY_BYTES = 2_000_000;
const MAX_DAYS = 365;
const JWKS_CACHE = new Map();

function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { ...JSON_HEADERS, ...extra } });
}

function owner(env) {
  return String(env.PRIMARY_USER_ID || 'primary');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return '';
  const allowed = String(env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : '';
}

function cors(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,PUT,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-runnerbear-key',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

async function verifyToken(provided, expected) {
  if (!expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(provided || ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(expected))),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function accessJwks(teamDomain) {
  const key = String(teamDomain || '').replace(/\/+$/, '');
  let jwks = JWKS_CACHE.get(key);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${key}/cdn-cgi/access/certs`));
    JWKS_CACHE.set(key, jwks);
  }
  return jwks;
}

async function accessIdentity(request, env) {
  const token = request.headers.get('cf-access-jwt-assertion') || '';
  const teamDomain = String(env.ACCESS_TEAM_DOMAIN || '').replace(/\/+$/, '');
  const audience = String(env.ACCESS_AUD || '');
  const expectedEmail = normalizeEmail(env.PRIMARY_USER_EMAIL);

  if (token && teamDomain && audience) {
    try {
      const { payload } = await jwtVerify(token, accessJwks(teamDomain), {
        issuer: teamDomain,
        audience,
      });
      const email = normalizeEmail(payload.email || request.headers.get('cf-access-authenticated-user-email'));
      if (!email || (expectedEmail && email !== expectedEmail)) return null;
      return { mode: 'cloudflare-access', email, subject: String(payload.sub || '') };
    } catch (error) {
      console.warn(JSON.stringify({ event: 'runnerbear_access_rejected', message: error instanceof Error ? error.message : String(error) }));
      return null;
    }
  }

  // Transitional fallback for admin/migration tooling. Browser use moves to Access in v9.8.1.
  if (await verifyToken(request.headers.get('X-RunnerBear-Key') || '', env.RUNNERBEAR_API_KEY || '')) {
    return { mode: 'legacy-key', email: expectedEmail, subject: 'legacy-admin' };
  }
  return null;
}

async function bodyJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw new Error('Payload too large');
  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel('Payload too large');
      throw new Error('Payload too large');
    }
    chunks.push(value);
  }

  if (!total) return {};
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

function isoDate(value) {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function isoTimestamp(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolInt(value, fallback = 1) {
  if (value === undefined || value === null) return fallback;
  return value ? 1 : 0;
}

function payload(value) {
  return JSON.stringify(value ?? {});
}

function parseJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

async function batch(db, statements, size = 50) {
  const results = [];
  for (let i = 0; i < statements.length; i += size) {
    results.push(...await db.batch(statements.slice(i, i + size)));
  }
  return results;
}

async function ensureUser(env) {
  const id = owner(env);
  await env.DB.prepare(
    `INSERT INTO rb_users (id, created_at, updated_at) VALUES (?1, ?2, ?2)
     ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
  ).bind(id, new Date().toISOString()).run();
}

function homeLocalState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const exact = new Set([
    'runnerbear_v107_plan_moves', 'runnerbear_v107_plan_locks', 'runnerbear_v107_coach_control',
    'runnerbear_v107_coach_log', 'runnerbear_v107_seen_actions', 'runnerbear_v108_match_exclusions',
    'runnerbear_v108_shoes', 'runnerbear_v109_goals', 'runnerbear_v7_profile', 'runnerbear_v118_day_modes',
  ]);
  return Object.fromEntries(Object.entries(input).filter(([key]) => exact.has(key) || key.startsWith('runnerbear_tredict_match_') || key.startsWith('runfest26_')));
}

async function getHomeBootstrap(request, env) {
  const started = performance.now();
  const id = owner(env);
  const activityCutoff = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);
  const healthCutoff = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const [states, activities, health, capacity, sync] = await Promise.all([
    env.DB.prepare("SELECT namespace, payload_json, updated_at FROM rb_state WHERE user_id = ?1 AND namespace = 'localStorage'").bind(id).all(),
    env.DB.prepare('SELECT payload_json FROM rb_activities WHERE user_id = ?1 AND date >= ?2 ORDER BY date DESC, updated_at DESC').bind(id, activityCutoff).all(),
    env.DB.prepare('SELECT date, hrv_ms, sleep_seconds, rhr_bpm, payload_json FROM rb_health_daily WHERE user_id = ?1 AND date >= ?2 ORDER BY date DESC').bind(id, healthCutoff).all(),
    env.DB.prepare('SELECT payload_json FROM rb_capacity WHERE user_id = ?1 ORDER BY timestamp DESC LIMIT 30').bind(id).all(),
    env.DB.prepare('SELECT source, last_synced_at, status, detail_json, updated_at FROM rb_sync_sources WHERE user_id = ?1 ORDER BY source').bind(id).all(),
  ]);
  const d1Ms = Math.round(performance.now() - started);
  const state = {};
  for (const row of states.results || []) state[row.namespace] = parseJson(row.payload_json, {});
  state.localStorage = homeLocalState(state.localStorage);

  const hrv = {}, sleep = {}, body = [];
  for (const row of health.results || []) {
    const detail = parseJson(row.payload_json, {});
    const key = String(row.date || '').replaceAll('-', '');
    if (row.hrv_ms != null) hrv[key] = [Number(row.hrv_ms), num(detail.hrvBaseline)];
    if (row.sleep_seconds != null) sleep[key] = [Number(row.sleep_seconds), num(detail.sleepBaseline)];
    if (row.rhr_bpm != null) body.push({ timestamp: row.date, hrRestDynamic: Number(row.rhr_bpm) });
  }
  const syncRows = (sync.results || []).map((row) => ({ ...row, detail: parseJson(row.detail_json, {}) }));
  const syncedAt = syncRows.map((row) => row.last_synced_at).filter(Boolean).sort().at(-1) || '';
  state.tredict = {
    activities: (activities.results || []).map((row) => parseJson(row.payload_json, {})),
    hrv,
    sleep,
    body,
    capacity: { running: (capacity.results || []).map((row) => parseJson(row.payload_json, {})).reverse() },
    syncedAt,
    source: 'runnerbear-cloud-v10.21-home',
  };
  console.log(JSON.stringify({ event: 'runnerbear_bootstrap_home', build: BUILD, d1Ms, activities: state.tredict.activities.length, healthDays: (health.results || []).length }));
  return {
    ok: true,
    build: BUILD,
    owner: id,
    generatedAt: new Date().toISOString(),
    windowDays: 35,
    state,
    sync: syncRows,
    metrics: { d1Ms },
  };
}

async function getBootstrap(request, env) {
  const started = performance.now();
  const id = owner(env);
  const url = new URL(request.url);
  const days = Math.min(MAX_DAYS, Math.max(7, Number(url.searchParams.get('days') || 120)));
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const [states, plan, activities, health, capacity, shoes, sync] = await Promise.all([
    env.DB.prepare('SELECT namespace, payload_json, updated_at FROM rb_state WHERE user_id = ?1 ORDER BY namespace').bind(id).all(),
    env.DB.prepare('SELECT date, goal_id, type, title, km, status, payload_json, updated_at FROM rb_plan_days WHERE user_id = ?1 ORDER BY date').bind(id).all(),
    env.DB.prepare(`SELECT source, source_id, date, sport_type, sub_sport_type, title, duration_seconds, distance_m,
      pace_seconds_per_km, avg_hr, max_hr, power, cadence, payload_json, updated_at
      FROM rb_activities WHERE user_id = ?1 AND date >= ?2 ORDER BY date DESC, updated_at DESC`).bind(id, cutoff).all(),
    env.DB.prepare(`SELECT date, hrv_ms, sleep_seconds, rhr_bpm, payload_json, updated_at
      FROM rb_health_daily WHERE user_id = ?1 AND date >= ?2 ORDER BY date DESC`).bind(id, cutoff).all(),
    env.DB.prepare(`SELECT timestamp, source, payload_json FROM rb_capacity
      WHERE user_id = ?1 ORDER BY timestamp DESC LIMIT 200`).bind(id).all(),
    env.DB.prepare('SELECT id, name, category, km, active, payload_json, updated_at FROM rb_shoes WHERE user_id = ?1 ORDER BY active DESC, name').bind(id).all(),
    env.DB.prepare('SELECT source, last_synced_at, status, detail_json, updated_at FROM rb_sync_sources WHERE user_id = ?1 ORDER BY source').bind(id).all(),
  ]);

  const d1Ms = Math.round(performance.now() - started);
  const state = {};
  for (const row of states.results || []) state[row.namespace] = parseJson(row.payload_json, {});

  const result = {
    ok: true,
    build: BUILD,
    owner: id,
    generatedAt: new Date().toISOString(),
    windowDays: days,
    state,
    plan: (plan.results || []).map((r) => ({ ...r, payload: parseJson(r.payload_json, {}) })),
    activities: (activities.results || []).map((r) => ({ ...r, payload: parseJson(r.payload_json, {}) })),
    health: (health.results || []).map((r) => ({ ...r, payload: parseJson(r.payload_json, {}) })),
    capacity: (capacity.results || []).map((r) => ({ ...r, payload: parseJson(r.payload_json, {}) })),
    shoes: (shoes.results || []).map((r) => ({ ...r, active: !!r.active, payload: parseJson(r.payload_json, {}) })),
    sync: (sync.results || []).map((r) => ({ ...r, detail: parseJson(r.detail_json, {}) })),
  };
  console.log(JSON.stringify({ event: 'runnerbear_bootstrap_full', build: BUILD, d1Ms, windowDays: days, activities: result.activities.length }));
  result.metrics = { d1Ms };
  return result;
}

async function putState(request, env, namespace) {
  if (!/^[a-z0-9._-]{1,64}$/i.test(namespace)) return json({ ok: false, error: 'Invalid namespace' }, 400, cors(request, env));
  const input = await bodyJson(request);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO rb_state (user_id, namespace, payload_json, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id, namespace) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`
  ).bind(owner(env), namespace, payload(input.payload ?? input), now).run();
  return json({ ok: true, namespace, updatedAt: now }, 200, cors(request, env));
}

async function putPlan(request, env) {
  const input = await bodyJson(request);
  const rows = Array.isArray(input.days) ? input.days : [];
  if (rows.length > 500) return json({ ok: false, error: 'Too many plan rows' }, 400, cors(request, env));
  const id = owner(env), now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO rb_plan_days (user_id, date, goal_id, type, title, km, status, payload_json, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(user_id, date) DO UPDATE SET goal_id=excluded.goal_id, type=excluded.type, title=excluded.title,
       km=excluded.km, status=excluded.status, payload_json=excluded.payload_json, updated_at=excluded.updated_at`
  );
  const statements = rows.map((r) => {
    const date = isoDate(r.date);
    if (!date) throw new Error('Invalid plan date');
    return stmt.bind(id, date, String(r.goalId || r.goal_id || ''), String(r.type || ''), String(r.title || ''), num(r.km), String(r.status || ''), payload(r), now);
  });
  if (statements.length) await batch(env.DB, statements);
  return json({ ok: true, stored: statements.length, updatedAt: now }, 200, cors(request, env));
}

async function putActivities(request, env) {
  const input = await bodyJson(request);
  const source = String(input.source || 'tredict').slice(0, 32);
  const rows = Array.isArray(input.activities) ? input.activities : [];
  if (rows.length > 1000) return json({ ok: false, error: 'Too many activities' }, 400, cors(request, env));
  const id = owner(env), now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO rb_activities (user_id, source, source_id, date, sport_type, sub_sport_type, title, duration_seconds,
      distance_m, pace_seconds_per_km, avg_hr, max_hr, power, cadence, payload_json, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
     ON CONFLICT(user_id, source, source_id) DO UPDATE SET date=excluded.date, sport_type=excluded.sport_type,
      sub_sport_type=excluded.sub_sport_type, title=excluded.title, duration_seconds=excluded.duration_seconds,
      distance_m=excluded.distance_m, pace_seconds_per_km=excluded.pace_seconds_per_km, avg_hr=excluded.avg_hr,
      max_hr=excluded.max_hr, power=excluded.power, cadence=excluded.cadence, payload_json=excluded.payload_json,
      updated_at=excluded.updated_at`
  );
  const statements = rows.map((a) => {
    const summary = a.summary || {};
    const sourceId = String(a.id || a.sourceId || a.source_id || '');
    const date = isoDate(a.date || a.startTime || a.timestamp);
    if (!sourceId || !date) throw new Error('Activity requires id and date');
    return stmt.bind(id, source, sourceId, date, String(a.sportType || a.sport_type || ''), String(a.subSportType || a.sub_sport_type || ''),
      String(a.title || ''), num(a.duration ?? summary.duration), num(a.distance ?? summary.distance), num(a.pace ?? summary.pace),
      num(a.heartrate ?? a.avgHr ?? summary.heartrate), num(a.heartrateMax ?? a.maxHr ?? summary.heartrateMax),
      num(a.power ?? summary.power), num(a.cadence ?? summary.cadence), payload(a), now);
  });
  if (statements.length) await batch(env.DB, statements);
  return json({ ok: true, stored: statements.length, source, updatedAt: now }, 200, cors(request, env));
}

async function putHealth(request, env) {
  const input = await bodyJson(request);
  const rows = Array.isArray(input.days) ? input.days : [];
  if (rows.length > 500) return json({ ok: false, error: 'Too many health rows' }, 400, cors(request, env));
  const id = owner(env), now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO rb_health_daily (user_id, date, hrv_ms, sleep_seconds, rhr_bpm, payload_json, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7)
     ON CONFLICT(user_id, date) DO UPDATE SET hrv_ms=excluded.hrv_ms, sleep_seconds=excluded.sleep_seconds,
      rhr_bpm=excluded.rhr_bpm, payload_json=excluded.payload_json, updated_at=excluded.updated_at`
  );
  const statements = rows.map((r) => {
    const date = isoDate(r.date || r.timestamp);
    if (!date) throw new Error('Invalid health date');
    return stmt.bind(id, date, num(r.hrv ?? r.hrvMs ?? r.hrv_ms), num(r.sleep ?? r.sleepSeconds ?? r.sleep_seconds),
      num(r.rhr ?? r.rhrBpm ?? r.rhr_bpm), payload(r), now);
  });
  if (statements.length) await batch(env.DB, statements);
  return json({ ok: true, stored: statements.length, updatedAt: now }, 200, cors(request, env));
}

async function putCapacity(request, env) {
  const input = await bodyJson(request);
  const rows = Array.isArray(input.samples) ? input.samples : [];
  if (rows.length > 500) return json({ ok: false, error: 'Too many capacity samples' }, 400, cors(request, env));
  const id = owner(env), now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO rb_capacity (user_id, timestamp, source, payload_json, updated_at)
     VALUES (?1,?2,?3,?4,?5)
     ON CONFLICT(user_id, timestamp, source) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`
  );
  const statements = rows.map((r) => stmt.bind(id, isoTimestamp(r.timestamp || r.date), String(r.source || input.source || 'tredict').slice(0, 32), payload(r), now));
  if (statements.length) await batch(env.DB, statements);
  return json({ ok: true, stored: statements.length, updatedAt: now }, 200, cors(request, env));
}

async function putShoes(request, env) {
  const input = await bodyJson(request);
  const rows = Array.isArray(input.shoes) ? input.shoes : [];
  if (rows.length > 100) return json({ ok: false, error: 'Too many shoes' }, 400, cors(request, env));
  const id = owner(env), now = new Date().toISOString();
  const stmt = env.DB.prepare(
    `INSERT INTO rb_shoes (user_id, id, name, category, km, active, payload_json, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
     ON CONFLICT(user_id, id) DO UPDATE SET name=excluded.name, category=excluded.category, km=excluded.km,
      active=excluded.active, payload_json=excluded.payload_json, updated_at=excluded.updated_at`
  );
  const statements = rows.map((r, i) => {
    const shoeId = String(r.id || r.slug || `shoe-${i}`).slice(0, 96);
    return stmt.bind(id, shoeId, String(r.name || 'Sko'), String(r.category || r.role || ''), num(r.km) || 0, boolInt(r.active, 1), payload(r), now);
  });
  if (statements.length) await batch(env.DB, statements);
  return json({ ok: true, stored: statements.length, updatedAt: now }, 200, cors(request, env));
}

async function putSyncStatus(request, env) {
  const input = await bodyJson(request);
  const source = String(input.source || '').slice(0, 32);
  if (!source) return json({ ok: false, error: 'source is required' }, 400, cors(request, env));
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO rb_sync_sources (user_id, source, last_synced_at, status, detail_json, updated_at)
     VALUES (?1,?2,?3,?4,?5,?6)
     ON CONFLICT(user_id, source) DO UPDATE SET last_synced_at=excluded.last_synced_at, status=excluded.status,
      detail_json=excluded.detail_json, updated_at=excluded.updated_at`
  ).bind(owner(env), source, isoTimestamp(input.lastSyncedAt || input.last_synced_at), String(input.status || 'ok').slice(0, 32), payload(input.detail || {}), now).run();
  return json({ ok: true, source, updatedAt: now }, 200, cors(request, env));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (path === '/health') return json({
      ok: true,
      service: 'runnerbear-cloud',
      build: BUILD,
      database: !!env.DB,
      assets: !!env.ASSETS,
      accessConfigured: !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD),
    }, 200, cors(request, env));

    if (!path.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('RunnerBear assets unavailable', { status: 503 });
    }

    if (!env.DB) return json({ ok: false, error: 'D1 binding missing' }, 503, cors(request, env));
    const identity = await accessIdentity(request, env);
    if (!identity) return json({ ok: false, error: 'Unauthorized' }, 401, cors(request, env));

    try {
      if (!['GET', 'HEAD'].includes(request.method)) await ensureUser(env);
      if (request.method === 'GET' && path === '/api/session') return json({ ok: true, build: BUILD, owner: owner(env), identity }, 200, cors(request, env));
      if (request.method === 'GET' && path === '/api/bootstrap/home') {
        const data = await getHomeBootstrap(request, env);
        data.identity = identity;
        return json(data, 200, cors(request, env));
      }
      if (request.method === 'GET' && path === '/api/bootstrap') {
        const data = await getBootstrap(request, env);
        data.identity = identity;
        return json(data, 200, cors(request, env));
      }
      if (request.method === 'PUT' && path.startsWith('/api/state/')) return putState(request, env, decodeURIComponent(path.slice('/api/state/'.length)));
      if (request.method === 'PUT' && path === '/api/plan') return putPlan(request, env);
      if (request.method === 'PUT' && path === '/api/activities') return putActivities(request, env);
      if (request.method === 'PUT' && path === '/api/health') return putHealth(request, env);
      if (request.method === 'PUT' && path === '/api/capacity') return putCapacity(request, env);
      if (request.method === 'PUT' && path === '/api/shoes') return putShoes(request, env);
      if (request.method === 'PUT' && path === '/api/sync-status') return putSyncStatus(request, env);
      return json({ ok: false, error: 'Not found' }, 404, cors(request, env));
    } catch (error) {
      console.error(JSON.stringify({ event: 'runnerbear_cloud_error', path, message: error instanceof Error ? error.message : String(error) }));
      const message = error instanceof SyntaxError ? 'Invalid JSON' : error instanceof Error ? error.message : 'Unexpected error';
      const status = /too large/i.test(message) ? 413 : /invalid|required/i.test(message) ? 400 : 500;
      return json({ ok: false, error: message }, status, cors(request, env));
    }
  },
};
