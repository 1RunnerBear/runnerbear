CREATE TABLE IF NOT EXISTS rb_garmin_backfill_checks (
 user_id TEXT NOT NULL, date TEXT NOT NULL, checked_at TEXT NOT NULL,
 has_data INTEGER NOT NULL, PRIMARY KEY(user_id,date)
);
