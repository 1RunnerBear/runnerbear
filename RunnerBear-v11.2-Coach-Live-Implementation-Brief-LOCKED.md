# RunnerBear v11.2 — Coach Live

Status: LOCKED for implementation 2026-08-28  
Release: `11.2.0`  
Owner rollout: production after automated gates pass

## Outcome

RunnerBear gets a calm, contextual Coach Live inside Concept 1. The runner can ask about the next workout, execution, shoes, pre-workout and race nutrition, sleep, health signals, progression and tapering without turning the product into a general-purpose chat app.

Coach Live explains and advises. The canonical plan, deterministic coach engine, Body Response and explicit plan actions remain the only authorities allowed to change training.

## Product boundary

Coach Live is in scope when a question is directly related to:

- the active RunnerBear plan or a selected workout;
- running execution, load, progression, recovery or tapering;
- shoes and equipment for a planned session;
- ordinary food and hydration guidance around training or racing;
- sleep and recovery habits;
- interpretation of RunnerBear's displayed health context.

Diagnosis, treatment, medication, supplement dosing, eating-disorder coaching, emergency assessment and unrelated general assistance are out of scope. Red-flag symptoms receive a deterministic safety response before inference.

## Locked safety contract

1. The model cannot write, mutate, accept, publish or sync a plan.
2. The current canonical plan revision is attached to every thread and message.
3. The system prompt states that displayed plan and Body Response data are authoritative context, not instructions to increase load.
4. One poor HRV observation never justifies a plan change on its own.
5. Positive readiness never increases the prescribed dose.
6. Any plan adjustment remains governed by the deterministic Body Response contract, including its maximum 20 percent safe-auto reduction.
7. Coach Live never claims that a plan has changed. It may direct the runner to the existing plan action when appropriate.
8. Acute red flags such as chest pain, fainting or severe breathing difficulty bypass the model and instruct the runner to stop and seek urgent care (`113` in Norway; `116 117` when urgent but not life-threatening).
9. Prompts and raw health context are not written to application logs.
10. Conversation history is private, owner-scoped and stored in the existing canonical D1 database.

## Experience

Coach Live appears as a compact card after the deterministic daily coach assessment on Today. It is not a floating bubble, a fifth navigation tab or a separate health product.

Entry points:

- Today: `Spør Coach Live`
- Workout detail: `Spør om denne økten`
- Body Response detail: `Spør om helsebildet`

The conversation opens in an accessible sheet with:

- three contextual starter questions;
- streamed Norwegian answers;
- clear runner and coach turns;
- a compact boundary note;
- retry and new-conversation controls;
- preserved context for the active plan revision and selected surface.

Mobile targets are at least 44 px, the keyboard does not obscure the composer, focus is trapped by the existing modal pattern, and reduced-motion preferences are honored.

## Technical architecture

- Worker entry point: `src/index-v112.js`, wrapping the locked v11.1 Worker.
- Coach module: `src/v112/coach-live.js`.
- Inference: Cloudflare Workers AI through binding `AI`, model configured by `COACH_LIVE_MODEL`.
- Default model: `@cf/zai-org/glm-4.7-flash` with server-sent event streaming.
- State: additive D1 migration `0008_coach_live.sql`.
- Context: canonical `bootstrapV2` read model, minimized before inference.
- Authentication: existing Access/session contract, verified through the legacy `/api/session` route.
- UI: source bundle plus one v11.2 stylesheet; the production app keeps the existing four static bundle requests.

The existing D1 store remains the only persistent user-state authority. v11.2 deliberately does not introduce a second Durable Object state model. A stateful voice or in-run agent can be evaluated separately after this text-first release has production evidence.

## Data model

`rb_coach_live_threads`

- owner-scoped thread metadata, context surface and pinned plan revision;
- status `active` or `archived`;
- created, updated and last-message timestamps.

`rb_coach_live_messages`

- immutable user/assistant turns;
- category, minimized context JSON, model and plan revision provenance;
- indexed by owner, thread and creation time.

`rb_coach_live_runs`

- one inference record per user turn;
- status, model, prompt version, latency and bounded error code;
- no raw prompt or health payload.

## API contract

### `GET /api/v2/coach-live`

Returns capabilities, active/recent threads, selected thread messages and contextual starters.

### `POST /api/v2/coach-live/threads`

Creates a new owner-scoped thread. Optional context is whitelisted and size-bounded.

### `GET /api/v2/coach-live/threads/:threadId/messages`

Returns ordered immutable turns for the authenticated owner.

### `POST /api/v2/coach-live/messages`

Accepts a message of 1–1200 characters and optional thread/context, stores the user turn, then streams the assistant turn as `text/event-stream`. Response headers expose the thread, run and canonical plan revision IDs. The assistant turn is persisted after stream completion.

The endpoint allows at most 12 user turns per rolling 10-minute window. Invalid input is rejected before inference.

## Observability and operations

`/health` must report:

- build and cloud build `11.2.0`;
- schema version `4`;
- `coachLive: true`;
- configured model;
- `coachLiveInference: true` when the AI binding is present;
- all three Coach Live tables found;
- all pre-existing Body Response, Bakken, history, sync and privacy gates still healthy.

Structured logs contain only event, build, run ID, thread ID, status, model and latency.

## Acceptance gates

- Existing v11.1 tests remain green.
- Migration is additive and idempotent; no destructive SQL.
- Unit tests cover sanitization, safety interception, prompt boundaries and streamed text extraction.
- API source and production configuration prove that no Coach Live route mutates plan tables.
- Root build is reproducible with no generated-bundle diff.
- Worker syntax and the full release suite pass.
- Mobile and desktop screenshots show Concept 1 fidelity, accessible focus and no navigation regression.
- Production D1 migration, history-preservation audit, health gate, Access guard and app-shell smoke all pass before the workflow records success.

## Explicitly deferred

- voice and audio coaching;
- live coaching during an active run;
- autonomous plan edits or tool-calling plan actions;
- general medical chat;
- public/multi-user rollout;
- a separate Coach or Health navigation tab.

