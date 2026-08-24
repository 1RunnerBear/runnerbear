PRAGMA foreign_keys = ON;

-- Repair stale running instructions on future recovery placeholders. The
-- immutable history boundary is preserved by limiting this to the active plan
-- and today/future rows.
UPDATE rb_plan_revision_items
SET prescription_json = CASE
      WHEN json_valid(prescription_json)
      THEN json_set(prescription_json, '$.legacy.desc', '', '$.legacy.detail', '')
      ELSE prescription_json
    END,
    planned_distance_m = 0
WHERE plan_revision_id IN (
    SELECT plan_revision_id FROM rb_plan_revisions WHERE status = 'active'
  )
  AND local_date >= date('now')
  AND (sport <> 'running' OR workout_type IN ('rest','cross'))
  AND (lower(title) LIKE '%alternativ eller hvile%' OR lower(title) LIKE '%hvile · økten utgår%')
  AND (
    lower(COALESCE(json_extract(prescription_json, '$.legacy.desc'), '')) LIKE '%jogg%'
    OR lower(COALESCE(json_extract(prescription_json, '$.legacy.desc'), '')) LIKE '%totalt%km%'
    OR lower(COALESCE(json_extract(prescription_json, '$.legacy.detail'), '')) LIKE '%jogg%'
    OR lower(COALESCE(json_extract(prescription_json, '$.legacy.detail'), '')) LIKE '%totalt%km%'
  );

-- Seed the durable outbox for current 10-day workouts that predate this
-- release. Existing operations and immutable plan/history rows are untouched.
INSERT INTO rb_sync_operations(
  operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,
  idempotency_key,status,created_at,updated_at
)
SELECT
  'sync-' || lower(hex(randomblob(16))),r.user_id,i.workout_id,r.plan_revision_id,
  'tredict','create','tredict:' || i.workout_id || ':' || r.plan_revision_id || ':create',
  'queued',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM rb_plan_revisions r
JOIN rb_plan_revision_items i ON i.plan_revision_id = r.plan_revision_id
WHERE r.status = 'active'
  AND i.local_date BETWEEN date('now') AND date('now','+9 days')
  AND i.status = 'scheduled'
  AND i.sport = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM rb_sync_operations o
    WHERE o.user_id = r.user_id
      AND o.workout_id = i.workout_id
      AND o.plan_revision_id = r.plan_revision_id
  );
