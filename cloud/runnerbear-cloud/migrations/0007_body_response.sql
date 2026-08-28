PRAGMA foreign_keys = ON;

-- RunnerBear v11.1 Body Response is additive. Existing Garmin health rows,
-- activities, plan history and Coach Loop decisions remain authoritative.
CREATE TABLE IF NOT EXISTS rb_health_observations (
  observation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('hrv','sleep','rhr','stress','body_battery')),
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'tredict',
  quality TEXT NOT NULL DEFAULT 'measured' CHECK(quality IN ('measured','estimated','partial','unknown')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  UNIQUE(user_id,local_date,metric,source)
);
CREATE INDEX IF NOT EXISTS idx_rb_health_observations_user_date ON rb_health_observations(user_id,local_date DESC,metric);

CREATE TABLE IF NOT EXISTS rb_health_baseline_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  window_days INTEGER NOT NULL,
  value REAL NOT NULL,
  mad REAL,
  sample_count INTEGER NOT NULL,
  quality TEXT NOT NULL CHECK(quality IN ('building','usable','established')),
  input_cursor TEXT NOT NULL,
  as_of TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  UNIQUE(user_id,metric,window_days,input_cursor)
);
CREATE INDEX IF NOT EXISTS idx_rb_health_baselines_user_time ON rb_health_baseline_snapshots(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS rb_body_response_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_revision_id TEXT NOT NULL,
  input_cursor TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('as_planned','watch','adjust','recover','wait_for_data')),
  confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  domains_json TEXT NOT NULL DEFAULT '[]',
  recommendation_json TEXT NOT NULL DEFAULT '{}',
  freshness_json TEXT NOT NULL DEFAULT '{}',
  baseline_status_json TEXT NOT NULL DEFAULT '{}',
  policy_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  valid_until TEXT,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id) ON DELETE CASCADE,
  UNIQUE(user_id,plan_revision_id,input_cursor)
);
CREATE INDEX IF NOT EXISTS idx_rb_body_response_user_time ON rb_body_response_snapshots(user_id,generated_at DESC);

CREATE TABLE IF NOT EXISTS rb_subjective_checkins (
  checkin_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('fresh','tired','heavy')),
  reasons_json TEXT NOT NULL DEFAULT '[]',
  workout_id TEXT,
  plan_revision_id TEXT,
  response_phase TEXT NOT NULL DEFAULT 'morning' CHECK(response_phase IN ('morning','post_workout','next_morning')),
  occurred_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(workout_id) REFERENCES rb_workouts(workout_id),
  FOREIGN KEY(plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id),
  UNIQUE(user_id,source_id)
);
CREATE INDEX IF NOT EXISTS idx_rb_subjective_checkins_user_time ON rb_subjective_checkins(user_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS rb_workout_response_links (
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  response_date TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  response_phase TEXT NOT NULL CHECK(response_phase IN ('post_workout','next_morning')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,workout_id,response_date,response_phase),
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(workout_id) REFERENCES rb_workouts(workout_id),
  FOREIGN KEY(snapshot_id) REFERENCES rb_body_response_snapshots(snapshot_id)
);

CREATE TABLE IF NOT EXISTS rb_recovery_insights (
  insight_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_recovery_insights_user_time ON rb_recovery_insights(user_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_rb_health_observations_insert
AFTER INSERT ON rb_health_daily
BEGIN
  INSERT OR REPLACE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:hrv',NEW.user_id,NEW.date,'hrv',NEW.hrv_ms,'ms',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.hrv_ms IS NOT NULL;
  INSERT OR REPLACE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:sleep',NEW.user_id,NEW.date,'sleep',NEW.sleep_seconds,'seconds',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.sleep_seconds IS NOT NULL;
  INSERT OR REPLACE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:rhr',NEW.user_id,NEW.date,'rhr',NEW.rhr_bpm,'bpm',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.rhr_bpm IS NOT NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_rb_health_observations_update
AFTER UPDATE OF hrv_ms,sleep_seconds,rhr_bpm,payload_json,updated_at ON rb_health_daily
BEGIN
  DELETE FROM rb_health_observations WHERE user_id=NEW.user_id AND local_date=NEW.date AND metric='hrv' AND source='tredict' AND NEW.hrv_ms IS NULL;
  INSERT OR REPLACE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:hrv',NEW.user_id,NEW.date,'hrv',NEW.hrv_ms,'ms',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.hrv_ms IS NOT NULL;
  DELETE FROM rb_health_observations WHERE user_id=NEW.user_id AND local_date=NEW.date AND metric='sleep' AND source='tredict' AND NEW.sleep_seconds IS NULL;
  INSERT OR REPLACE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:sleep',NEW.user_id,NEW.date,'sleep',NEW.sleep_seconds,'seconds',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.sleep_seconds IS NOT NULL;
  DELETE FROM rb_health_observations WHERE user_id=NEW.user_id AND local_date=NEW.date AND metric='rhr' AND source='tredict' AND NEW.rhr_bpm IS NULL;
  INSERT OR REPLACE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
  SELECT 'health:'||NEW.user_id||':'||NEW.date||':tredict:rhr',NEW.user_id,NEW.date,'rhr',NEW.rhr_bpm,'bpm',NEW.date||'T06:00:00.000Z',NEW.updated_at,'tredict','measured',NEW.payload_json WHERE NEW.rhr_bpm IS NOT NULL;
END;

-- Preserve a normalized, provenance-aware copy of the existing daily health
-- history without changing the established rb_health_daily ingestion path.
INSERT OR IGNORE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
SELECT 'health:'||user_id||':'||date||':tredict:hrv',user_id,date,'hrv',hrv_ms,'ms',date||'T06:00:00.000Z',updated_at,'tredict','measured',payload_json FROM rb_health_daily WHERE hrv_ms IS NOT NULL;
INSERT OR IGNORE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
SELECT 'health:'||user_id||':'||date||':tredict:sleep',user_id,date,'sleep',sleep_seconds,'seconds',date||'T06:00:00.000Z',updated_at,'tredict','measured',payload_json FROM rb_health_daily WHERE sleep_seconds IS NOT NULL;
INSERT OR IGNORE INTO rb_health_observations(observation_id,user_id,local_date,metric,value,unit,measured_at,ingested_at,source,quality,payload_json)
SELECT 'health:'||user_id||':'||date||':tredict:rhr',user_id,date,'rhr',rhr_bpm,'bpm',date||'T06:00:00.000Z',updated_at,'tredict','measured',payload_json FROM rb_health_daily WHERE rhr_bpm IS NOT NULL;
