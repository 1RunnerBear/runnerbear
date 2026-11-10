# RunnerBear Cloud 12.6.1 — Health data foundation

This release adds an additive D1 model for daily SpO₂ average/minimum, overnight respiration average, sleep score, source, and overall data quality. Existing HRV, sleep duration, and resting heart rate storage remains intact.

Two authenticated, read-only endpoints are added:

- `GET /api/v2/health/trends?window=7d|28d|90d`
- `GET /api/v2/health/sleep-breathing?window=28d|90d`

Summaries expose sample coverage and distinguish missing data from recorded values. SpO₂ minima are counted as recorded low-minimum nights only; no timeline duration, AHI, ODI, apnea count, diagnosis, probability, or sleep-apnea score is inferred. The required clinician guidance is included in the sleep/breathing response.

The existing scheduled source remains Tredict. No Garmin Personal API key or direct Garmin adapter is configured in production, so the new fields remain empty unless a supported source provides them. New UI, Garmin ingestion, and coach-plan effects are not enabled by this cloud foundation release.

## Verification

Unit and route tests cover bounded windows, field validation, sample coverage, missing-data handling, kill-switch behavior, and diagnostic-language exclusions. Production verification must confirm migration 0011 and `/health` after deployment.
