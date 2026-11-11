# RunnerBear 2.0 / runtime 13.0.0

Original A / Editorial Athlete, four areas: I dag, Trening, Helse, Mål. Settings remain available through the profile button. Existing plan, history, matching, response capture and conservative plan-change boundaries are retained.

- Today uses today's actual plan or recent recorded activity. It no longer borrows the last historical plan to announce today's completion.
- Imported history-only activities share the same recorded status in week and detail views.
- Activity details display observed work segments, weighted work metrics, lap averages and missing-data explanations, including unmatched activities. FIT enrichment requires a unique date/sport/duration/distance match in both directions. A ramp test's total average power never becomes FTP.
- Health has 7/28/90-day observed trends, coverage and source notes; sleep/breathing has 7/30/90-day observations and export. Daily aggregates never imply within-night timelines, apnea counts or diagnosis.
- Direct Garmin shadow observations are a read-only display projection. No new sync owner is activated; no new AI plan or zone writes are enabled.
- Capacity is independent of race goals and separates training duration, alternate training and running distance. Precise race predictions remain unavailable pending a validated sport-specific model.

## Validation and release limits

468 unit/contract/integration tests passed locally before visual CI. Visual CI covers Chromium/WebKit, 320–430 px, dark/light, missing data, text scaling, adaptation and persistence failure. No new schema or migrations.

This is the implemented presentation and observed-evidence release, not a claim that all long-term learning milestones are complete. Still open: manual validation of 20 real cross-sport sessions, calibrated distance prediction models, personalized response learning and monthly review. Full production raw-activity extraction was denied by automatic approval review; no workaround was used. Do not enable unvalidated predictions or change Garmin shadow authority.

Raw JS budget increases to 515 kB / 145 kB gzip for the capacity/workout presentation; existing four canonical requests are retained plus the independent health extension. CSS retains at least a 20% compressed reduction versus the previous 48,084-byte baseline.

## Rollback

Previous production code: d5d89061590d7fe7c12ac8a69bb9b9c9c63d2f08 (deployment recorded in 2629d11). Revert this release commit/PR and run the existing production workflow; no database downgrade is needed. Set RUNNERBEAR_V20_EVIDENCE_DISABLED=true to disable FIT enrichment and direct Garmin health projection while retaining canonical display. Existing COACH_LOOP_KILL_SWITCH disables health insight routes and existing decision actions. Production workflow exports D1 and audits history/duplicates before deploy.

## Deployment evidence

Pending CI and production verification; update this section only after observed results.
