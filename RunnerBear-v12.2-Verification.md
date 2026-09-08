# RunnerBear v12.2 · verification

Pre-publication verification completed 2026-09-08. Production completion must also
be established by the Cloud deploy workflow and live health check.

## Delivered

Race preparation is available from Mål. The existing Today support slot can expose
it during the final seven days, below transport issues and unread plan changes.
Preview, week, eve and race-day layouts share Concept 1. On race day, cumulative
target-time splits come first and the practical checklist is collapsed.

The view reads the canonical main goal and plan. It neither adds workouts nor
changes training authority. The five-item checklist is device-local and explicitly
excluded from compatibility upload and hydration. Shoes remain absent from settings.

## Verification evidence

- 392 automated tests passed, including 61 Race Focus cases.
- Calendar phases, configured timezone, DST, leap dates, expired decisions,
  cancelled/replaced goals, revision mismatches, pain and missing health are covered.
- A real server rest-day envelope is tested. These envelopes have no decision expiry;
  Race Focus bounds their display cache to 15 minutes and still requires fresh health.
- Target splits use 21.0975 km / 42.195 km and end at the exact target time.
- Existing build determinism, four startup requests and five ordered CSS layers remain.
- Production JavaScript totals 464,310 bytes, below the locked 466,000-byte limit.
- CSS gzip (level 9): 35,394 bytes, 26.4% below the pre-v12.1 48,084-byte baseline.
- All current release JavaScript sources pass syntax checks; no whitespace errors.

## Browser evidence

Read-only local canonical fixtures were used; no production health or plan state was
modified by browser QA.

- Preview, week, eve and race-day content inspected; base mode has no race entry.
- Race sheet checked at 320, 375, 390 and 430 px and desktop 1180 px; no horizontal overflow.
- 200% text simulation at 320 px passed for race-day splits and the blocked-health checklist.
  This is a browser font-size simulation, not a native iOS Dynamic Type test.
- Checkbox state and expanded details survived a background rerender; focus returned
  to the opener on Escape. Week-plan navigation closed the sheet and opened Plan.
- Pain and stale-health scenarios suppressed Today's race entry and target pace while
  preserving practical preparation. The health link focused the daily coach action.
- Keyboard QA found and fixed a pre-existing focus-trap issue: controls inside closed
  native details must be excluded explicitly. Shift+Tab and Tab now wrap correctly.

## Before-deploy baseline

Live build 12.1.0; history integrity true; duplicate external activity IDs zero;
queued, retryable, processing and review-required sync operations all zero.
One canonical plan `rb-plan-primary`, revision
`pr_5ac701c7-9d6d-4d28-910e-1f7367c8dc31`, end date 2026-10-03,
14-day execution window, reconciliation confirmed, access protection configured.

The implementation introduces no database migrations or training-engine changes.
Release publication uses the existing backup, history and deployment health gates.
