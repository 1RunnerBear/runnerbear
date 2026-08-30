# RunnerBear v11.6 — Contextual Coach

Status: LOCKED  
Release: 11.6.0  
Design source of truth: Design Direction 1.0 / Concept 1 / Premium rolig

## Product outcome

RunnerBear shall feel simpler, smarter and calmer: a highly attentive coach follows the athlete in the background and speaks only where a recommendation changes understanding or action. The general Coach Live chat is removed from the product. The Bakken engine, Body Response Engine and canonical plan remain the only authorities for training and dose.

## A. Top 10 problems — ranked by user impact

1. **Two competing coach experiences.** One Decision and Coach Live can answer the same question with different wording, hierarchy and freshness.
2. **Chat is a destination rather than useful coaching in context.** It asks the athlete to formulate questions the product can already answer from plan, health and training data.
3. **Today hides the health interpretation when canonical One Decision is active.** The recommendation is visible, but the body trend is not easy to scan.
4. **The primary action is diluted.** “Ask coach”, “See basis”, workout access and decision actions compete inside the most important surface.
5. **Coach language is inconsistent.** One Decision, Coach Live, workout key advice, plan-change notices and weekly review use different labels for the same role.
6. **Workout details repeat generic advice.** Pre-workout advice, after-workout interpretation and plan consequence are not clearly separated.
7. **Plan contains multiple lenses before the selected day.** Week, Focus, Long-term, month and overview are useful, but their hierarchy makes the normal weekly task feel heavier than necessary.
8. **More mixes insight and administration.** Training insight, data transport, automation, shoes and product information compete in one long screen.
9. **Legacy presentation layers still leak through.** The canonical bundle composes many historical CSS sources, increasing override risk and visual inconsistency.
10. **Release gates reward the chat implementation.** Production health currently requires Coach Live inference and database tables instead of proving that chat is unavailable and contextual coaching is authoritative.

## B. Information architecture

The four-tab navigation remains:

| Destination | Primary purpose | Content |
| --- | --- | --- |
| **I dag** | Decide and act now | One coach recommendation, today’s workout/result, compact body trend, weekly priority, previous-week review when ready |
| **Plan** | Understand and manage training | Week first, selected day, calendar on demand, changed-plan explanation, Focus and Long-term as secondary lenses, completed sessions |
| **Mål** | Understand progress and direction | A-goal, B-races, evidence-based direction, next milestone, forecast details on demand |
| **Mer** | Inspect and configure | Training insights, profile, data sources/sync, automation authority, shoes, coach log, product information |

Health is not a fifth destination. A compact contextual state lives on Today and opens the full trend/basis sheet. Post-workout coaching lives with the completed workout. Focus remains a secondary Plan lens, not navigation.

## C. Contextual Coach system

### One authority

All surfaces consume one server-authored, versioned `contextualCoach` envelope tied to `planRevisionId`. It may summarize only already-authoritative outputs: `oneDecision`, `bodyResponse`, `coachBrief`, `weeklyReview`, workout assessment and goal confidence. It cannot invent or write a plan.

### Display contract

| Surface | Show when | Maximum | Silent when |
| --- | --- | --- | --- |
| Today | Always when a current decision exists | One headline, one short reason, one primary action | Never add a second coach card |
| Body/Form | A trend or missing data affects confidence | One state, one reason, one consequence | Metrics are normal and already explained by Today |
| Workout before | A key execution cue adds value | One cue | Generic text would repeat the prescription |
| Workout after | A verified activity is matched | Verdict + consequence for the week | Analysis is not reliable enough; show “building basis” instead |
| Plan | A workout changed, moved or needs attention | One inline explanation on the affected item | Active plan is unchanged |
| Weekly review | Review is ready | What went well + max two priorities | Review is not yet complete |
| Goal | Direction or evidence meaningfully changed | One direction statement | No new evidence since the prior revision |

### Copy rules

- Bokmål, calm and concrete.
- One recommendation per surface.
- Headline ideally under 55 characters; explanation under 180 characters.
- Explain “why” only when a decision, confidence or plan changes.
- No diagnosis, certainty theatre, motivational filler or duplicated raw metrics.
- The coach must never contradict the current Bakken workout, Body Response dose or canonical plan revision.

## D. Screen improvements

### Today

- Rename “One Decision” to “Coachens råd”.
- Keep exactly one primary action.
- Remove every “Ask coach” action and all chat launch points.
- Add one compact body-trend row linked to the existing detailed health sheet.
- Keep weekly priority; show previous-week review only when ready.
- Treat sync as a quiet status line unless action is required.

### Workout detail and post-workout

- Use “Before workout” and “After workout” semantics.
- Before: prescription, intensity, one execution cue, practical information.
- After: verified metrics, concise assessment, consequence for the rest of the week, then optional analysis details.
- Remove chat entry. Keep feedback questions only when the closed loop needs an answer.

### Plan / calendar / Focus

- Week remains default.
- Month opens on demand and returns to the same selected day.
- Focus and Long-term remain secondary lenses.
- Changed workouts receive one compact “Changed — why” explanation; unchanged rows receive no coach copy.
- Sync repair appears only when user action is needed.

### Body/Form

- Trend over one measurement.
- Show current, personal normal, seven-day and 28-day context in the existing detailed sheet.
- No Coach Live button.
- Health advice changes dose, not training method.

### Goals

- Keep A-goal and B-races.
- Keep evidence gates and confidence disclosure.
- Lead with one direction; estimates stay secondary and evidence-gated.
- No generic coach commentary without new evidence.

### More

- Keep insight groups above tools.
- Data sources and sync remain one setting.
- Plan authority is explicit: observe, suggest or safe autopilot.
- Coach log is history, not a conversation.
- Product info describes Contextual Coach, not Coach Live.

