CREATE TABLE rb_garmin_shadow (user_id TEXT NOT NULL REFERENCES rb_users(id) ON DELETE CASCADE,date TEXT NOT NULL,metrics TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,date));
