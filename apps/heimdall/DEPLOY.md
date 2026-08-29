# heimdall — deployment

BMAD / docs War Room (Vite React SPA + Fastify API). Reads `_bmad-output` and `heimdall.config.mjs` from the monorepo root. No auth or database.

## Recommended: Dockerfile (Dokploy)

Same monorepo context rules as other apps — see [DEPLOY.md](../../DEPLOY.md).

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/heimdall/Dockerfile` |
| Port | `3012` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
|---------------|-------|
| Build Path | `apps/heimdall` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3012` |

War Room URL after deploy: `https://<host>/heimdall/` (root `/` redirects there).

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/heimdall` **or** `/` |
| Build type | Railpack |
| Port | `3012` |

If root is `/`, add to Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/heimdall/railpack.json
```

If root is `apps/heimdall`, `railpack.json` is auto-detected.

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
NODE_ENV=production
PORT=3012
HOST=0.0.0.0
HEIMDALL_REPO_ROOT=/app
```

Optional:

```env
# Override mount / public base when Traefik uses a path prefix
HEIMDALL_MOUNT_PATH=/heimdall
HEIMDALL_BASE_PATH=/heimdall
```

No `BETTER_AUTH_*`, `DATABASE_URL`, or `RESEND_API_KEY` — Heimdall is standalone docs UI.

## Local smoke test

From monorepo root:

```bash
./apps/heimdall/scripts/deploy-build.sh
cd apps/heimdall && bun run start
# open http://127.0.0.1:3012/heimdall/
```

Or Docker:

```bash
docker build -f apps/heimdall/Dockerfile -t heimdall .
docker run --rm -p 3012:3012 heimdall
```

## Troubleshooting

**`"/_bmad-output": not found` / missing `heimdall.config.mjs` during Docker build**

Build Path is `apps/heimdall` but Docker Context Path is `.`. Use Option A or set Context Path to **`/`**.

**War Room Soft-empties Features / Delivery**

Expected until BMAD Feature Registry / epic paths exist for a module. Check `bun run heimdall doctor` locally and `_bmad-output` contents in the image.

**Tests page shows runners unavailable**

Production start does not wire the dogfood Vitest runner (`runners: null`). Overview / Features / Delivery / Docs still work.
