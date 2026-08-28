# RunnerBear 11.2.0 — Coach Live

Released 2026-08-28.

## New

- Coach Live on Today with contextual entry points from workout detail and Body Response.
- Streamed Norwegian coaching for workout execution, shoes, ordinary training nutrition, sleep, recovery, progression and tapering.
- Canonical plan, current workout, minimized Body Response context and active shoe data are supplied to each answer.
- Private D1-backed threads, immutable turns and inference provenance.
- Deterministic emergency boundary and conservative health/plan prompt contract.

## Safety and scope

- Coach Live cannot change, publish or sync the canonical plan.
- Plan changes remain exclusively controlled by the deterministic RunnerBear coach and explicit plan actions.
- No diagnosis, treatment, medication or supplement dosing.
- Twelve-message rolling rate limit and bounded input/context sizes.

## Operations

- Cloudflare Workers AI binding with `@cf/zai-org/glm-4.7-flash`.
- Additive schema version 4 with three Coach Live tables.
- Production health gate preserves all Body Response, Bakken, history, sync and Access checks.

