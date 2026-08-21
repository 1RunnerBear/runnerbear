PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rb_athlete_config (
  user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo', profile_json TEXT NOT NULL DEFAULT '{}',
  constraints_json TEXT NOT NULL DEFAULT '{}', goal_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rb_training_events (
  event_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL, local_date TEXT NOT NULL DEFAULT '', source TEXT NOT NULL,
  source_id TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
  quality TEXT NOT NULL DEFAULT 'unknown' CHECK(quality IN ('unknown','low','medium','high')),
  ingested_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  UNIQUE (user_id,source,source_id,event_type)
);
CREATE INDEX IF NOT EXISTS idx_rb_training_events_user_time ON rb_training_events(user_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS rb_workouts (
  workout_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lineage_id TEXT NOT NULL,
  created_at TEXT NOT NULL, retired_at TEXT,
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rb_workouts_user_lineage ON rb_workouts(user_id,lineage_id);
CREATE TABLE IF NOT EXISTS rb_plan_revisions (
  plan_revision_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, parent_revision_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','active','superseded','rolled_back')),
  reason_code TEXT NOT NULL, source_event_id TEXT, policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL, activated_at TEXT, superseded_at TEXT,
  FOREIGN KEY (user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_revision_id) REFERENCES rb_plan_revisions(plan_revision_id),
  FOREIGN KEY (source_event_id) REFERENCES rb_training_events(event_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rb_plan_active_user ON rb_plan_revisions(user_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS rb_plan_revision_items (
  plan_revision_id TEXT NOT NULL, workout_id TEXT NOT NULL, local_date TEXT NOT NULL,
  slot_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('scheduled','completed','cancelled','replaced','skipped')),
  sport TEXT NOT NULL, workout_type TEXT NOT NULL, title TEXT NOT NULL, intent TEXT NOT NULL DEFAULT '',
  prescription_json TEXT NOT NULL DEFAULT '{}', planned_duration_seconds REAL, planned_distance_m REAL,
  planned_load_json TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT 'runnerbear',
  lock_level TEXT NOT NULL DEFAULT 'none' CHECK(lock_level IN ('none','user','system')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(plan_revision_id,workout_id), UNIQUE(plan_revision_id,local_date,slot_index),
  FOREIGN KEY(plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id) ON DELETE CASCADE,
  FOREIGN KEY(workout_id) REFERENCES rb_workouts(workout_id)
);
CREATE INDEX IF NOT EXISTS idx_rb_plan_items_date ON rb_plan_revision_items(plan_revision_id,local_date,slot_index);
CREATE TABLE IF NOT EXISTS rb_coach_decisions (
  decision_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan_revision_id TEXT NOT NULL,
  input_cursor TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK(decision_type IN ('keep','reduce','replace','move','rest','replan','wait_for_data','needs_input')),
  status TEXT NOT NULL CHECK(status IN ('proposed','auto_applied','accepted','rejected','superseded','undone')),
  confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
  reason_codes_json TEXT NOT NULL DEFAULT '[]', evidence_json TEXT NOT NULL DEFAULT '[]',
  action_json TEXT NOT NULL DEFAULT '{}', explanation_json TEXT NOT NULL DEFAULT '{}', policy_version TEXT NOT NULL,
  valid_until TEXT, created_at TEXT NOT NULL, resolved_at TEXT, undo_plan_revision_id TEXT,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id),
  FOREIGN KEY(undo_plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id)
);
CREATE INDEX IF NOT EXISTS idx_rb_coach_decisions_user_created ON rb_coach_decisions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS rb_athlete_baselines (
  user_id TEXT NOT NULL, metric TEXT NOT NULL, window_days INTEGER NOT NULL, value REAL,
  sample_count INTEGER NOT NULL DEFAULT 0, quality TEXT NOT NULL DEFAULT 'insufficient',
  as_of TEXT NOT NULL, input_cursor TEXT NOT NULL,
  PRIMARY KEY(user_id,metric,window_days), FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rb_sync_operations (
  operation_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, workout_id TEXT NOT NULL,
  plan_revision_id TEXT NOT NULL, destination TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('create','update','move','cancel','replace')),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('queued','processing','confirmed','review_required','failed_retryable','failed_terminal','superseded')),
  external_id TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_retry_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(workout_id) REFERENCES rb_workouts(workout_id),
  FOREIGN KEY(plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id)
);
CREATE INDEX IF NOT EXISTS idx_rb_sync_operations_queue ON rb_sync_operations(user_id,destination,status,next_retry_at);
CREATE TABLE IF NOT EXISTS rb_feature_flags (
  user_id TEXT NOT NULL, flag TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  payload_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,flag), FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rb_migrations (
  user_id TEXT NOT NULL, migration_key TEXT NOT NULL, source_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('previewed','committed','failed')),
  result_plan_revision_id TEXT, detail_json TEXT NOT NULL DEFAULT '{}', started_at TEXT NOT NULL, completed_at TEXT,
  PRIMARY KEY(user_id,migration_key), FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(result_plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id)
);
