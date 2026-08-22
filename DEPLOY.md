# Deploying Pocket Dimension (monorepo)

Apps that depend on `@pocket-dimension/auth`, `@pocket-dimension/db`, or `@pocket-dimension/utils` **must deploy from the repository root**. If the platform root directory is set to `apps/<app>`, `bun install` cannot resolve workspace packages and the build fails with:

```text
error: Workspace dependency "@pocket-dimension/auth" not found
Searched in "./*"
```

## Required platform settings

For every auth-backed app on Dokploy, Railway, or Railpack:

| Setting | Value |
|---------|-------|
| **Root directory** | `/` (repository root — **not** `apps/<app>`) |
| **Build type** | Railpack |
| **Config file** | `RAILPACK_CONFIG_FILE=apps/<app>/railpack.json` |

Alternative to `railpack.json`: set `RAILPACK_BUILD_CMD` and `RAILPACK_START_CMD` in the service env (see each app's `.env.example`).

## Per-app guides

| App | Port | Railpack config | Details |
|-----|------|-----------------|---------|
| auth-service | 5001 | `apps/auth-service/railpack.json` | [apps/auth-service/DEPLOY.md](./apps/auth-service/DEPLOY.md) |
| watchlist | 3002 | `apps/watchlist/railpack.json` | [apps/watchlist/DEPLOY.md](./apps/watchlist/DEPLOY.md) |
| chhan-chhan | 3005 | env vars | [apps/chhan-chhan/DEPLOY.md](./apps/chhan-chhan/DEPLOY.md) |
| zeo | 3008 | env vars | [apps/zeo/deploy/dokploy/README.md](./apps/zeo/deploy/dokploy/README.md) |
| markitdown | 3006 | `apps/markitdown/railpack.json` | [apps/markitdown/railpack.json](./apps/markitdown/railpack.json) |
| zeo-music-worker | 3010 | Dockerfile | [apps/zeo-music-worker/README.md](./apps/zeo-music-worker/README.md) |

Standalone apps (`rhymes`, `pocket`) have no workspace deps and may use app-level root directories.

## Database

PostgreSQL **18+** is required (`uuidv7()` in migrations). Run migrations once per deploy environment:

```bash
DATABASE_URL=postgresql://... bun run db:migrate
```

Some deploy scripts run migrations automatically when `DATABASE_URL` is set at build time.

## Shared env

- `BETTER_AUTH_SECRET` — identical across auth-service and every frontend app
- `DATABASE_URL` — same PostgreSQL instance
- `RESEND_API_KEY` — non-empty on auth-service (placeholder is enough to boot)

See each app's `.env.example` for the full list.
