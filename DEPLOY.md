# Deploying Pocket Dimension (monorepo)

Apps that depend on `@pocket-dimension/auth`, `@pocket-dimension/db`, or `@pocket-dimension/utils` **must include the full monorepo** at build time. If Railpack runs `bun install` inside `apps/<app>` only, the build fails with:

```text
error: Workspace dependency "@pocket-dimension/auth" not found
Searched in "./*"
```

## Recommended: Dockerfile (Dokploy)

Works regardless of the Railpack “root directory” setting.

| App | Dockerfile | Build context | Port |
|-----|------------|---------------|------|
| auth-service | `apps/auth-service/Dockerfile` | `/` (repo root) | 5001 |
| watchlist | `apps/watchlist/Dockerfile` | `/` (repo root) | 3002 |
| rhymes | `apps/rhymes/Dockerfile` | `/` (repo root) | 3003 |
| howwasyourday | `apps/howwasyourday/Dockerfile` | `/` (repo root) | 3004 |
| chhan-chhan | `apps/chhan-chhan/Dockerfile` | `/` (repo root) | 3005 |
| me-via-you | `apps/me-via-you/Dockerfile` | `/` (repo root) | 3006 |
| pocket | `apps/pocket/Dockerfile` | `/` (repo root) | 3007 |
| zeo | `apps/zeo/Dockerfile` | `/` (repo root) | 3008 |
| zeo-music-worker | `apps/zeo-music-worker/Dockerfile` | `/` (repo root) | 3010 |

Dokploy has three separate fields — **Build Path**, **Docker Context Path**, and **Dockerfile Path**:

| Dokploy field | auth-service (Option A) | auth-service (Option B) |
|---------------|-------------------------|-------------------------|
| Build Path | **`/`** | `apps/auth-service` |
| Docker Context Path | `.` | **`/`** (not `.`) |
| Dockerfile Path | `apps/auth-service/Dockerfile` | `Dockerfile` |

**Do not** use Build Path `apps/auth-service` with Context Path `.` — that limits Docker to the app folder and `COPY shared/` fails.

Equivalent CLI: `docker build -f apps/auth-service/Dockerfile -t auth-service .` (context is always repo root).

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
| rhymes | 3003 | [apps/rhymes/DEPLOY.md](./apps/rhymes/DEPLOY.md) |
| howwasyourday | 3004 | [apps/howwasyourday/DEPLOY.md](./apps/howwasyourday/DEPLOY.md) |
| chhan-chhan | 3005 | [apps/chhan-chhan/DEPLOY.md](./apps/chhan-chhan/DEPLOY.md) |
| me-via-you | 3006 | [apps/me-via-you/DEPLOY.md](./apps/me-via-you/DEPLOY.md) |
| pocket | 3007 | [apps/pocket/DEPLOY.md](./apps/pocket/DEPLOY.md) |
| zeo | 3008 | [apps/zeo/DEPLOY.md](./apps/zeo/DEPLOY.md) · [dokploy runbook](./apps/zeo/deploy/dokploy/README.md) |
| markitdown | 3009 | [apps/markitdown/railpack.json](./apps/markitdown/railpack.json) |

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
