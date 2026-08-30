# RunnerBear v11.4.1 — Reliability Patch

Release scope is locked to reliability and trust fixes for the v11.4 product. The Premium rolig concept, four-tab navigation, explicit confirmation flow, undo behavior, and maximum automatic reduction of 20% remain unchanged.

## Included

- Coach Live now normalizes provider output into a RunnerBear-owned SSE contract.
- Empty or reasoning-only streamed responses fall back to a complete response.
- Assistant replies and failed runs are durable across reloads, with an in-context retry action.
- Coach Live remains advisory and cannot write or alter the training plan.
- `/health` is read-only; repair and synchronization work stays in scheduled jobs.
- The weekly review no longer claims volume was below plan when actual volume was higher.
- The Tredict warning links directly to the relevant control.
- Production rollout gates require build `11.4.1`, schema `4`, the read-only health contract, and Coach Live reliability audit.

## Release gates

- Root test suite: 278 tests passing.
- Cloud test suite: 83 tests passing.
- Worker dry-run must succeed before merge.
- Production health must report build `11.4.1`, schema `4`, `healthReadOnly: true`, and a healthy Coach Live reliability audit.
- A production Coach Live request must return a non-empty assistant answer before the release is considered complete.

## Rollback

Rollback to the previous Worker deployment if the production health contract fails or Coach Live produces an empty response. No database migration is included in this patch.
