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

The private `TredictService` RPC entrypoint also exposes snapshot, planned-workout listing, structured plan creation and planned-workout date changes to RunnerBear Cloud.

Both routes require `X-RunnerBear-Key` and the expected RunnerBear browser origin.

## Cloudflare secrets

- `TREDICT_TOKEN`
- `RUNNERBEAR_BRIDGE_KEY`

Do not commit either value.

The browser never receives the Tredict token. RunnerBear Cloud reaches the bridge through a private Cloudflare service binding.
