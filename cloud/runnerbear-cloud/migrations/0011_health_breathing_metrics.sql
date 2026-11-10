-- Optional daily metrics for the personal health layer. Additive only: the
-- existing Tredict health fields and decision engine remain authoritative.
ALTER TABLE rb_health_daily ADD COLUMN spo2_avg_pct REAL;
ALTER TABLE rb_health_daily ADD COLUMN spo2_min_pct REAL;
ALTER TABLE rb_health_daily ADD COLUMN respiration_avg_bpm REAL;
ALTER TABLE rb_health_daily ADD COLUMN sleep_score INTEGER;
ALTER TABLE rb_health_daily ADD COLUMN health_source TEXT NOT NULL DEFAULT 'tredict';
ALTER TABLE rb_health_daily ADD COLUMN health_quality TEXT NOT NULL DEFAULT 'partial';
