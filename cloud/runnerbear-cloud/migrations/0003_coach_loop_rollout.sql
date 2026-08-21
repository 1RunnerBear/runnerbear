PRAGMA foreign_keys = ON;

-- Immutable operational evidence for the staged v10.26 activation and rollback.
CREATE TABLE IF NOT EXISTS rb_feature_flag_audit (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  source_sha TEXT NOT NULL DEFAULT '',
  flags_json TEXT NOT NULL DEFAULT '{}',
  gates_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_feature_flag_audit_user_time
  ON rb_feature_flag_audit(user_id, created_at DESC);

-- One immutable result per UTC observation date. Safe-auto requires seven
-- distinct clean dates and at least seven complete 24-hour periods.
CREATE TABLE IF NOT EXISTS rb_rollout_observations (
  observation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  observed_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('clean','blocked')),
  active_plan_count INTEGER NOT NULL,
  compatibility_mismatch_count INTEGER NOT NULL DEFAULT 0,
  duplicate_sync_count INTEGER NOT NULL DEFAULT 0,
  terminal_sync_error_count INTEGER NOT NULL DEFAULT 0,
  retryable_sync_error_count INTEGER NOT NULL DEFAULT 0,
  stale_decision_count INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  UNIQUE (user_id, observed_date)
);
CREATE INDEX IF NOT EXISTS idx_rb_rollout_observations_user_date
  ON rb_rollout_observations(user_id, observed_date DESC);
