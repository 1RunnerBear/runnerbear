# RunnerBear v11.4 — Closed Loop Coach

Status: **LOCKED**
Release: `11.4.0`
Product concept: `One Decision · Confidence · Memory · Follow-up`
Visual direction: `Design Direction 1.0 · Concept 1 · Premium calm`
Locked: `2026-08-28`

## 1. Release decision

The previously planned v11.4, v11.5 and v11.6 product steps are combined into one production release named **RunnerBear v11.4 — Closed Loop Coach**.

The absorbed scopes are:

1. **v11.4 — Decision confidence and explainability:** show how strong the basis is without a readiness score, false precision or another dashboard.
2. **v11.5 — Coach memory:** connect prior deterministic recommendations with the athlete's choice and the observed response.
3. **v11.6 — Closed-loop follow-up:** make the missing post-workout or next-morning response the next useful action when it can materially improve the current decision.

These belong in one release because they share one read model, one Today hierarchy and one Coach Live context. Shipping them separately would create temporary surfaces that show confidence without learning, memory without follow-up or follow-up without a visible reason.

## 2. Outcome

RunnerBear shall feel like a coach that remembers its own advice and learns from the athlete's response:

> Tell me what matters now, how certain the basis is, what you learned last time and the one response you need next.

The release closes the loop:

`signal → deterministic decision → athlete choice → training outcome → response → next decision`

The language model remains outside the authority loop. It explains the same structured state and never writes the plan.

## 3. Locked product principles

1. Today still contains exactly one authoritative decision and one visually dominant primary action.
2. Confidence is expressed in calm language, never as a percentage, gauge, traffic light or readiness number.
3. Coach memory contains only decision-relevant summaries. It is not a feed, diary or new main card.
4. A follow-up becomes primary only when it is the safest missing input for today's decision or when today's completed workout has not received a useful response.
5. Safety, stale data, deterministic adjustment and required clarification outrank ordinary follow-up.
6. Prior advice is never shown as current. Every active decision remains bound to the canonical plan revision, input cursor and validity window.
7. The athlete's choice is respected. A rejected proposal remains rejected for its decision window.
8. Positive recovery data can support the planned dose but cannot increase distance, duration or intensity.
9. Every plan change still requires the existing deterministic proposal, before/after preview, explicit confirmation and canonical undo.
10. RunnerBear remains the source of truth; Tredict and Garmin remain projections and transport.

## 4. Authority and data model

No D1 migration is introduced.

Existing authorities are reused:

- `rb_coach_decisions`: recommendation, confidence, resolution and plan-revision provenance.
- `rb_plan_revisions` and `rb_plan_revision_items`: authoritative plan history and workout identity.
- `rb_training_events`: post-workout feedback and imported decision-relevant events.
- `rb_subjective_checkins`: morning, post-workout and next-morning subjective state.
- `rb_workout_response_links`: response-to-workout provenance.
- `rb_activities`: observed completion and activity evidence.
- `rb_coach_live_*`: immutable conversation history only.

The home bootstrap adds two bounded internal source collections:

- up to eight recent coach decisions across plan revisions;
- up to thirty recent subjective check-ins.

The public v11.4 augmentation converts them into a minimized `coachContinuity` envelope. The browser and Coach Live consume the minimized envelope, not raw health values or unbounded history.

## 5. Coach Continuity contract

The existing `/api/v2/bootstrap` response is extended without a new request:

```json
{
  "coachContinuity": {
    "version": "coach-continuity-1",
    "planRevisionId": "...",
    "generatedAt": "...",
    "confidence": {
      "level": "high",
      "label": "Godt beslutningsgrunnlag",
      "basis": "Plan, kroppssignaler og respons er kontrollert.",
      "nextEvidence": "Responsen etter neste relevante økt styrker grunnlaget."
    },
    "memory": {
      "status": "learning",
      "summary": "RunnerBear har fulgt opp tidligere råd og respons.",
      "observedDecisions": 0,
      "learnedResponses": 0,
      "recent": []
    },
    "followUp": {
      "required": false,
      "phase": null,
      "workoutId": null,
      "localDate": null,
      "label": null,
      "prompt": null,
      "actionKind": null
    },
    "safety": {
      "planWritesByAi": false,
      "historyLimit": 3,
      "rawHealthValuesExposed": false
    }
  }
}
```

