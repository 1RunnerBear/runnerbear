# RunnerBear v12.2.1 — mobile startup recovery

The production bootstrap failed on 8 September 2026 with D1's explicit daily
row-write-limit error. The public health endpoint remained available. The app
waited for this failed request before binding navigation, and its ten-second
watchdog replaced the actual error with a loading message.

This release:

- Computes health projections without persisting snapshots on reads. An unchanged
  bootstrap reuses its current coach decision without rewriting it.
- Returns the verified canonical plan when a new coach decision cannot be saved
  because of the explicit D1 write quota. No unsaved or superseded decision is
  presented as actionable. Other database errors still fail normally.
- Shows a storage limitation in Today and Plan, and returns HTTP 503 with a
  truthful message for writes rejected by the quota.
- Keeps automatic plan updates out of the first-paint dependency chain. Limits
  GET requests to fifteen seconds and offers a working retry on startup failure.
- Avoids rewriting unchanged Tredict activity, capacity and health history.
  Existing observation triggers retain corrections and remove missing metrics.

Verification: six regression tests exercise the real authenticated base Worker
and current routes against SQLite with all production migrations, explicit D1
quota failures, recovery, read failures, rejected writes, repeat synchronization,
changed/removed metrics, a stalled fetch and a stalled automatic plan update.
The complete release suite contains 398 tests. CI installs the Worker's pinned
authentication dependency before running the integration tests.

Browser checks use synthetic mobile fixtures: a failed startup remains an error
after the watchdog deadline; Retry opens the plan; storage-limited Today, Plan,
Goals and More remain navigable. Production publication uses the existing backup,
history, schema, queue, feature-flag and private-access gates. No migration,
billing change, feature rollout or training-plan change is part of this fix.
