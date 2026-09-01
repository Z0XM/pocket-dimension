# Feature Registry — Monorepo (`pocket-dimension`)

Brownfield capability inventory for cross-cutting monorepo tooling (not app product features).
Derived from deep scan 2026-08-31 — see [project-overview.md](./project-overview.md), [architecture-monorepo-tools.md](./architecture-monorepo-tools.md).

Package capabilities live in peer modules (`shared-utils`, `shared-db`, `shared-auth`). App Features SoT lives in each app module when authored.

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Bun + Turbo workspaces | n/a | Platform | Epic 1 | Live |
| F-2 | Shared package build pipeline | n/a | Platform | Epic 1 | Live |
| F-3 | Root scripts & turbo-no-prefix | n/a | Platform | Epic 1 | Live |
| F-4 | Typecheck strategy | n/a | Platform | Epic 1 | Live |
| F-5 | Format / lint / pre-commit gates | n/a | Platform | Epic 1 | Live |
| F-6 | Scripts ETL workspace | n/a | Platform | Epic 1 | Live |
| F-7 | Root-context deploy tooling | n/a | Platform | Epic 1 | Live |
| F-8 | DB migrate orchestration | n/a | Platform | Epic 1 | Live |
| F-9 | Heimdall dogfood wiring | n/a | Platform | Epic 1 | Live |
| F-10 | Changesets scaffolding | n/a | Platform | Epic 1 | Live |

## Feature details

### F-1 — Bun + Turbo workspaces

- **Goal:** Orchestrate `apps/**`, `shared/**`, and `scripts/**` as one Bun workspace under Turbo.
- **Area:** Workspaces
- **Includes:**
  - `packageManager: bun@1.3.5`, Node ≥ 22.12.0
  - Workspace globs and Turbo `build` / `dev` / `test` / `db:*` task graph
  - `kysely` override for Better Auth adapter compat
- **Deferred:**
  - CI workflows (none today — husky only)
- **See also:**
  - [architecture-monorepo-tools.md](./architecture-monorepo-tools.md)

### F-2 — Shared package build pipeline

- **Goal:** Build `@pocket-dimension/{utils,db,auth}` `dist/` before apps consume them.
- **Area:** Build
- **Includes:**
  - Turbo `dependsOn: ["^build"]` for apps/tests
  - Root `build:shared:*` scripts and `bun run build`
- **Deferred:**
  - None currently.
- **See also:**
  - Peer modules `_bmad-output/shared-*`

### F-3 — Root scripts & turbo-no-prefix

- **Goal:** Run Turbo tasks from the repo root with readable logs.
- **Area:** Tooling
- **Includes:**
  - `./scripts/turbo-no-prefix.sh` wrapper (most root scripts)
  - Root `dev:app:*` / `build:app:*` / `heimdall` entrypoints
- **Deferred:**
  - Route root `typecheck` through the same log wrapper
- **See also:**
  - [development-guide.md](./development-guide.md)

### F-4 — Typecheck strategy

- **Goal:** Typecheck shared packages and apps with the right checker per surface.
- **Area:** Quality
- **Includes:**
  - `tsgo --noEmit` for `shared/*` and `auth-service`
  - `svelte-check` for SvelteKit apps
  - `tsconfig.base.json` strict ES2022 / bundler resolution
- **Deferred:**
  - None currently.
- **See also:**
  - [architecture-monorepo-tools.md](./architecture-monorepo-tools.md#typescript-strategy)

### F-5 — Format / lint / pre-commit gates

- **Goal:** Keep formatting consistent and block broken typecheck/build on commit.
- **Area:** Quality
- **Includes:**
  - Prettier (svelte + astro plugins); per-package `lint` = prettier check
  - Husky + lint-staged → filtered turbo typecheck/build
  - `SKIP_PRE_COMMIT_BUILD=1` escape hatch
- **Deferred:**
  - ESLint / Biome (intentionally unused)
  - GitHub Actions CI
- **See also:**
  - [contribution-guide.md](./contribution-guide.md)

### F-6 — Scripts ETL workspace

- **Goal:** One-off Bun ETL/seed for watchlist and rhymes data.
- **Area:** Scripts
- **Includes:**
  - `@pocket-dimension/scripts` package under `scripts/`
  - Common CSV/JSON helpers; watchlist cinema importer; rhymes docs tooling
  - DevDependency on `@pocket-dimension/db`
- **Deferred:**
  - Formalizing nested `scripts/bun.lock` vs root lockfile
- **See also:**
  - [architecture-monorepo-tools.md](./architecture-monorepo-tools.md#scripts-workspace-pocket-dimensionscripts)

### F-7 — Root-context deploy tooling

- **Goal:** Deploy apps from repository root so workspace deps resolve.
- **Area:** Deploy
- **Includes:**
  - Per-app `Dockerfile` + `railpack.json` + `scripts/deploy-build.sh`
  - Root `DEPLOY.md` / [deployment-guide.md](./deployment-guide.md)
  - `.dockerignore` keeps `_bmad-output` for Heimdall images
- **Deferred:**
  - Unify stub Docker setups for markitdown / zeo-music-worker
- **See also:**
  - Root [`DEPLOY.md`](../../DEPLOY.md)

### F-8 — DB migrate orchestration

- **Goal:** Apply shared Drizzle migrations against PostgreSQL 18+.
- **Area:** Database
- **Includes:**
  - Root `bun run db:migrate` (requires PG18 running)
  - Named schemas map documented in [data-models.md](./data-models.md)
- **Deferred:**
  - Auto-start PG18 in Cloud Agent sessions
- **See also:**
  - `_bmad-output/shared-db/` Feature Registry

### F-9 — Heimdall dogfood wiring

- **Goal:** Run the War Room against this monorepo’s BMAD Modules layout.
- **Area:** Heimdall
- **Includes:**
  - Root `heimdall.config.mjs` (Modules mode)
  - `bun run heimdall` / `dev:heimdall` / `dev:app:heimdall`
  - Peer `_bmad-output/<module>/` SoR folders
- **Deferred:**
  - Product SoR under `_bmad-output/heimdall/` (incremental)
- **See also:**
  - [`../README.md`](../README.md), `apps/heimdall/docs/AUTHORING.md`

### F-10 — Changesets scaffolding

- **Goal:** Version workspace packages when they become publishable.
- **Area:** Release
- **Includes:**
  - `.changeset/config.json` (restricted, baseBranch main)
  - `changeset` / `version` / `release` scripts
- **Deferred:**
  - CI publish pipeline (packages remain private)
- **See also:**
  - [contribution-guide.md](./contribution-guide.md)
