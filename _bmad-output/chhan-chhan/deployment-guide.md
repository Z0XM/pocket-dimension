# Deployment Guide — `chhan-chhan`

Full source: [`apps/chhan-chhan/DEPLOY.md`](../../apps/chhan-chhan/DEPLOY.md). Monorepo-wide deploy rules: [`../../DEPLOY.md`](../../DEPLOY.md).

## The root rule this app must follow

`chhan-chhan` depends on `@pocket-dimension/{auth,db,utils}` via `workspace:*`. **Any build must have the full monorepo checked out**, not just `apps/chhan-chhan` — a build scoped to the app directory alone fails with a missing-workspace-dependency error. Every deploy path below is described in terms of **Build Path** / **Docker Context Path** as two independent Dokploy fields — getting them out of sync is the most common deploy failure mode for this and every other `@pocket-dimension/*`-dependent app.

## Recommended: Dockerfile (Dokploy)

Port: **3005**. Dockerfile: [`apps/chhan-chhan/Dockerfile`](../../apps/chhan-chhan/Dockerfile).

| Option | Build Path | Docker Context Path | Dockerfile Path |
| --- | --- | --- | --- |
| A (simplest) | `/` | `.` | `apps/chhan-chhan/Dockerfile` |
| B | `apps/chhan-chhan` | `/` (**not** `.`) | `Dockerfile` |

Equivalent local command: `docker build -f apps/chhan-chhan/Dockerfile -t chhan-chhan .` (context is always the repo root regardless of which Dokploy option you mirror).

**What the Dockerfile does** (multi-stage, `oven/bun:1.3.5` builder → `oven/bun:1.3.5-slim` runner):
1. Copies `package.json`, `bun.lock`, `turbo.json`, `vite-kysely-compat.ts`, `scripts/`, `shared/`, `apps/` into the build image.
2. `bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/chhan-chhan'` — hoisted install, scoped to this app's dependency graph.
3. Removes all `node_modules` under `apps/*`/`shared/*` (the hoisted install leaves broken symlinks there; only the root `node_modules` is used at runtime).
4. **Guard step:** fails the build early if `apps/chhan-chhan/vite-kysely-compat.ts` is missing or `vite.config.ts` no longer references `./vite-kysely-compat` — protects against a Docker/Dokploy layer-cache bug where a stale pre-fix `apps/` layer (with the old `../../vite-kysely-compat` import path) got reused.
5. `bun run prepare` (svelte-kit sync) inside `apps/chhan-chhan`.
6. Builds shared packages in dependency order, then the app: `build:shared:utils` → `build:shared:db` → `build:shared:auth` → `build:app:chhan-chhan` (all with `TURBO_FORCE=1` to bypass Turbo's cache inside the fresh build container).
7. Runner stage copies only `node_modules`, `shared/`, the built `apps/chhan-chhan/build/`, and `apps/chhan-chhan/package.json` — starts with `bun ./build/index.js` from `/app/apps/chhan-chhan`, `PORT=3005`.

## Alternative: Railpack

Config: [`apps/chhan-chhan/railpack.json`](../../apps/chhan-chhan/railpack.json). Root directory can be `apps/chhan-chhan` **or** `/` — both work with the checked-in config. If root is `/`, set in the Dokploy **Environment** panel (not just present in `.env.example`, which Dokploy does not read):

```env
RAILPACK_CONFIG_FILE=apps/chhan-chhan/railpack.json
```

Railpack's `install` step is a no-op (`"commands": ["true"]`) — the real install/build happens inside [`apps/chhan-chhan/scripts/deploy-build.sh`](../../apps/chhan-chhan/scripts/deploy-build.sh), called from the `build` step:

```bash
#!/usr/bin/env bash
set -euo pipefail
# resolves to the monorepo root regardless of cwd, then:
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/chhan-chhan'
(cd apps/chhan-chhan && bun run prepare)
TURBO_FORCE=1 bun run build:shared:utils
TURBO_FORCE=1 bun run build:shared:db
TURBO_FORCE=1 bun run build:shared:auth
TURBO_FORCE=1 bun run build:app:chhan-chhan
# then, only if DATABASE_URL is set at build time:
bun db:migrate
```

The script exits early with a clear error if `shared/auth/package.json` is missing (i.e. the monorepo wasn't fully checked out). If `DATABASE_URL` isn't available at build time, migrations are skipped and must be run manually before serving traffic — an easy-to-miss operational step for a fresh deploy.

`railpack.json`'s `deployOutputs.include` (`node_modules`, `shared`, `apps/chhan-chhan/build`, `apps/chhan-chhan/package.json`, `package.json`, `bun.lock`, `scripts`) must be kept in sync with whatever `deploy-build.sh` actually produces, or the deployed image silently ships stale files.

## Production environment

Copy from [`.env.example`](../../apps/chhan-chhan/.env.example); minimum set for production:

```env
NODE_ENV=production
ORIGIN=https://chhan.example.com
BODY_SIZE_LIMIT=10M
DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same value as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://chhan.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
```

Both `chhan-chhan` and `auth-service` **must** be served over HTTPS in production — Better Auth's cookies are `secure: true`/`sameSite: "none"` unconditionally, so they're silently dropped over plain HTTP. `BODY_SIZE_LIMIT` must stay raised in production too, or real bank-statement PDF uploads will fail.

## Local smoke test (without a container)

```bash
./apps/chhan-chhan/scripts/deploy-build.sh   # from repo root
cd apps/chhan-chhan && bun run start
```

Or with Docker:
```bash
docker build -f apps/chhan-chhan/Dockerfile -t chhan-chhan .
docker run --rm -p 3005:3005 --env-file apps/chhan-chhan/.env chhan-chhan
```

## Troubleshooting (from `apps/chhan-chhan/DEPLOY.md`)

| Symptom | Cause / fix |
| --- | --- |
| `Could not resolve "../../vite-kysely-compat"` / missing `.svelte-kit/tsconfig.json` | Build is using stale source predating the `vite-kysely-compat.ts` relocation. Confirm the Dokploy service tracks `main`, redeploy with the build cache cleared. |
| `"/shared": not found` / `"/turbo.json": not found` during Docker build | Build Path is `apps/chhan-chhan` but Docker Context Path is `.` — use Option A above, or set Context Path to `/`. |
| `Workspace dependency "@pocket-dimension/db" not found` | Railpack ran its own auto `bun install` before the custom script. Switch to the Dockerfile build, or ensure the checked-in `railpack.json` (which no-ops the `install` step) is actually being used. |

See [architecture.md](./architecture.md) for how this deploy shape generalizes to sibling auth-backed apps in the monorepo (identical `vite-kysely-compat.ts` shim, identical Dokploy Build-Path/Context-Path gotcha).
