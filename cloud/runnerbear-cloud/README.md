# RunnerBear Cloud v9.8

Job 1 in the RunnerBear cloud migration: central server state and a single bootstrap API.

## Scope

This Worker intentionally does **not** implement end-user login yet. Until v9.8.1, every `/api/*` route is protected by a `RUNNERBEAR_API_KEY` Worker secret using a timing-safe comparison. `/health` is public.

D1 is designed to become the source of truth for:

- generic RunnerBear state/profile/settings
- plan days
- completed activities
- daily recovery/health data
- capacity samples
- shoes
- source sync status

Browser `localStorage` remains untouched by this job and is not migrated yet.

## API contract

- `GET /health`
- `GET /api/bootstrap?days=120`
- `PUT /api/state/:namespace`
- `PUT /api/plan`
- `PUT /api/activities`
- `PUT /api/health`
- `PUT /api/capacity`
- `PUT /api/shoes`
- `PUT /api/sync-status`

All protected routes require `X-RunnerBear-Key` until Cloudflare Access replaces this in job 2.

## Bootstrap response

`/api/bootstrap` returns one bounded payload containing the central RunnerBear state, plan, recent activities, recent health, capacity, shoes and sync status. The caller may request 7–365 days of activity/health history; the default is 120 days.

## Provision and deploy

Wrangler 4.45+ supports automatic resource provisioning. The D1 binding therefore contains only `binding: "DB"`; the first authenticated deploy can create and attach the D1 resource automatically.

1. Install dependencies: `npm install`.
2. First deploy/provision: `npm run deploy`.
3. Apply schema: `npm run db:migrate:remote`.
4. Verify the schema: `npm run db:smoke:remote`.
5. When a temporary API-key client is needed, set it with `npx wrangler secret put RUNNERBEAR_API_KEY`. Job 2 is intended to replace this with Cloudflare Access.
6. Before the browser client is switched over, set `CORS_ORIGINS` to the exact RunnerBear frontend origin.

A manual GitHub Actions deployment workflow is included at `.github/workflows/runnerbear-cloud-deploy.yml`. It expects GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Design notes

- D1 is accessed through the Worker binding (`env.DB`), not the Cloudflare REST API.
- Writes use prepared statements and D1 batch calls.
- Request bodies are read with an explicit 2 MB ceiling.
- API secrets are never committed; secret comparison uses SHA-256 plus `crypto.subtle.timingSafeEqual`.
- The schema is already user-scoped (`user_id`) so the authentication layer can map a signed-in identity without a database redesign.
- The frontend is deliberately not switched to cloud state in this job. That avoids a half-migrated state before login and migration are approved.

## Next jobs — not included here

- v9.8.1: Cloudflare Access / cross-device login and session identity.
- v9.8.2: one-time migration of existing local RunnerBear state and API cache into D1, then switch the frontend to D1 as source of truth.
