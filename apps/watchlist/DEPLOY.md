# watchlist — deployment

SvelteKit app (svelte-adapter-bun) with shared auth and database packages.

## Dokploy / Railpack

| Setting | Value |
|---------|-------|
| Root directory | **`/`** (monorepo root) |
| Build type | Railpack |
| Port | `3002` |

Required env on the service:

```env
RAILPACK_CONFIG_FILE=apps/watchlist/railpack.json
NODE_ENV=production
ORIGIN=https://watchlist.example.com
```

Or without `railpack.json`:

```env
RAILPACK_BUILD_CMD=./apps/watchlist/scripts/deploy-build.sh
RAILPACK_START_CMD=cd apps/watchlist && bun run start
```

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://watchlist.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
ORIGIN=https://watchlist.example.com
```

Both services must be served over HTTPS for session cookies (`sameSite: none`, `secure: true`).

## Local smoke test

From monorepo root:

```bash
./apps/watchlist/scripts/deploy-build.sh
cd apps/watchlist && bun run start
```

## Troubleshooting

**`Workspace dependency "@pocket-dimension/db" not found`**

Root directory is set to `apps/watchlist` instead of `/`. Change it to the repository root and set `RAILPACK_CONFIG_FILE=apps/watchlist/railpack.json`.

**`lockfile is frozen`**

Set `RAILPACK_INSTALL_CMD=bun install` or ensure `bun.lock` is committed and up to date.