Contract invariants:

- `version` is exactly `coach-continuity-1`.
- `planRevisionId` equals the active bootstrap revision.
- `memory.recent` contains at most three summaries.
- Each memory item contains only decision type, resolution, affected workout identity/date, reason summary and bounded response status.
- No prompt text, conversation content or raw HRV/sleep/resting-heart-rate value enters memory.
- Confidence is copied from the deterministic coach decision and translated to stable language; it is never generated by the LLM.
- Missing or mismatched data produces a truthful `building` state, never fabricated learning.
- Follow-up targets one stable workout ID and one allowed phase.

## 6. One Decision v2

The Today contract advances from `one-decision-1` to `one-decision-2`.

It retains every v11.3 safety invariant and adds:

- `confidence` from `coachContinuity.confidence`;
- a minimized `memory` summary;
- a bounded `followUp` object;
- the `reflect` state;
- the `complete_feedback` action kind.

Allowed states:

| State | Meaning | Primary action |
| --- | --- | --- |
| `follow` | Current signals support the planned dose | Open workout |
| `adjust` | A deterministic bounded proposal is ready | Review adjustment |
| `clarify` | A required body or next-morning response is missing | Complete check-in |
| `refresh` | Data is stale, mismatched or unsafe | Refresh data |
| `reflect` | Today's completed workout needs a short useful response | Complete feedback |
| `completed` | Today's terminal result and useful response are available | View result |
| `rest` | Today is a planned rest day | View plan context |

Priority is locked:

1. invalid/stale/revision mismatch → `refresh`;
2. medical/body-response clarification → `clarify`;
3. deterministic safe adjustment → `adjust`;
4. required next-morning response that can affect today → `clarify`;
5. today's completed workout without feedback → `reflect`;
6. terminal/rest/follow state.

Follow-up can never hide an acute safety boundary or a valid deterministic proposal.

## 7. Memory interpretation

Coach memory answers three bounded questions:

1. **What did RunnerBear recommend?** Deterministic decision type and concise explanation.
2. **What did the athlete choose?** Accepted, kept the plan, auto-applied within policy, undone or unresolved.
3. **What happened next?** Activity observed, post-workout feedback received, next-morning response received or still awaiting response.

Memory does not claim causation. Copy must say that a response was observed or taken into account, never that one intervention caused an adaptation.

The UI may show at most three recent memory rows under progressive disclosure inside the One Decision surface. It may not create a fifth tab, a timeline feed or a competing top-level card.

## 8. Follow-up experience

Post-workout follow-up:

- Trigger only for a terminal workout with no matching `feedback:workout` event.
- Reuse the existing decision-relevant feedback form and `/api/v2/feedback` route.
- Open the existing workout detail sheet and focus the first useful feedback control.
- Do not ask questions that the coach cannot use.

Next-morning follow-up:

- Trigger only for the most recent relevant workout when a post-workout response exists but a next-morning response does not.
- Reuse Body Response and `/api/v2/check-ins`.
- Link the check-in to the stable workout ID and active plan revision.
- Once stored, refresh bootstrap so the One Decision state is recalculated atomically.

Follow-up is quiet when complete. No notification badge, streak or guilt language is introduced.

## 9. Coach Live experience

Coach Live receives the same minimized `oneDecision-2` and `coachContinuity-1` objects.

The prompt contract requires Coach Live to:

- explain the current decision and confidence honestly;
- use recent memory only as observed context, never causal proof;
- request the structured follow-up when it is the missing input;
- never convert conversation text into a plan mutation;
- never claim the plan changed unless the canonical response confirms it;
- keep medical redirection and conservative uncertainty language.

The structured action above the conversation is rendered from RunnerBear data. It is never parsed from model text.

## 10. UX and information hierarchy

The Today order remains:

1. App bar and goal context.
2. One Decision hero.
3. Weekly priority and relevant plan/status feedback.
4. Compact supporting insight.
5. Sync status.

Inside the hero:

