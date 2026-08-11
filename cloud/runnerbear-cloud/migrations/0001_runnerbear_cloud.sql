PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rb_users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rb_state (
  user_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, namespace),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rb_plan_days (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  goal_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  km REAL,
  status TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_plan_days_user_date ON rb_plan_days(user_id, date);

CREATE TABLE IF NOT EXISTS rb_activities (
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  date TEXT NOT NULL,
  sport_type TEXT NOT NULL DEFAULT '',
  sub_sport_type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  duration_seconds REAL,
  distance_m REAL,
  pace_seconds_per_km REAL,
  avg_hr REAL,
  max_hr REAL,
  power REAL,
  cadence REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source, source_id),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_activities_user_date ON rb_activities(user_id, date DESC);

CREATE TABLE IF NOT EXISTS rb_health_daily (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hrv_ms REAL,
  sleep_seconds REAL,
  rhr_bpm REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_health_user_date ON rb_health_daily(user_id, date DESC);

CREATE TABLE IF NOT EXISTS rb_capacity (
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'runnerbear',
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, timestamp, source),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_capacity_user_timestamp ON rb_capacity(user_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS rb_shoes (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  km REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rb_sync_sources (
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  last_synced_at TEXT,
  status TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source),
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
