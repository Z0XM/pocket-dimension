# auth-service — deployment

Elysia + Better Auth API. Depends on built workspace packages in `shared/`.

## Recommended: Dockerfile (Dokploy)

Most reliable — does not depend on Railpack root-directory settings.

| Setting | Value |
|---------|-------|
| Build type | **Dockerfile** |
| Dockerfile path | `apps/auth-service/Dockerfile` |
| Build context | **`/`** (repo root) |
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

**`Workspace dependency "@pocket-dimension/auth" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** build (recommended), or redeploy with the updated `railpack.json` from this repo.

**`lockfile is frozen`**

Ensure `bun.lock` is committed, or set `RAILPACK_INSTALL_CMD=bun install`.
