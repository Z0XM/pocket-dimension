# Deploying Pocket Dimension (monorepo)

Apps that depend on `@pocket-dimension/auth`, `@pocket-dimension/db`, or `@pocket-dimension/utils` **must include the full monorepo** at build time. If Railpack runs `bun install` inside `apps/<app>` only, the build fails with:

```text
error: Workspace dependency "@pocket-dimension/auth" not found
Searched in "./*"
```

## Recommended: Dockerfile (Dokploy)

Works regardless of the Railpack “root directory” setting. Use for **auth-service** and **watchlist** if Railpack keeps failing.

| App | Dockerfile | Build context | Port |
|-----|------------|---------------|------|
| auth-service | `apps/auth-service/Dockerfile` | `/` (repo root) | 5001 |
| watchlist | `apps/watchlist/Dockerfile` | `/` (repo root) | 3002 |
| zeo | `apps/zeo/Dockerfile` | `/` (repo root) | 3008 |
| zeo-music-worker | `apps/zeo-music-worker/Dockerfile` | `/` (repo root) | 3010 |

Dokploy settings:

1. **Build type:** Dockerfile (not Railpack)
2. **Dockerfile path:** `apps/<app>/Dockerfile`
3. **Build context:** `/` (repository root)

## Alternative: Railpack

Railpack auto-runs `bun install` before custom build scripts. Each app’s `railpack.json` skips that step (`install: true`) and runs `scripts/deploy-build.sh` instead, which installs from the monorepo root.

| Setting | Value |
|---------|-------|
| **Root directory** | `apps/<app>` **or** `/` — both work with updated `railpack.json` |
| **Build type** | Railpack |

If root directory is `/`, set in Dokploy env (not just `.env.example`):

```env
RAILPACK_CONFIG_FILE=apps/auth-service/railpack.json
```

If root directory is `apps/auth-service`, `railpack.json` is picked up automatically — no `RAILPACK_CONFIG_FILE` needed.

**Important:** env vars in `.env.example` are not loaded by Dokploy. Copy them into the Dokploy service **Environment** panel.

## Per-app guides

| App | Port | Details |
|-----|------|---------|
| auth-service | 5001 | [apps/auth-service/DEPLOY.md](./apps/auth-service/DEPLOY.md) |
| watchlist | 3002 | [apps/watchlist/DEPLOY.md](./apps/watchlist/DEPLOY.md) |
| chhan-chhan | 3005 | [apps/chhan-chhan/DEPLOY.md](./apps/chhan-chhan/DEPLOY.md) |
| zeo | 3008 | [apps/zeo/deploy/dokploy/README.md](./apps/zeo/deploy/dokploy/README.md) |
| markitdown | 3006 | [apps/markitdown/railpack.json](./apps/markitdown/railpack.json) |

Standalone apps (`rhymes`, `pocket`) have no workspace deps.

## Database

PostgreSQL **18+** is required (`uuidv7()` in migrations):

```bash
DATABASE_URL=postgresql://... bun run db:migrate
```

## Shared env

- `BETTER_AUTH_SECRET` — identical across auth-service and every frontend app
- `DATABASE_URL` — same PostgreSQL instance
- `RESEND_API_KEY` — non-empty on auth-service (placeholder is enough to boot)

See each app's `.env.example` for the full list.
