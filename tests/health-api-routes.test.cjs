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
