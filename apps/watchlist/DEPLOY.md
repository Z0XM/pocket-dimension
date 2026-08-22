# watchlist — deployment

SvelteKit app (svelte-adapter-bun) with shared auth and database packages.

## Recommended: Dockerfile (Dokploy)

Most reliable — does not depend on Railpack root-directory settings.

| Setting | Value |
|---------|-------|
| Build type | **Dockerfile** |
| Dockerfile path | `apps/watchlist/Dockerfile` |
| Build context | **`/`** (repo root) |
| Port | `3002` |

No `RAILPACK_*` env vars needed.

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/watchlist` **or** `/` |
| Build type | Railpack |
| Port | `3002` |

If root is `/`, add to Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/watchlist/railpack.json
```

If root is `apps/watchlist`, `railpack.json` is auto-detected.

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
NODE_ENV=production
ORIGIN=https://watchlist.example.com
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
```

Both services must be served over HTTPS for session cookies (`sameSite: none`, `secure: true`).

## Local smoke test

From monorepo root:

```bash
./apps/watchlist/scripts/deploy-build.sh
cd apps/watchlist && bun run start
```

Or Docker:

```bash
docker build -f apps/watchlist/Dockerfile -t watchlist .
docker run --rm -p 3002:3002 --env-file apps/watchlist/.env watchlist
```

## Troubleshooting

**`Workspace dependency "@pocket-dimension/db" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** build (recommended), or redeploy with the updated `railpack.json` from this repo.

**`lockfile is frozen`**

Ensure `bun.lock` is committed, or set `RAILPACK_INSTALL_CMD=bun install`.
