CREATE TABLE IF NOT EXISTS rb_garmin_activity_shadow (
 user_id TEXT NOT NULL, activity_id TEXT NOT NULL, local_date TEXT NOT NULL,
 summary_json TEXT NOT NULL, PRIMARY KEY(user_id,activity_id)
);