1. state label;
2. confidence language and freshness;
3. headline and concise explanation;
4. workout identity;
5. zero to three evidence items;
6. one-line coach-memory disclosure when evidence exists;
7. one filled primary action;
8. low-emphasis `Spør coach` and `Se grunnlaget` actions.

The first scan must remain calmer than v11.3. Memory detail is hidden until requested.

## 11. Design requirements

Concept 1 / Premium calm remains locked:

- warm neutral surfaces and restrained green accent;
- no new status palette, charts, scores, avatars or dashboard tiles;
- confidence appears as typography, not a colored meter;
- memory uses a quiet inset disclosure within the hero;
- at most one filled action in the hero;
- 44 CSS-pixel secondary targets and 48–50 pixel primary targets;
- short opacity/translate feedback only;
- reduced-motion preference disables non-essential motion;
- mobile safe-area and existing full-height sheet behavior are preserved.

## 12. Accessibility

- Preserve the named One Decision region and semantic heading order.
- Memory disclosure uses native `details/summary` semantics.
- Follow-up action text describes the result, not only the gesture.
- Focus moves to the first useful feedback/check-in control.
- Loading controls remain named and disabled.
- No status depends on color alone.
- Dialog Escape/backdrop behavior remains non-mutating.
- Screen-reader live regions announce only current decision and save outcomes, not every memory row.

## 13. Performance and Workers requirements

- No new browser request on first load.
- No new static asset request; v11.4 CSS is compiled into the canonical stylesheet.
- Decision and check-in history queries are bounded and executed in the existing parallel bootstrap stage.
- The continuity builder is pure, deterministic, bounded and performs no I/O.
- Worker request state remains local to the handler; no mutable module-level request state.
- Existing streaming is preserved; assistant persistence remains tracked with `ctx.waitUntil`.
- Existing service bindings, D1 binding and static-assets binding remain authoritative.
- Compatibility date remains current and Wrangler v4 is required.
- Compressed canonical assets remain below the locked 15% regression ceiling.

## 14. Privacy and observability

- Health reports `cloudBuild: 11.4.0`, `oneDecisionVersion: one-decision-2` and `coachContinuityVersion: coach-continuity-1`.
- Capability audit confirms zero AI plan writes, maximum reduction 20%, memory limit three and no raw health values.
- Logs contain version, state, confidence level and aggregate memory/follow-up status only.
- Logs never contain raw health values, feedback content, Coach Live prompts or conversation messages.
- Client telemetry records action/state IDs only.

## 15. Release gates

The release may deploy only when all gates pass:

- deterministic build and generated-bundle diff check;
- full Node suite plus v11.4 continuity contract tests;
- memory mapping for accepted, rejected, auto-applied, undone, observed and awaiting-response states;
- priority tests proving safety/adjustment outrank follow-up;
- post-workout and next-morning idempotency tests;
- One Decision v2 mismatch, expiry, proposal and 20% boundary tests;
- zero plan-write SQL in Coach Live;
- accessible memory disclosure and follow-up focus behavior;
- unchanged four-request static budget and compressed growth ceiling;
- Worker syntax, latest Wrangler v4 dry-run and config-schema validation;
- all existing D1 migrations and unchanged schema/table audit;
- production D1 backup, history preservation, stable external IDs and Tredict RPC gates;
- Access guard verification;
- production `/health` confirmation for build 11.4.0 and both new capability audits.

## 16. Explicit non-goals

- No autonomous LLM plan editing or open-ended tool calling.
- No new navigation tab, chat bubble, dashboard or health score.
- No automatic dose increase from positive recovery data.
- No new D1 table or duplicated source of truth.
- No causal performance claims from small personal samples.
- No push notification, background AI agent, voice mode or avatar.
- No redesign outside the locked Concept 1 system.
- No replacement of the Bakken engine, Body Response, weekly review or canonical sync flow.

## 17. Acceptance statement

v11.4 is accepted when the athlete can open Today and, in one scan, understand the single current recommendation, the strength of its basis and the one next action; optionally inspect what RunnerBear remembers from recent advice and response; complete a missing post-workout or next-morning follow-up through existing structured flows; and ask Coach Live for an explanation of exactly the same state — without a new request, new dashboard, contradictory advice or any AI plan-write authority.
