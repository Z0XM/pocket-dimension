# zeo — deployment

SvelteKit app (svelte-adapter-bun) with shared auth, database, utils, LiveKit, and optional music worker.

For the full Hostinger + Dokploy + LiveKit runbook, see [deploy/dokploy/README.md](./deploy/dokploy/README.md).

## Recommended: Dockerfile (Dokploy)

Same monorepo context rules as auth-service — see [DEPLOY.md](../../DEPLOY.md).

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/zeo/Dockerfile` |
| Port | `3008` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
|---------------|-------|
| Build Path | `apps/zeo` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3008` |

Start command is `bun run start` (`scripts/start.sh`), which runs migrations when `DATABASE_URL` is set, then serves the build.

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/zeo` **or** `/` |
| Build type | Railpack |
| Port | `3008` |

If root is `/`, add to Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/zeo/railpack.json
```

If root is `apps/zeo`, `railpack.json` is auto-detected.

### Application env

Copy from [`.env.example`](./.env.example) and [deploy/env/production.env.example](./deploy/env/production.env.example). Minimum:

```env
NODE_ENV=production
PORT=3008
ORIGIN=https://zeo.example.com
BODY_SIZE_LIMIT=2M
DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://zeo.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=https://zeo-livekit.example.com
PUBLIC_LIVEKIT_URL=wss://zeo-livekit.example.com
```

## Local smoke test

From monorepo root:

```bash
./apps/zeo/scripts/deploy-build.sh
cd apps/zeo && bun run start
```

Or Docker:

```bash
docker build -f apps/zeo/Dockerfile -t zeo .
docker run --rm -p 3008:3008 --env-file apps/zeo/.env zeo
```

## Troubleshooting

**`Could not resolve "../../vite-kysely-compat"`**

Stale source or cache. Redeploy with **clear build cache**. The Dockerfile fails early if `vite.config.ts` still imports `../../vite-kysely-compat`.

**`"/shared": not found` during Docker build**

Build Path is `apps/zeo` but Docker Context Path is `.`. Use Option A or set Context Path to **`/`**.

**`Workspace dependency "@pocket-dimension/db" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** (recommended), or use the updated `railpack.json`.
