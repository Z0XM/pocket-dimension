# pocket — deployment

Hub SvelteKit app (svelte-adapter-bun). Depends on `@pocket-dimension/utils` — build from monorepo root.

## Recommended: Dockerfile (Dokploy)

Same monorepo context rules as auth-service — see [DEPLOY.md](../../DEPLOY.md).

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/pocket/Dockerfile` |
| Port | `3007` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
|---------------|-------|
| Build Path | `apps/pocket` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3007` |

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/pocket` **or** `/` |
| Build type | Railpack |
| Port | `3007` |

If root is `/`, add to Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/pocket/railpack.json
```

If root is `apps/pocket`, `railpack.json` is auto-detected.

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
NODE_ENV=production
PORT=3007
HOST=0.0.0.0
ORIGIN=https://pocket.example.com
POCKET_APP_WATCHLIST_URL=https://watchlist.example.com
POCKET_APP_RHYMES_URL=https://rhymes.example.com
POCKET_APP_HOWWASYOURDAY_URL=https://howwasyourday.example.com
POCKET_APP_CHHAN_CHAN_URL=https://chhan.example.com
POCKET_APP_ME_VIA_YOU_URL=https://me-via-you.example.com
```

Only apps with a URL set appear on the hub.

## Local smoke test

From monorepo root:

```bash
./apps/pocket/scripts/deploy-build.sh
cd apps/pocket && bun run start
```

Or Docker:

```bash
docker build -f apps/pocket/Dockerfile -t pocket .
docker run --rm -p 3007:3007 --env-file apps/pocket/.env pocket
```

## Troubleshooting

**`"/shared": not found` / `"/turbo.json": not found` during Docker build**

Build Path is `apps/pocket` but Docker Context Path is `.`. Use Option A or set Context Path to **`/`**.

**`Workspace dependency "@pocket-dimension/utils" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** build (recommended), or redeploy with the updated `railpack.json` from this repo.
