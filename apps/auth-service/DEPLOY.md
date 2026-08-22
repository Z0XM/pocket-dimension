# auth-service — deployment

Elysia + Better Auth API. Depends on built workspace packages in `shared/`.

## Recommended: Dockerfile (Dokploy)

The Dockerfile copies `shared/`, `package.json`, etc. from the **repository root**. In Dokploy, **Docker Context Path `.` is relative to Build Path**, not the git repo — so `.` only works when Build Path is also the repo root.

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** (repo root — leave empty if that means root) |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/auth-service/Dockerfile` |
| Port | `5001` |

Equivalent local command:

```bash
docker build -f apps/auth-service/Dockerfile -t auth-service .
#                                                          ^ context = repo root
```

### Option B (app folder as Build Path)

Use this if Build Path must stay `apps/auth-service`:

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | `apps/auth-service` |
| **Docker Context Path** | **`/`** (repo root — **not** `.`) |
| **Dockerfile Path** | `Dockerfile` |
| Port | `5001` |

No `RAILPACK_*` env vars needed.

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/auth-service` **or** `/` |
| Build type | Railpack |
| Port | `5001` |

If root is `/`, add to Dokploy **Environment** (required — not read from `.env.example`):

```env
RAILPACK_CONFIG_FILE=apps/auth-service/railpack.json
```

If root is `apps/auth-service`, `railpack.json` is auto-detected.

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<same secret as all frontend apps>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://watchlist.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
```

Add every frontend origin to `BETTER_AUTH_TRUSTED_ORIGINS`.

## Local smoke test

From monorepo root:

```bash
./apps/auth-service/scripts/deploy-build.sh
cd apps/auth-service && bun run start
curl http://localhost:5001/health
```

Or Docker:

```bash
docker build -f apps/auth-service/Dockerfile -t auth-service .
docker run --rm -p 5001:5001 --env-file apps/auth-service/.env auth-service
```

## Troubleshooting

**`"/shared": not found` / `"/turbo.json": not found` during Docker build**

Build Path is `apps/auth-service` but Docker Context Path is `.` — so Docker only sees the app folder. Fix with **Option A** (Build Path `/`, Context `.`) or **Option B** (Build Path `apps/auth-service`, Context **`/`**).

**`Workspace dependency "@pocket-dimension/auth" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** build (recommended), or redeploy with the updated `railpack.json` from this repo.

**`lockfile is frozen`**

Ensure `bun.lock` is committed, or set `RAILPACK_INSTALL_CMD=bun install`.
