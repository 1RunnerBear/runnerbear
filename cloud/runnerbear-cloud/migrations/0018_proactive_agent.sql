-- Read-only insights: never changes plan, zones or source authority.
CREATE TABLE IF NOT EXISTS rb_agent_snapshots (
  user_id TEXT NOT NULL, local_date TEXT NOT NULL, input_revision TEXT NOT NULL,
  payload_json TEXT NOT NULL, started_at TEXT NOT NULL, updated_at TEXT NOT NULL, checked_at TEXT NOT NULL,
  PRIMARY KEY(user_id, local_date)
);
CREATE TABLE IF NOT EXISTS rb_agent_items (
  user_id TEXT NOT NULL, item_id TEXT NOT NULL, kind TEXT NOT NULL,
  local_date TEXT NOT NULL, input_revision TEXT NOT NULL, status TEXT NOT NULL,
  payload_json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,item_id)
);
CREATE INDEX IF NOT EXISTS idx_rb_agent_items_date ON rb_agent_items(user_id,local_date DESC);
CREATE TABLE IF NOT EXISTS rb_agent_receipts (
  user_id TEXT NOT NULL, item_id TEXT NOT NULL, input_revision TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('seen','skipped')), created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,item_id,input_revision)
);
