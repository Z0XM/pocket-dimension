# Chhan Chhan — Beta deployment

Deploys as a Bun + SvelteKit app (svelte-adapter-bun) from the monorepo root via Railpack/Railway.

## Prerequisites

- **Root directory:** **`/`** (repository root — required for workspace deps). See [DEPLOY.md](../../DEPLOY.md).

- **PostgreSQL** — same database as auth-service (shared `@pocket-dimension/db` schema).
- **Auth service** — running at `PUBLIC_BASE_AUTH_URL` with matching `BETTER_AUTH_*` config.
- **Resend** — for verification and password-reset emails.

## Build & start (Railpack)

Set on the Chhan Chhan service:

```env
RAILPACK_CONFIG_FILE=apps/chhan-chhan/railpack.json
RAILPACK_BUILD_CMD=./apps/chhan-chhan/scripts/deploy-build.sh
RAILPACK_START_CMD=cd apps/chhan-chhan && bun run start
```

The build script installs workspace deps, builds shared packages + the app, and runs `bun db:migrate` when `DATABASE_URL` is available at build time.

## Required environment variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | Set by the platform (default adapter listens on `PORT`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `PUBLIC_BASE_AUTH_URL` | Public URL of auth-service, e.g. `https://auth.example.com` |
| `PUBLIC_BASE_AUTH_PATH` | Auth path, usually `/` |
| `BETTER_AUTH_SECRET` | Same secret as auth-service (generate with `better-auth secret`) |
| `BETTER_AUTH_URL` | Same as `PUBLIC_BASE_AUTH_URL` |
| `BETTER_AUTH_PATH` | Same as `PUBLIC_BASE_AUTH_PATH` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated origins: auth URL **and** this app URL |
| `BETTER_AUTH_COOKIE_DOMAIN` | Shared cookie domain, e.g. `.example.com` for subdomains |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `BODY_SIZE_LIMIT` | Max upload size for statement import, e.g. `10M` (default `512K` is too small for PDFs) |
| `ORIGIN` | Public app URL, e.g. `https://chhan.example.com` (required behind a reverse proxy) |

### Example (production)

```env
NODE_ENV=production
ORIGIN=https://chhan.example.com
BODY_SIZE_LIMIT=10M
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://chhan.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<generate-a-strong-secret>
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
```

## Auth-service checklist

On the auth service, add the Chhan Chhan production URL to `BETTER_AUTH_TRUSTED_ORIGINS` as well.

Cookies use `sameSite: none` + `secure: true` with cross-subdomain support — both services must be served over HTTPS.

## Health check

Configure the platform health probe to:

```
GET /health
```

Returns `{ "status": "ok" }` when the app and database are reachable.

## Local production smoke test

From monorepo root:

```bash
bun build:app:chhan-chhan
cd apps/chhan-chhan
bun run start:local   # loads .env
curl http://localhost:3005/health
```

## Post-deploy

1. Confirm `/health` returns 200.
2. Sign up / log in and verify email delivery.
3. Import a statement from Control.
4. Check session persists across refresh.

## Notes

- `static/robots.txt` blocks crawlers during beta.
- Maintenance scripts live in `apps/chhan-chhan/scripts/` — run locally against production DB only when needed.
- Excel sync (`scripts/sync-from-excel.ts`) is a local dev tool, not part of the deployed app.
