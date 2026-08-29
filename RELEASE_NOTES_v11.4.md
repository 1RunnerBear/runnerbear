# RunnerBear 11.4.0 — Closed Loop Coach

Released: 2026-08-29

## What changed

- v11.4, v11.5 and v11.6 are delivered as one coherent Closed Loop Coach release.
- One Decision v2 adds calm, plain-language confidence without a score, gauge or false precision.
- Coach memory connects up to three prior deterministic recommendations with the athlete's choice and the response observed afterward.
- A completed workout without feedback becomes one `Gi kort respons` action in the existing workout detail.
- Post-workout feedback without a next-morning response becomes one linked body check-in when that response is relevant.
- Safety clarification and deterministic adjustments still outrank follow-up.
- Coach Live receives the same minimized decision, confidence, memory and follow-up context, but retains zero plan-write authority.
- The existing Concept 1 / Premium calm Today hierarchy remains intact; memory uses native progressive disclosure inside One Decision rather than a new tab or card.

## Safety, privacy and data model

- No new D1 migration, route or browser request.
- Every active decision and confidence label is validated against the current plan revision and validity window.
- Stale, expired or mismatched decisions fail closed to refresh.
- Positive recovery data cannot increase distance, duration or intensity.
- Deterministic reduction remains capped at 20%, with confirmation and undo.
- Public coach memory is bounded to three summaries and excludes raw health values, check-in source rows and conversation content.
- The language model explains observed context and may not claim that a recommendation caused a later response.

## Performance and accessibility

- The locked four-request static budget is unchanged.
- The canonical stylesheet remains under 260 KB raw and the full compressed asset package remains below the locked 15% regression ceiling.
- Decision history and check-in reads are bounded and run inside existing parallel bootstrap work.
- Coach memory uses native `details`/`summary`, visible keyboard focus and reduced-motion handling.
- Follow-up reuses existing accessible workout and Body Response sheets and moves focus to the useful control.

## Release verification

- 272 Node tests cover the complete regression suite, continuity contract, stale confidence, memory limits, activity-backed follow-up, UX, privacy and release gates.
- All eight existing D1 migrations applied locally; the 14-table schema audit passed.
- The complete Worker import graph bundled and passed syntax validation.
- Production deployment requires GitHub Actions to pass the authoritative Wrangler deploy, history backup, remote schema audit and health gate for `cloudBuild: 11.4.0`, `oneDecisionVersion: one-decision-2` and `coachContinuityVersion: coach-continuity-1`.
