-- RunnerBear v11.8 · one canonical plan and a verified rolling Tredict mirror.
-- Additive only: immutable activities, completed workouts and historical revisions are untouched.

CREATE TABLE IF NOT EXISTS rb_canonical_plans (
  canonical_plan_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  active_goal_date TEXT,
  mode TEXT NOT NULL DEFAULT 'rolling' CHECK(mode IN ('goal','rolling')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO rb_canonical_plans(canonical_plan_id,user_id,active_goal_date,mode,status,created_at,updated_at)
SELECT 'rb-plan-' || replace(lower(id),' ','-'),id,
       CASE WHEN json_valid(a.goal_json) THEN json_extract(a.goal_json,'$.date') ELSE NULL END,
       CASE WHEN json_valid(a.goal_json) AND json_extract(a.goal_json,'$.date') IS NOT NULL THEN 'goal' ELSE 'rolling' END,
       'active',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM rb_users u LEFT JOIN rb_athlete_config a ON a.user_id=u.id;

ALTER TABLE rb_plan_revisions ADD COLUMN canonical_plan_id TEXT;
UPDATE rb_plan_revisions
SET canonical_plan_id=(SELECT canonical_plan_id FROM rb_canonical_plans p WHERE p.user_id=rb_plan_revisions.user_id)
WHERE canonical_plan_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_rb_plan_revisions_canonical ON rb_plan_revisions(user_id,canonical_plan_id,status);

ALTER TABLE rb_sync_operations ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE rb_sync_operations ADD COLUMN desired_fingerprint TEXT NOT NULL DEFAULT '';

ALTER TABLE rb_sync_bindings ADD COLUMN canonical_plan_id TEXT;
ALTER TABLE rb_sync_bindings ADD COLUMN active_plan_revision_id TEXT;
ALTER TABLE rb_sync_bindings ADD COLUMN remote_date TEXT;
ALTER TABLE rb_sync_bindings ADD COLUMN remote_fingerprint TEXT NOT NULL DEFAULT '';
ALTER TABLE rb_sync_bindings ADD COLUMN last_confirmed_at TEXT;
ALTER TABLE rb_sync_bindings ADD COLUMN last_attempt_at TEXT;
ALTER TABLE rb_sync_bindings ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';

UPDATE rb_sync_bindings
SET canonical_plan_id=(SELECT canonical_plan_id FROM rb_canonical_plans p WHERE p.user_id=rb_sync_bindings.user_id),
    active_plan_revision_id=confirmed_plan_revision_id,
    remote_date=confirmed_date,
    last_confirmed_at=CASE WHEN status='confirmed' THEN updated_at ELSE NULL END,
    last_attempt_at=updated_at,
    sync_status=status
WHERE canonical_plan_id IS NULL OR remote_date IS NULL;

CREATE TABLE IF NOT EXISTS rb_provider_capabilities (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  discovered_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY(user_id,provider),
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rb_reconciliation_state (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  canonical_plan_id TEXT NOT NULL,
  active_plan_revision_id TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  last_started_at TEXT,
  last_completed_at TEXT,
  last_result TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(user_id,provider),
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rb_sync_bindings_remote_fingerprint
  ON rb_sync_bindings(user_id,destination,remote_fingerprint,remote_date);
