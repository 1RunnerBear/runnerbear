CREATE TABLE IF NOT EXISTS rb_garmin_observation_days (
  user_id TEXT NOT NULL,
  observed_date TEXT NOT NULL,
  first_checked_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  checks INTEGER NOT NULL,
  checks_with_data INTEGER NOT NULL,
  plan_failures INTEGER NOT NULL,
  PRIMARY KEY (user_id, observed_date)
);
