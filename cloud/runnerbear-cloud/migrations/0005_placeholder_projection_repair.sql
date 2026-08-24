PRAGMA foreign_keys = ON;

-- A placeholder title is authoritative. Repair active today/future rows even
-- when older data incorrectly still labels the workout as running/quality.
UPDATE rb_plan_revision_items
SET sport = CASE
      WHEN lower(title) LIKE '%alternativ eller hvile%' THEN 'cross'
      ELSE 'rest'
    END,
    workout_type = CASE
      WHEN lower(title) LIKE '%alternativ eller hvile%' THEN 'cross'
      ELSE 'rest'
    END,
    intent = 'recovery',
    prescription_json = CASE
      WHEN json_valid(prescription_json)
      THEN json_set(
        prescription_json,
        '$.main', json('{"kind":"recovery"}'),
        '$.legacy.desc', CASE
          WHEN lower(title) LIKE '%alternativ eller hvile%' THEN '45–50 min lett + mobilitet/styrke.'
          ELSE 'Hvile.'
        END,
        '$.legacy.detail', 'Restitusjonsdag uten løpsdrag.'
      )
      ELSE prescription_json
    END,
    planned_duration_seconds = NULL,
    planned_distance_m = 0
WHERE plan_revision_id IN (
    SELECT plan_revision_id FROM rb_plan_revisions WHERE status = 'active'
  )
  AND local_date >= date('now')
  AND (
    lower(title) LIKE '%alternativ eller hvile%'
    OR lower(title) LIKE '%hvile · økten utgår%'
  );

-- Any earlier create/move for the inconsistent running projection must not be
-- processed after the repair. A canonical cancel lets Tredict converge when
-- the workout was already published.
UPDATE rb_sync_operations
SET status = 'superseded',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE status IN ('queued','processing','failed_retryable','review_required')
  AND workout_id IN (
    SELECT i.workout_id
    FROM rb_plan_revision_items i
    JOIN rb_plan_revisions r ON r.plan_revision_id = i.plan_revision_id
    WHERE r.status = 'active'
      AND i.local_date >= date('now')
      AND (
        lower(i.title) LIKE '%alternativ eller hvile%'
        OR lower(i.title) LIKE '%hvile · økten utgår%'
      )
  );

INSERT INTO rb_sync_operations(
  operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,
  idempotency_key,status,created_at,updated_at
)
SELECT
  'sync-' || lower(hex(randomblob(16))),r.user_id,i.workout_id,r.plan_revision_id,
  'tredict','cancel','tredict:' || i.workout_id || ':' || r.plan_revision_id || ':cancel-placeholder-repair-10281',
  'queued',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM rb_plan_revisions r
JOIN rb_plan_revision_items i ON i.plan_revision_id = r.plan_revision_id
WHERE r.status = 'active'
  AND i.local_date >= date('now')
  AND i.status = 'scheduled'
  AND (
    lower(i.title) LIKE '%alternativ eller hvile%'
    OR lower(i.title) LIKE '%hvile · økten utgår%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM rb_sync_operations o
    WHERE o.user_id = r.user_id
      AND o.workout_id = i.workout_id
      AND o.plan_revision_id = r.plan_revision_id
      AND o.idempotency_key = 'tredict:' || i.workout_id || ':' || r.plan_revision_id || ':cancel-placeholder-repair-10281'
  );
