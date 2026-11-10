const test=require('node:test');
const assert=require('node:assert/strict');

test('health trend summaries use only valid values and expose sample coverage',async()=>{
  const {summarizeHealthWindow}=await import('../cloud/runnerbear-cloud/src/v1027/health-intelligence.js');
  const result=summarizeHealthWindow([
    {date:'2026-11-08',hrv_ms:42,sleep_seconds:27000,rhr_bpm:50,spo2_avg_pct:96,spo2_min_pct:88},
    {date:'2026-11-09',hrv_ms:38,sleep_seconds:25200,rhr_bpm:52,spo2_avg_pct:101,spo2_min_pct:40},
    {date:'2026-11-10',hrv_ms:null,sleep_seconds:null,rhr_bpm:null,spo2_avg_pct:null,spo2_min_pct:null},
  ],7);
  assert.equal(result.metrics.hrvMs.median,40);
  assert.equal(result.metrics.sleepSeconds.median,26100);
  assert.equal(result.metrics.spo2AveragePct.mean,96);
  assert.equal(result.metrics.spo2AveragePct.samples,1);
  assert.equal(result.metrics.spo2MinimumPct.lowestRecorded,88);
  assert.equal(result.recordedMinimumBelow90Nights,1);
  assert.equal(result.metrics.spo2AveragePct.coverage.percent,14);
  assert.equal(result.diagnosticMetricsAvailable,false);
});

test('sleep and breathing overview never infers respiratory diagnoses or timelines',async()=>{
  const {summarizeSleepBreathing}=await import('../cloud/runnerbear-cloud/src/v1027/health-intelligence.js');
  const result=summarizeSleepBreathing([
    {date:'2026-11-09',sleep_seconds:27000,spo2_avg_pct:96,spo2_min_pct:87,respiration_avg_bpm:14,sleep_score:82,health_source:'garmin',health_quality:'usable_with_caveats',updated_at:'2026-11-10T07:00:00Z'},
  ],28);
  assert.equal(result.nights.length,1);
  assert.equal(result.nights[0].source,'garmin');
  assert.equal(result.nights[0].spo2MinimumPct,87);
  assert.equal(result.timelineAvailable,false);
  assert.equal(result.recordedMinimumBelow90Nights,1);
  assert.match(result.interpretation,/ikke en opptelling av pustestopp/);
  assert.match(result.safetyCopy,/fastlegen/);
  assert.doesNotMatch(JSON.stringify(result),/AHI|ODI|søvnapné-score/i);
});

test('health payload aliases are accepted but out-of-range oxygen is excluded',async()=>{
  const {summarizeHealthWindow}=await import('../cloud/runnerbear-cloud/src/v1027/health-intelligence.js');
  const result=summarizeHealthWindow([
    {date:'2026-11-09',payload_json:JSON.stringify({spo2AvgPct:97,spo2MinPct:89,respirationAvgBpm:13,sleepScore:80})},
    {date:'2026-11-10',payload:{spo2AvgPct:101,spo2MinPct:20,respirationAvgBpm:99,sleepScore:120}},
  ],28);
  assert.equal(result.metrics.spo2AveragePct.mean,97);
  assert.equal(result.metrics.spo2MinimumPct.lowestRecorded,89);
  assert.equal(result.metrics.respirationAvgBpm.mean,13);
  assert.equal(result.metrics.sleepScore.median,80);
  assert.equal(result.recordedMinimumBelow90Nights,1);
});

test('window selection is explicitly bounded',async()=>{
  const {normalizeHealthWindow}=await import('../cloud/runnerbear-cloud/src/v1027/health-intelligence.js');
  assert.equal(normalizeHealthWindow('7d',[7,28,90],28),7);
  assert.equal(normalizeHealthWindow('90d',[28,90],28),90);
  assert.equal(normalizeHealthWindow('365d',[7,28,90],28),28);
  assert.equal(normalizeHealthWindow('-7',[7,28,90],28),28);
});
