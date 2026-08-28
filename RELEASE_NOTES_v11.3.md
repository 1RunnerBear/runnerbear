# RunnerBear 11.3.0 — One Decision Coach Experience

Released: 2026-08-28

## What changed

- The Today surface now combines the active workout, deterministic coach decision, Body Response and Coach Live into one current recommendation.
- One Decision is generated server-side from the active plan revision and added to the existing bootstrap response, so first load uses no additional request.
- The primary recommendation shows at most three evidence items and one dominant action.
- Safe coach reductions open a before/after review and require explicit confirmation.
- Choosing to keep the plan is persisted for the current decision window and does not immediately recreate the same proposal.
- Accepted reductions still use the canonical plan revision, durable Tredict sync and existing undo flow.
- Coach Live receives the same minimized One Decision context and can open RunnerBear's structured action flow, while retaining zero plan-write authority.
- The visual treatment follows the locked Concept 1 / Premium calm direction, with accessible dialog semantics, 44–50 px controls, focus-visible styling and reduced-motion support.

## Safety and data model

- No new D1 migration or state authority.
- No readiness score and no dose increase from positive recovery signals.
- Maximum deterministic reduction remains 20%.
- Stale, mismatched or invalid proposals fail closed to refresh.
- Health data remains contextual evidence rather than diagnosis.

## Performance

- Four canonical static asset requests remain unchanged.
- No extra bootstrap request.
- The combined compressed asset package remains below the locked 15% growth ceiling relative to the v10.27 baseline.
- Worker upload in local dry-run: 373.84 KiB raw / 87.65 KiB gzip.

## Release verification

- 262 Node tests, including One Decision contract, UX, safety and release gates.
- All eight existing D1 migrations applied locally; the 14-table schema audit passed.
- Wrangler 4.120.1 dry-run passed with D1, service, Workers AI and static asset bindings.
- Production deploy gate requires `cloudBuild: 11.3.0`, `oneDecisionVersion: one-decision-1`, zero AI plan writes and the existing Coach Live, Body Response, Bakken, history, Tredict and Access checks.
