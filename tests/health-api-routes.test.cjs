const test=require('node:test');
const assert=require('node:assert/strict');

function mockEnv(rows){
  return {COACH_LOOP_KILL_SWITCH:'false',DB:{prepare(sql){return{bind(...args){this.args=args;return this},async all(){if(sql.includes('SELECT flag,enabled,payload_json FROM rb_feature_flags'))return{results:[]};if(sql.includes('SELECT date,hrv_ms,sleep_seconds,rhr_bpm,spo2_avg_pct'))return{results:rows};return{results:[]}},async first(){if(sql.includes('rb_migrations'))return{status:'committed'};return null}}}}};
}

test('authorized health trend route returns bounded 90-day summaries',async()=>{
  const {handleV1027}=await import('../cloud/runnerbear-cloud/src/v11/routes.js');
  const rows=[{date:'2026-11-09',hrv_ms:40,sleep_seconds:26000,rhr_bpm:51,spo2_avg_pct:96,spo2_min_pct:88,health_source:'garmin',health_quality:'usable_with_caveats',updated_at:'2026-11-10T07:00:00Z'}];
  const response=await handleV1027(new Request('https://app.runnerbear.workers.dev/api/v2/health/trends?window=90d'),mockEnv(rows),{userId:'primary'});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.windowDays,90);
  assert.equal(body.metrics.spo2AveragePct.mean,96);
  assert.equal(body.diagnosticMetricsAvailable,false);
});

test('sleep breathing route preserves uncertainty when oxygen data is missing',async()=>{
  const {handleV1027}=await import('../cloud/runnerbear-cloud/src/v11/routes.js');
  const response=await handleV1027(new Request('https://app.runnerbear.workers.dev/api/v2/health/sleep-breathing?window=28d'),mockEnv([{date:'2026-11-09',sleep_seconds:25000,health_source:'tredict',health_quality:'partial'}]),{userId:'primary'});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.metrics.spo2MinimumPct.samples,0);
  assert.equal(body.recordedMinimumBelow90Nights,0);
  assert.match(body.interpretation,/ikke nok SpO₂-minimumsdata/);
  assert.equal(body.timelineAvailable,false);
});

test('health insight routes stay unavailable during the coach kill switch',async()=>{
  const {handleV1027}=await import('../cloud/runnerbear-cloud/src/v11/routes.js');
  const env=mockEnv([]);env.COACH_LOOP_KILL_SWITCH='true';
  const response=await handleV1027(new Request('https://app.runnerbear.workers.dev/api/v2/health/trends?window=28d'),env,{userId:'primary'});
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,'HEALTH_READ_DISABLED');
});

test('configured Worker entrypoint serves authenticated health routes against local D1',async()=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  const {build}=require('../cloud/runnerbear-cloud/node_modules/esbuild');
  const {Miniflare,convertV4MiniflareOptions}=require('../cloud/runnerbear-cloud/node_modules/miniflare');
  const cloud=path.join(__dirname,'../cloud/runnerbear-cloud'),config=JSON.parse(fs.readFileSync(path.join(cloud,'wrangler.jsonc'),'utf8'));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rb21-worker-')),bundle=path.join(dir,'worker.mjs');
  await build({entryPoints:[path.join(cloud,config.main)],outfile:bundle,bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers','node:*'],logLevel:'silent'});
  // Installed workerd supports through Aug 11; production retains its Aug 28 date.
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,modulesRoot:dir,scriptPath:bundle,compatibilityDate:'2026-08-11',compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],bindings:{RUNNERBEAR_API_KEY:'local-fixture-key',PRIMARY_USER_ID:'primary'}}));
  try{
    const db=await mf.getD1Database('DB');
    await db.batch([
      db.prepare('CREATE TABLE rb_feature_flags(user_id TEXT,flag TEXT,enabled INTEGER,payload_json TEXT)'),
      db.prepare('CREATE TABLE rb_migrations(user_id TEXT,migration_key TEXT,status TEXT)'),
      db.prepare('CREATE TABLE rb_health_daily(user_id TEXT,date TEXT,hrv_ms REAL,sleep_seconds REAL,rhr_bpm REAL,spo2_avg_pct REAL,spo2_min_pct REAL,respiration_avg_bpm REAL,sleep_score REAL,health_source TEXT,health_quality TEXT,updated_at TEXT)'),
      db.prepare('CREATE TABLE rb_garmin_shadow(user_id TEXT,date TEXT,metrics TEXT,updated_at TEXT)'),
      db.prepare("INSERT INTO rb_health_daily(user_id,date,hrv_ms,health_source) VALUES('primary',?1,42,'garmin')").bind(new Date().toISOString().slice(0,10)),
    ]);
    for(const endpoint of ['trends','sleep-breathing'])for(const days of endpoint==='trends'?[7,28,90]:[7,30,90]){
      const url=`https://app.runnerbear.workers.dev/api/v2/health/${endpoint}?window=${days}`;
      assert.equal((await mf.dispatchFetch(url)).status,401);
      const response=await mf.dispatchFetch(url,{headers:{'X-RunnerBear-Key':'local-fixture-key'}});
      assert.equal(response.status,200);const body=await response.json();assert.equal(body.windowDays,days);assert.equal(body.ok,true);
      if(endpoint==='trends')assert.equal(body.metrics.hrvMs.median,42);
    }
  }finally{await mf.dispose();fs.rmSync(dir,{recursive:true,force:true});}
});
