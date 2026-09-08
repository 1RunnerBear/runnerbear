# RunnerBear v12.1 · Calm Flow

Locked 2026-09-08. Concept 1 / Premium rolig remains the design direction.

## Shipped scope

- Remove shoe administration, classification, mileage calculation and replacement mutations. Existing historical shoe data is neither deleted nor migrated. No Strava integration is added.
- Today: one decision/workout surface, compact health when normal, and one support slot. Errors and delayed transport outrank plan changes, unread review and weekly purpose. Required decision actions remain on the primary surface.
- Weekly review: marked read only on deliberate opening; stable visible-content identity ignores revision/timestamp churn. Read review remains accessible from Plan. Plan changes can be acknowledged while their details and undo remain in Plan.
- Plan: Week and Long-term, month explicitly requested, weekly purpose for the current week. Remaining volume counts remaining scheduled work, not missed training as debt.
- Goals: target time, direction and next checkpoint once; forecast evidence stays under disclosure.
- More: closed, lazily computed insights; training profile, data sources, coach authority and change history. Suggest-and-approve is the default. Existing observer opt-out is retained. Safe autopilot is offered only with the existing server flag; this release never changes that flag or expands authority.
- Five ordered CSS sources, original selector specificity/cascade preserved, unused selectors removed. Server-provided quiet tone explicitly retained. Warm paper/forest palette and original hero assets retained.
- Preserve opened details, dirty forms, focus and scroll during background paint. Preserve selected Plan day across tab changes.

## Incidental fixes verified in this release

- First launch no longer throws while checking a null plan cache. Missing data still cannot pass revision integrity checks.
- Canonical workout description/detail no longer fall back to an obsolete static workout on the same date.
- Primary-button contrast, icon-only month toggle label and large-text grid sizing corrected.

## Safety boundaries

No training philosophy, workout-bank, database schema, feature-flag, history or transport redesign. Canonical revision guards, confirmation, reversible changes and existing <=20% reduction policy remain. Bridge protocol remains 12.0.0; app/Cloud release is 12.1.0. Competition-week mode is outside this release.

## Local release gates

- 331 automated tests pass, including nine Calm Flow tests and original plan/history/sync guards.
- Browser fixture uses real compiled app assets and synthetic data; all non-GET fixture requests are rejected. No production plan is changed by UX testing.
- All four tabs checked at 320, 375, 390 and 430 px without horizontal document overflow.
- Desktop Plan: 920 px content width in a 1180 px frame. Month starts closed and opens on request.
- 200% text-size simulation checked in Today and expanded training profile at 320 px; no overflowing visible descendants after corrections. This is a font-size simulation, not native OS Dynamic Type certification.
- Workout/health/review dialogs, read-review behavior, Plan review access, lazy insight expansion and a dirty training-profile draft across background refresh checked interactively.
- Four startup JS/CSS requests preserved. Compressed CSS gate: <=75% of v12 baseline (48,084 bytes gzip level 9).
- Baseline production health: v12.0.0, historyIntegrity=true, no outstanding sync work, one canonical plan to 2026-10-03.

## Production gate and rollback

Use the existing GitHub/Cloudflare workflow, including its pre-deploy backup, history verification, additive migrations, private Access guard and read-only health check. Do not bypass failures. Require app/cloud 12.1.0, historyIntegrity=true, zero duplicate external IDs and drained sync queues before marking deployment complete. Production browser content is Access-protected; local fixture QA is not represented as authenticated production visual QA.

Rollback, if required, is a normal revert of this release commit and redeploy through the same guarded workflow. No destructive history migration is needed.
