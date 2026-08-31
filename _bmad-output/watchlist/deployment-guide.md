# Deployment Guide — `watchlist`

Full source: [`apps/watchlist/DEPLOY.md`](../../apps/watchlist/DEPLOY.md). Monorepo-wide deploy rules: [`../../DEPLOY.md`](../../DEPLOY.md).

## The root rule this app must follow

`watchlist` depends on `@pocket-dimension/{auth,db,utils}` via `workspace:*`. **Any build must have the full monorepo checked out**, not just `apps/watchlist` — a Railpack build that runs `bun install` scoped to `apps/watchlist` alone fails with:

```text
error: Workspace dependency "@pocket-dimension/db" not found
Searched in "./*"
```

This is why every deploy path below is described in terms of **Build Path** / **Docker Context Path** as two independent Dokploy fields — getting them out of sync is the most common deploy failure mode for this and every other `@pocket-dimension/*`-dependent app.

## Recommended: Dockerfile (Dokploy)

Port: **3002**. Dockerfile: [`apps/watchlist/Dockerfile`](../../apps/watchlist/Dockerfile).

| Option | Build Path | Docker Context Path | Dockerfile Path |
| --- | --- | --- | --- |
| A (simplest) | `/` | `.` | `apps/watchlist/Dockerfile` |
| B | `apps/watchlist` | `/` (**not** `.`) | `Dockerfile` |

Equivalent local command: `docker build -f apps/watchlist/Dockerfile -t watchlist .` (context is always the repo root regardless of which Dokploy option you mirror).

**What the Dockerfile does** (multi-stage, `oven/bun:1.3.5` builder → `oven/bun:1.3.5-slim` runner):
1. Copies `package.json`, `bun.lock`, `turbo.json`, `vite-kysely-compat.ts`, `scripts/`, `shared/`, `apps/` into the build image.
2. `bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/watchlist'` — hoisted install, scoped to this app's dependency graph.
3. Removes all `node_modules` under `apps/*`/`shared/*` (the hoisted install leaves broken symlinks there; only the root `node_modules` is used at runtime).
4. **Guard step:** fails the build early if `apps/watchlist/vite-kysely-compat.ts` is missing or `vite.config.ts` no longer imports `./vite-kysely-compat` — this specifically catches a Dokploy/Docker layer-cache bug where a stale pre-fix `apps/` layer (with the old `../../vite-kysely-compat` import path) got reused.
5. `bun run prepare` (svelte-kit sync) inside `apps/watchlist`.
6. Builds shared packages in dependency order, then the app: `build:shared:utils` → `build:shared:db` → `build:shared:auth` → `build:app:watchlist` (all with `TURBO_FORCE=1` to bypass Turbo's cache inside the fresh build container).
7. Runner stage copies only `node_modules`, `shared/`, the built `apps/watchlist/build/`, and `apps/watchlist/package.json` — starts with `bun ./build/index.js` from `/app/apps/watchlist`, `PORT=3002`.

## Alternative: Railpack

Config: [`apps/watchlist/railpack.json`](../../apps/watchlist/railpack.json). Root directory can be `apps/watchlist` **or** `/` — both work with the checked-in config. If root is `/`, set in the Dokploy **Environment** panel (not just present in `.env.example`, which Dokploy does not read):

```env
RAILPACK_CONFIG_FILE=apps/watchlist/railpack.json
```

Railpack's `install` step is a no-op (`"commands": ["true"]`) — the real install/build happens inside [`apps/watchlist/scripts/deploy-build.sh`](../../apps/watchlist/scripts/deploy-build.sh), called from the `build` step:

```bash
#!/usr/bin/env bash
set -euo pipefail
# resolves to the monorepo root regardless of cwd, then:
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/watchlist'
(cd apps/watchlist && bun run prepare)
TURBO_FORCE=1 bun run build:shared:utils
TURBO_FORCE=1 bun run build:shared:db
TURBO_FORCE=1 bun run build:shared:auth
TURBO_FORCE=1 bun run build:app:watchlist
# then, only if DATABASE_URL is set at build time:
bun db:migrate
```

The script exits early with a clear error if `shared/auth/package.json` is missing (i.e. the monorepo wasn't fully checked out) — the same failure mode the Docker path avoids by design. If `DATABASE_URL` isn't available at build time, migrations are skipped with a warning and must be run manually before serving traffic.

## Production environment

Copy from [`.env.example`](../../apps/watchlist/.env.example); minimum set for production:

```env
NODE_ENV=production
ORIGIN=https://watchlist.example.com
DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same value as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://watchlist.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
```

Both `watchlist` and `auth-service` **must** be served over HTTPS in production — Better Auth's cookies are `secure: true` / `sameSite: "none"` unconditionally, so they're silently dropped over plain HTTP.

## Local smoke test (without a container)

```bash
./apps/watchlist/scripts/deploy-build.sh   # from repo root
cd apps/watchlist && bun run start
```

Or with Docker:
```bash
docker build -f apps/watchlist/Dockerfile -t watchlist .
docker run --rm -p 3002:3002 --env-file apps/watchlist/.env watchlist
```

## Troubleshooting (from `apps/watchlist/DEPLOY.md`)

| Symptom | Cause / fix |
| --- | --- |
| `Could not resolve "../../vite-kysely-compat"` / missing `.svelte-kit/tsconfig.json` | Build is using stale source predating the `vite-kysely-compat.ts` relocation. Confirm the Dokploy service tracks `main`, redeploy with build-cache cleared. |
| `"/shared": not found` / `"/turbo.json": not found` during Docker build | Build Path is `apps/watchlist` but Docker Context Path is `.` — use Option A above, or set Context Path to `/`. |
| `Workspace dependency "@pocket-dimension/db" not found` | Railpack ran its own auto `bun install` before the custom script. Switch to the Dockerfile build, or ensure the checked-in `railpack.json` (which no-ops the `install` step) is actually being used. |
| `lockfile is frozen` | Ensure `bun.lock` is committed, or set `RAILPACK_INSTALL_CMD=bun install`. |

See [deep-dive-watchlist.md §4.7](./deep-dive-watchlist.md) for how this deploy shape generalizes to sibling auth-backed apps in the monorepo.
