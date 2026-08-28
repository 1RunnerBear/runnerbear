-- RunnerBear v11.2 Coach Live. Additive, owner-scoped conversation provenance.
CREATE TABLE IF NOT EXISTS rb_coach_live_threads (
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Ny samtale',
  context_surface TEXT NOT NULL DEFAULT 'today' CHECK(context_surface IN ('today','workout','body_response','plan','goals','more')),
  plan_revision_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT,
  PRIMARY KEY(user_id,thread_id),
  FOREIGN KEY(user_id) REFERENCES rb_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rb_coach_live_threads_user_updated
  ON rb_coach_live_threads(user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS rb_coach_live_messages (
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 12000),
  category TEXT NOT NULL DEFAULT 'general',
  context_json TEXT NOT NULL DEFAULT '{}',
  model TEXT,
  plan_revision_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,message_id),
  FOREIGN KEY(user_id,thread_id) REFERENCES rb_coach_live_threads(user_id,thread_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rb_coach_live_messages_thread_created
  ON rb_coach_live_messages(user_id,thread_id,created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rb_coach_live_messages_user_created
  ON rb_coach_live_messages(user_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_rb_coach_live_messages_no_update
BEFORE UPDATE ON rb_coach_live_messages
BEGIN
  SELECT RAISE(ABORT,'coach_live_messages_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_rb_coach_live_messages_no_delete
BEFORE DELETE ON rb_coach_live_messages
BEGIN
  SELECT RAISE(ABORT,'coach_live_messages_immutable');
END;

CREATE TABLE IF NOT EXISTS rb_coach_live_runs (
  user_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  user_message_id TEXT NOT NULL,
  assistant_message_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed','safety_redirect')),
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY(user_id,run_id),
  FOREIGN KEY(user_id,thread_id) REFERENCES rb_coach_live_threads(user_id,thread_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id,user_message_id) REFERENCES rb_coach_live_messages(user_id,message_id) ON DELETE RESTRICT,
  FOREIGN KEY(user_id,assistant_message_id) REFERENCES rb_coach_live_messages(user_id,message_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rb_coach_live_runs_thread_created
  ON rb_coach_live_runs(user_id,thread_id,created_at DESC);
