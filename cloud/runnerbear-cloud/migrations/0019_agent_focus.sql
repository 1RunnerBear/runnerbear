-- One optional user-selected focus, it cannot mutate plans or training zones.
CREATE TABLE IF NOT EXISTS rb_agent_focus (
  user_id TEXT NOT NULL,
  focus_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('sleep_routine','body_response')),
  status TEXT NOT NULL CHECK(status IN ('active','completed','dismissed')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,focus_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rb_agent_one_focus ON rb_agent_focus(user_id) WHERE status='active';
