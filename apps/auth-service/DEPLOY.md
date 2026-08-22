# auth-service — deployment

Elysia + Better Auth API. Depends on built workspace packages in `shared/`.

## Dokploy / Railpack

| Setting | Value |
|---------|-------|
| Root directory | **`/`** (monorepo root) |
| Build type | Railpack |
| Port | `5001` |

Required env on the service:

```env
RAILPACK_CONFIG_FILE=apps/auth-service/railpack.json
NODE_ENV=production
PORT=5001
```

Or without `railpack.json`:

```env
RAILPACK_BUILD_CMD=./apps/auth-service/scripts/deploy-build.sh
RAILPACK_START_CMD=cd apps/auth-service && bun run start
```

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
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

## Troubleshooting

**`Workspace dependency "@pocket-dimension/auth" not found`**

Root directory is set to `apps/auth-service` instead of `/`. Change it to the repository root and set `RAILPACK_CONFIG_FILE=apps/auth-service/railpack.json`.

**`lockfile is frozen`**

Set `RAILPACK_INSTALL_CMD=bun install` or ensure `bun.lock` is committed and up to date.
