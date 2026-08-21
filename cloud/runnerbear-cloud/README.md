# RunnerBear Cloud v10.27

RunnerBear Cloud is the authenticated source of truth for Coach Loop. The v1 API remains available as the rollback compatibility surface; `/api/v2/*` owns versioned plans, coach decisions, feedback events and the 10-day Tredict projection after staged activation.

## Deploy and schema

The production workflow applies additive D1 migrations before deploying code, validates `/health`, and ensures the owner-only rollout flags exist. Existing flag values are never reset by a deploy. Run locally with:

```sh
npm ci
npm run db:migrate:local
npm run check
```

`/health` must report `cloudBuild: "10.27.0"`, `schemaVersion: 2`, `coachLoop: true`, `historyIntegrity: true`, a D1 binding, static assets and healthy Tredict RPC v10.26.0.

## Coach Loop API

- `GET /api/v2/bootstrap?scope=home|full` — atomic plan, workout, decision, readiness/response, sync and flag snapshot.
- `POST /api/v2/migration/preview|commit` — source-hashed legacy migration.
- `POST /api/v2/plan/preview|commit|undo` — constraint validation, revision CAS and compatibility projection.
- `GET /api/v2/coach/decision` and `POST /api/v2/coach/decision/:id/resolve`.
- `POST /api/v2/feedback` and `POST /api/v2/events` — immutable response events.
- `GET /api/v2/sync/status` and `POST /api/v2/sync/process` — idempotent 10-day Tredict operations.

All API routes remain behind the existing Cloudflare Access identity. Request bodies are bounded by the existing Worker reader. Health is the only public route.

## Feature flags

All flags default to false. Valid order is:

1. `coach_loop_shadow`
2. `coach_loop_read` after committed migration and 20 consecutive matching shadow bootstraps
3. `coach_loop_ui` after mobile/visual/a11y review
4. `coach_loop_write` after migration replay and undo verification
5. `coach_loop_sync` after create/move/replace/cancel shadow verification
6. `coach_loop_safe_auto` no earlier than seven error-free days; the athlete must also opt in

`coach_loop_goal_confidence` can be enabled separately after its evidence gate. The backend rejects invalid dependency combinations. `COACH_LOOP_KILL_SWITCH=true` stops every v2 write/sync and serves compatibility snapshots for v2 reads.

`.github/workflows/runnerbear-coach-loop-rollout.yml` advances these gates only after the full release suite passes. It records every flag transition in `rb_feature_flag_audit`, records a daily worst-case integrity result in `rb_rollout_observations`, and enables safe-auto only after seven complete 24-hour periods, seven clean observation dates and canonical explicit consent. A failed observation performs a non-destructive full flag rollback and requires 20 new matching shadow reports before reactivation.

## Rollback

Rollback is non-destructive. Disable only the affected layer first:

- UI regression: `coach_loop_ui=false`
- coach error: `coach_loop_safe_auto=false`
- plan integrity: `coach_loop_write=false`, then `coach_loop_read=false`
- transport issue: `coach_loop_sync=false`
- v2/D1 incident: set `COACH_LOOP_KILL_SWITCH=true`
- full release failure: redeploy the last good Worker and point `index.html` to the retained v10.25 assets

Do not reverse migration `0002`. Canonical events/revisions remain read-only after rollback. Every canonical write projects forward state to `rb_plan_days` and legacy localStorage namespaces in `rb_state`, so v10.25 can resume without becoming a second authority.

Before reactivation, verify `/health`, the app shell, v1 bootstrap, compatibility plan and last Tredict status, then restart shadow comparison from zero.

The rollout workflow also exposes owner-only manual rollback levels for safe-auto, sync, writes, UI and the complete canonical stack. Rollback never deletes migrations, events, plans or audit evidence.

## Data and observability

Structured logs contain stable owner scope, correlation/revision/decision/operation IDs, status, policy and reason codes—never raw health values, email, tokens or full explanation text. Actual private production records must not be copied into repository fixtures.
