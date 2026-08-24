-- RunnerBear 10.31.1 · one durable provider binding per canonical workout.
-- This is additive and does not mutate plan or activity history.

CREATE TABLE IF NOT EXISTS rb_sync_bindings (
  user_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  stable_external_id TEXT NOT NULL,
  remote_workout_id TEXT,
  confirmed_date TEXT,
  confirmed_plan_revision_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','conflict','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,destination,workout_id),
  UNIQUE(user_id,destination,stable_external_id),
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE,
  FOREIGN KEY(workout_id) REFERENCES rb_workouts(workout_id),
  FOREIGN KEY(confirmed_plan_revision_id) REFERENCES rb_plan_revisions(plan_revision_id)
);

CREATE INDEX IF NOT EXISTS idx_rb_sync_bindings_remote
  ON rb_sync_bindings(user_id,destination,remote_workout_id);

CREATE INDEX IF NOT EXISTS idx_rb_sync_bindings_date
  ON rb_sync_bindings(user_id,destination,confirmed_date,status);