### States and responsive behavior

- Loading state states what is being verified; it never shows an empty card.
- Empty state explains what will populate it and the next automatic event.
- Error state preserves last known plan and offers one recovery action.
- All touch targets are at least 44 px; dialogs trap focus, close with Escape and respect safe areas.
- Mobile uses one column, no horizontal content dependency and no chat-height workspace.

## E. Remove / keep / improve

| Feature | Decision | v11.6 treatment |
| --- | --- | --- |
| Coach Live chat, composer, starters, threads and routes | **Remove** | No UI entry; endpoints return `410 Gone`; AI binding removed; historical tables retained only for non-destructive rollback/history |
| One Decision | **Improve** | Becomes canonical “Coachens råd” surface |
| Body Response | **Keep + improve** | Compact Today trend + detailed sheet |
| Workout coach assessment | **Improve** | Clear pre/post distinction and week consequence |
| Weekly review | **Keep** | One short summary + max two next priorities |
| Plan-change explanation | **Keep + improve** | Inline only on affected workout |
| Focus | **Merge** | Secondary Plan lens |
| Long-term plan | **Keep secondary** | Plan lens; goal evidence remains in Mål |
| Manual sync button | **Make secondary** | Automatic by default; manual recovery only when stale/error |
| Coach log | **Keep secondary** | Audit trail under More |
| Generic progress percentages/fake readiness scores | **Remove/avoid** | Evidence and explicit confidence only |

## F. Premium UX standard

1. One screen, one primary job and no more than one primary action per decision surface.
2. Progressive disclosure: decision first, reason second, raw detail last.
3. One vocabulary for recommendation, status, confidence, plan change and sync.
4. One canonical component contract for card, sheet, dialog, empty, loading and error states.
5. Four navigation destinations only.
6. 8 px spacing rhythm; 16 px minimum mobile gutter; 44 px controls; safe-area aware fixed elements.
7. Text hierarchy must survive at 320 px and 200% text zoom.
8. Normal is quiet; attention is visible; action is unmistakable. Color is never the only signal.
9. No optimistic sync claims. “Confirmed” requires a confirmed external identity.
10. No new UI feature ships without mobile, keyboard, empty, loading, error and stale-data states.
11. No coach copy ships without source, freshness and plan-revision consistency.
12. No AI-generated text may mutate or overrule the plan engine.

## G. Release plan

Ship as one **v11.6.0** release. The product change is coherent and technically bounded because the existing One Decision, Body Response, weekly review and post-workout engines already exist. Splitting removal and contextual replacement would create an avoidable period with either duplicate coaching or missing coaching.

Rollback is the prior v11.5 Worker and static bundle. Database tables are not dropped, so rollback remains non-destructive.

## Technical scope

- Add `index-v116.js` and `v116/contextual-coach.js`.
- Add a versioned, deterministic `contextualCoach` bootstrap envelope tied to `planRevisionId`.
- Intercept all `/api/v2/coach-live*` routes with `410 Gone`.
- Remove Cloudflare AI binding and Coach Live runtime variables.
- Remove all chat code, state, event bindings, markup and styles from the canonical frontend.
- Replace v11.5 chat styling with a smaller v11.6 contextual-coach/unified-surface stylesheet.
- Preserve Coach Live database tables; do not read or write them in normal runtime.
- Update version metadata, cache key, build scripts and production health gates.

## Acceptance criteria

1. No visible “Coach Live”, “Ask coach”, chat composer, starter prompt or chat modal exists in canonical assets.
2. `/api/v2/coach-live` and descendants return `410`, never inference or conversation data.
3. Health reports build `11.6.0`, `contextualCoachVersion=contextual-coach-1`, `coachLive=false`, `coachLiveRoutes=false`, `planWritesByAi=false`, four navigation tabs and 20% maximum reduction.
4. Bootstrap contains a `contextualCoach` envelope matching the active `planRevisionId`.
5. Today shows one coach recommendation and one primary action.
6. Today exposes a compact body trend and the existing detailed trend sheet.
7. Completed workouts show a concise verdict and consequence for the remaining week.
8. Plan explanations render only for changed/attention items.
9. Weekly review exposes total volume, quality, long run, what went well and no more than two next priorities.
10. Goal feedback is evidence-gated and silent without meaningful new evidence.
11. Existing canonical writes, undo, sync, history, goal guard and Bakken safety tests remain green.
12. Four-request asset architecture and compressed-size budget remain green.

## Test plan

- Unit: contextual envelope per surface, silence rules, copy limits, revision match, no plan writes.
- Route: every former Coach Live route returns 410; no AI binding required.
- Contract: no chat strings/selectors/functions in canonical UI; contextual components present.
- Regression: Bakken plan generation, Body Response, One Decision, feedback loop, history, goal guard, Tredict idempotency and undo.
- Accessibility: dialog labels/focus/Escape, 44 px controls, reduced motion, semantic live regions.
- Responsive: 320, 375, 390, 430, 768 and desktop widths; safe-area and 200% text checks.
- Performance: four initial requests, no chat bundle/runtime, canonical compressed budget not increased.
- Production smoke: `/health`, authenticated app shell, Today, Plan, selected day, completed workout, Goals, More, sync status and stale/error fallback.

## Production criteria

- Clean `npm run check`.
- No destructive migration.
- Pre-deploy D1 backup and post-deploy history count/duplicate audit pass.
- Production health and app smoke pass on build `11.6.0`.
- Coach Live 410 smoke passes.
- Contextual Coach bootstrap gate passes with the current plan revision.
- Sync outbox has no queued, retryable or processing residue after rollout.

