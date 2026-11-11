const SAFETY_COPY = 'Garmin Pulse Ox kan ikke avgjøre om du har søvnapné. Gjentatte lave målinger kan være unøyaktige. Hvis du snorker, noen har observert pustepauser, eller du ofte våkner lite uthvilt, bør du snakke med fastlegen om en egnet søvnutredning.';

const finite = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const median = (values) => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

const average = (values) => {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const valid=(value,min,max)=>value!=null&&value>=min&&value<=max?value:null;

const rounded = (value, digits = 1) => value == null ? null : Math.round(value * (10 ** digits)) / (10 ** digits);

function rowValue(row, column, aliases = []) {
  const direct = finite(row?.[column]);
  if (direct != null) return direct;
  let payload = row?.payload;
  if (!payload && typeof row?.payload_json === 'string') {
    try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
  }
  for (const alias of aliases) {
    const value = finite(payload?.[alias]);
    if (value != null) return value;
  }
  return null;
}

export function summarizeHealthWindow(rows = [], days = 28) {
  const ordered = [...rows].filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const pick = (column) => ordered.map((row) => finite(row?.[column])).filter((value) => value != null);
  const hrv = pick('hrv_ms');
  const sleep = pick('sleep_seconds');
  const rhr = pick('rhr_bpm');
  const spo2Avg = ordered.map((row) => rowValue(row, 'spo2_avg_pct', ['spo2AvgPct', 'spo2Average', 'averageSpO2', 'spo2_avg_pct']))
    .filter((value) => value != null && value >= 50 && value <= 100);
  const spo2Min = ordered.map((row) => rowValue(row, 'spo2_min_pct', ['spo2MinPct', 'spo2Minimum', 'lowestSpO2', 'spo2_min_pct']))
    .filter((value) => value != null && value >= 50 && value <= 100);
  const respiration = ordered.map((row) => rowValue(row, 'respiration_avg_bpm', ['respirationAvgBpm', 'avgRespiration', 'respiration_avg_bpm']))
    .filter((value) => value != null && value >= 4 && value <= 40);
  const scores = ordered.map((row) => rowValue(row, 'sleep_score', ['sleepScore', 'sleep_score']))
    .filter((value) => value != null && value >= 0 && value <= 100);
  const below90 = ordered.filter((row) => {
    const value = rowValue(row, 'spo2_min_pct', ['spo2MinPct', 'spo2Minimum', 'lowestSpO2', 'spo2_min_pct']);
    return value != null && value >= 50 && value < 90;
  }).length;
  const coverage = (count) => ({ nights: count, expectedNights: days, percent: Math.round((count / days) * 100) });

  return {
    windowDays: days,
    series: ordered.map(row=>({date:row.date,hrvMs:finite(row.hrv_ms),sleepSeconds:finite(row.sleep_seconds),restingHeartRateBpm:finite(row.rhr_bpm),spo2AveragePct:valid(rowValue(row,'spo2_avg_pct',['spo2AvgPct']),50,100),spo2MinimumPct:valid(rowValue(row,'spo2_min_pct',['spo2MinPct']),50,100),source:row.health_source||'registered',metricSources:row.metric_sources||null,syncedAt:row.updated_at||null})),
    dateFrom: ordered[0]?.date || null,
    dateTo: ordered.at(-1)?.date || null,
    daysWithAnyData: ordered.filter((row) => ['hrv_ms', 'sleep_seconds', 'rhr_bpm', 'spo2_avg_pct', 'spo2_min_pct'].some((key) => finite(row?.[key]) != null)).length,
    metrics: {
      hrvMs: { median: rounded(median(hrv)), samples: hrv.length, coverage: coverage(hrv.length) },
      sleepSeconds: { median: rounded(median(sleep)), samples: sleep.length, coverage: coverage(sleep.length) },
      restingHeartRateBpm: { median: rounded(median(rhr)), samples: rhr.length, coverage: coverage(rhr.length) },
      spo2AveragePct: { mean: rounded(average(spo2Avg)), samples: spo2Avg.length, coverage: coverage(spo2Avg.length), quality: spo2Avg.length ? 'usable_with_caveats' : 'missing' },
      spo2MinimumPct: { meanOfRecordedMinima: rounded(average(spo2Min)), lowestRecorded: spo2Min.length ? Math.min(...spo2Min) : null, samples: spo2Min.length, coverage: coverage(spo2Min.length), quality: spo2Min.length ? 'usable_with_caveats' : 'missing' },
      respirationAvgBpm: { mean: rounded(average(respiration)), samples: respiration.length, coverage: coverage(respiration.length) },
      sleepScore: { median: rounded(median(scores)), samples: scores.length, coverage: coverage(scores.length) },
    },
    recordedMinimumBelow90Nights: below90,
    interpretation: spo2Min.length
      ? 'Dette teller netter med et registrert minimum under 90 %. Det er ikke en opptelling av pustestopp, og enkeltminima kan være målefeil.'
      : 'Det finnes ikke nok SpO₂-minimumsdata i RunnerBear til å oppsummere denne perioden.',
    safetyCopy: SAFETY_COPY,
    diagnosticMetricsAvailable: false,
  };
}

export function summarizeSleepBreathing(rows = [], days = 28) {
  const summary = summarizeHealthWindow(rows, days);
  const nights = [...rows].filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((row) => ({
      date: row.date,
      sleepSeconds: finite(row.sleep_seconds),
      spo2AveragePct: valid(rowValue(row, 'spo2_avg_pct', ['spo2AvgPct', 'spo2Average', 'averageSpO2', 'spo2_avg_pct']),50,100),
      spo2MinimumPct: valid(rowValue(row, 'spo2_min_pct', ['spo2MinPct', 'spo2Minimum', 'lowestSpO2', 'spo2_min_pct']),50,100),
      respirationAvgBpm: rowValue(row, 'respiration_avg_bpm', ['respirationAvgBpm', 'avgRespiration', 'respiration_avg_bpm']),
      sleepScore: rowValue(row, 'sleep_score', ['sleepScore', 'sleep_score']),
      source: String(row.health_source || 'tredict'),
      quality: String(row.health_quality || 'missing'),
      measuredAt: row.measured_at || null,
      syncedAt: row.updated_at || null,
    }));
  return { ...summary, nights, timelineAvailable: false };
}

export function normalizeHealthWindow(value, allowed = [7, 28, 90], fallback = 28) {
  const match = String(value || '').match(/^(7|28|30|90)d$/);
  const numeric = match ? Number(match[1]) : Number(value);
  return allowed.includes(numeric) ? numeric : fallback;
}
