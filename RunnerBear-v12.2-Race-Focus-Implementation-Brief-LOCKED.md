# RunnerBear v12.2 · Race Focus

Status: implementation scope locked, 2026-09-08. Continues v12.1 Calm Flow and Concept 1.

## User outcome

One place to prepare for the main race, without another training plan or another tab.
Mål offers a preparation sheet before race week. In the last seven days, the existing
single support slot on I dag can offer the same sheet. Transport problems and unread
plan changes retain priority. The daily coach decision and health check remain primary.

## Included

- Calendar-aware preview, race-week, eve and race-day presentation in the configured timezone.
- Main-goal identity must agree with the canonical snapshot. Past, cancelled, paused and
  replaced goals cannot activate race mode. No secondary-race promotion.
- Remaining loaded canonical sessions in the final week; missing sessions are never invented.
- A target-time calculator with pace and cumulative split times. Explicitly a mathematical
  reference, not a forecast, readiness assessment or changed prescription.
- Target reference is hidden when today's health/decision is stale, unverified or needs attention.
- Five practical checkboxes remembered only on this device, isolated by goal identity and date.
  Target-time edits and plan revisions do not reset them. Storage failures are shown honestly.
- Accessible sheet, keyboard focus/return, native disclosures, large-text and narrow-screen QA.

## Not included

No plan-engine changes, training additions, auto-taper, nutrition dosing, start-time assumptions,
weather integrations, shoe administration, database migrations, new sync capabilities or
changes to coach authority. No race-day advice should imply medical clearance.

## Production gates

Pure-model tests cover timezone/day boundaries, DST, leap dates, expiry, invalid data, goal
replacement, safety precedence, exact finish times, checkbox isolation and storage failure.
All prior tests and deterministic asset checks pass. Five CSS layers and the existing
compressed-asset budget are preserved. Browser QA includes all phases, blocked safety states,
320–430 px mobile, desktop, keyboard, rerender and 200% text simulation.
Publish using the existing GitHub/Cloudflare pipeline, including its backup and history guards.
Verify build 12.2.0, access protection, history integrity, canonical plan identity, mirror
consistency and drained sync queues before declaring production complete.
