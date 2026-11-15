-- Requeue existing historical activity windows for bounded, one-day-at-a-time metadata repair.
UPDATE rb_garmin_backfill_checks SET activity_checked_at=NULL WHERE activity_checked_at IS NOT NULL;
