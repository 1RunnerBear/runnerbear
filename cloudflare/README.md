# RunnerBear · Tredict Bridge

This Worker is the secure server-side bridge between the public RunnerBear GitHub Pages app and the user's private Tredict Personal API.

## Security model

- Never place a Tredict Personal API token in GitHub, HTML, JavaScript, or RunnerBear backup data.
- Configure `TREDICT_TOKEN` as an encrypted Cloudflare Worker secret.
- Configure `RUNNERBEAR_BRIDGE_KEY` as a separate long random Worker secret. This is the only credential RunnerBear enters locally on the user's device.
- `RUNNERBEAR_ORIGIN` should remain `https://1runnerbear.github.io`.
- v9.4 is intentionally read-only. Prefer a fresh Tredict Personal API token with only `activityRead` + `bodyvaluesRead` for this Worker.
- Use a separate write-capable token later if structured workout publishing is enabled.

## Worker routes

- `GET /health` — bridge health check.
- `GET /api/snapshot?days=28` — sanitized activity summaries, HRV, sleep, resting HR, running capacity and running zones.

Both routes require `X-RunnerBear-Key` and the expected RunnerBear browser origin.

## Cloudflare secrets

- `TREDICT_TOKEN`
- `RUNNERBEAR_BRIDGE_KEY`

Do not commit either value.

After deploy, open RunnerBear → Mer → Tredict · Secure Bridge and save the Worker URL plus the separate bridge key on the device. The key is stored locally and is not included in RunnerBear backup.
