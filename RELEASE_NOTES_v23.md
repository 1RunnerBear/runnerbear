# RunnerBear 2.3 — runtime 13.3.0

Workout analysis now explains the recorded work, repeat consistency and an appropriate next observation. Health separates today's interpretation from the selected history window, and next-night response compares individual domains against a preceding reference without implying causality or complete recovery. Weekly learning and form dimensions make recorded training useful even while race predictions remain unvalidated.

Fixes: Health opens the actual body check without relying on a hidden Today trigger; closing or saving returns to the previous health period. Calendar weeks include today's additional activities, cover Monday–Sunday and use ISO week numbers. The Today plan link opens the current week and no longer promises a nonexistent next workout. Analysis opened from Today has one return action. Headers, profile controls and evidence typography share the approved Editorial Athlete design.

Agent reads paginate the 90-day period. Individual stored workout analyses remain accessible beyond the latest twelve, through an authenticated user-scoped detail route. Check-ins are associated with their own dates. Snapshot revisions exclude query timing metadata, and clients bound warming retries. Stored snapshots retain compact facts instead of raw work arrays. Unused old Today-card builders were removed to retain the existing compressed asset budget.

An optional fourteen-day focus supports a sleep routine or body-response check-ins. Additive migration 0019 enforces at most one active focus per user. Focus completion reports observations and limitations; it cannot mutate a plan or training zones. Existing source authority, FTP, plan policy and sync ownership remain unchanged.

Cross-workout comparisons and derived personal patterns retain RUNNERBEAR_AGENT_COMPARISONS=false until the existing real-workout validation gate is satisfied. Their implementation now separates sports, interval structure and known/unknown measurement context. No new model provider, health-data export or autonomous plan write is introduced.

Validation: unit/integration tests include response windows, reference separation, partial evidence, workload structure, subjective dates, missing context, old-activity citations, pagination, idempotency and focus persistence. Chromium/WebKit journeys cover current-week recovery, body-check opening/saving/return, period scope, mobile themes and navigation. Final CI and production results are recorded after verification.

Rollback: restore the previous compatible Worker/client or disable agent insight/background flags. Keep additive tables, all activity/check-in history and the database intact.
