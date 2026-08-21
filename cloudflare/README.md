# RunnerBear · Tredict Bridge

This Worker is the secure server-side bridge between RunnerBear Cloud and the user's private Tredict Personal API. Tredict transports scheduled RunnerBear workouts onward to Garmin.

## Security model

- Never place a Tredict Personal API token in GitHub, HTML, JavaScript, or RunnerBear backup data.
- Configure `TREDICT_TOKEN` as an encrypted Cloudflare Worker secret.
- Configure `RUNNERBEAR_BRIDGE_KEY` as a separate long random Worker secret for the legacy migration relay.
- `RUNNERBEAR_ORIGIN` should remain `https://1runnerbear.github.io`.
- Use a dedicated Tredict Personal API token with `activityRead`, `bodyvaluesRead` and `activityWrite`.
- RunnerBear creates reusable plans, reads planned workouts and changes scheduled dates through the private Worker service binding. Unsupported destructive calendar operations are surfaced as review-required instead of guessed.

## Worker routes

- `GET /health` — bridge health check.
- `GET /api/snapshot?days=28` — sanitized activity summaries, HRV, sleep, resting HR, running capacity and running zones.

The private `TredictService` RPC entrypoint also exposes snapshot, planned-workout listing, structured plan creation, planned-workout date changes and `reconcileCanonical(operation)` to RunnerBear Cloud. Canonical operations require a stable RunnerBear workout ID and idempotency key.

## Canonical operation states

- `confirmed` — the stable RunnerBear marker exists, or a move was confirmed with a Tredict workout ID.
- `review_required` — create/activation, replace or cancel cannot be proven safe; no destructive guess is made.
- `failed_retryable` — transient transport failure; RunnerBear Cloud schedules bounded retry.
- `failed_terminal` — invalid operation.
- `superseded` — a newer plan revision owns the workout.

Create and update first search the calendar marker, making retries idempotent. Move preserves the stable marker and external identity. Structural replace/cancel remains review-required until Tredict exposes a safe atomic operation.

Both routes require `X-RunnerBear-Key` and the expected RunnerBear browser origin.

## Cloudflare secrets

- `TREDICT_TOKEN`
- `RUNNERBEAR_BRIDGE_KEY`

Do not commit either value.

The browser never receives the Tredict token. RunnerBear Cloud reaches the bridge through a private Cloudflare service binding.
