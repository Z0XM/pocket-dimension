# Architecture — Monorepo tools

Root orchestration, quality gates, deploy wrappers, and Heimdall dogfood wiring. Day-to-day commands: [development-guide.md](./development-guide.md).

## Workspaces & package manager

| Item | Value |
| --- | --- |
| Workspaces | `apps/**`, `shared/**`, `scripts/**` |
| Package manager | `bun@1.3.5` |
| Node | ≥ 22.12.0 |
| Override | `kysely: 0.28.17` (Better Auth adapter compat; see `vite-kysely-compat.ts`) |

## Turbo (`turbo.json`)

| Task | Notes |
| --- | --- |
| `build` | `dependsOn: ["^build"]` → shared builds before apps; outputs `dist/**` etc. |
| `dev` / `start` | `cache: false`, `persistent: true` |
| `test` / `test:coverage` | `dependsOn: ["^build"]` |
| `typecheck` | `dependsOn: ["^typecheck"]`, empty outputs |
| `db:*` | `cache: false` |
| `globalDependencies` | `**/.env.*local`, `.env` |

Most root scripts invoke `./scripts/turbo-no-prefix.sh`, which runs `bunx turbo` and strips `@scope/pkg:task:` prefixes from logs while preserving exit code.

**Exception:** root `typecheck` calls `turbo` directly (no wrapper).

## Scripts workspace (`@pocket-dimension/scripts`)

Separate from the shell wrapper — Bun package for one-off ETL/seed:

| Area | Path |
| --- | --- |
| Common helpers | `scripts/src/common/{csv,json}.ts` |
| Watchlist importers | `scripts/src/watchlist/*` + `data/watchlist/cinema.csv` |
| Rhymes tooling | `scripts/src/rhymes/docs.ts` + `data/rhymes/rhymes.json` |
| DB access | devDependency on `@pocket-dimension/db` |

`build` script is a no-op. Nested `scripts/bun.lock` exists alongside root lockfile.

## TypeScript strategy

| Surface | Checker |
| --- | --- |
| `shared/*`, `auth-service` | `tsgo --noEmit` (`@typescript/native-preview`) |
| SvelteKit apps | `svelte-kit sync && svelte-check` (classic `tsc`) |
| Root loose files | `tsconfig.json` extends base; excludes `apps`/`shared` |

Base: `tsconfig.base.json` — ES2022, `moduleResolution: bundler`, `strict: true`.

## Lint / format / hooks

- **Prettier only** (no ESLint, no Biome). Plugins: svelte, astro.
- Per-package `lint` = `prettier --check .` — does **not** read root `.prettierignore` → may flag `dist/` after build.
- Root `format` / `format:check` respect `.prettierignore`.
- Husky `prepare: husky || true`.
- Pre-commit: `lint-staged` (Prettier write) → `turbo typecheck --filter='[HEAD^1]'` → `turbo build --filter='[HEAD^1]'` (skip with `SKIP_PRE_COMMIT_BUILD=1`; excludes `@pocket-dimension/scripts`).

## Changesets

`.changeset/config.json`: `access: restricted`, `baseBranch: main`, `updateInternalDependencies: patch`, `commit: false`. Scripts: `changeset`, `version`, `release` (build changed via `[HEAD^1]` then publish). No CI publish pipeline — scaffolding only while packages stay private.

## Deploy tooling

See also [deployment-guide.md](./deployment-guide.md) and root `DEPLOY.md`.

| Path | Behavior |
| --- | --- |
| Per-app `Dockerfile` | Build **context = repo root** |
| Per-app `railpack.json` | `install.commands: ["true"]`; real install via `scripts/deploy-build.sh` from root |
| `.dockerignore` | Stub-only for some apps (`markitdown`, `zeo-music-worker`); keeps `_bmad-output` for Heimdall |

## Heimdall dogfood

| Script | Role |
| --- | --- |
| `bun run heimdall` | CLI (`doctor`, `init`, …) via `apps/heimdall/bin/heimdall.cjs` |
| `bun run dev:heimdall` | CLI `dev` (API + Vite) |
| `bun run dev:app:heimdall` | Turbo-filtered app `dev` |

Config: root `heimdall.config.mjs` (Modules mode). Module ids: `pocket-dimension`, `shared-utils`, `shared-db`, `shared-auth`, `heimdall`, `zeo`, `chhan-chhan`.

CLI prefers `dist/cli.cjs`; without it falls back to `node --import tsx` on `src/cli.ts` (tsx lives under `apps/heimdall/node_modules`).

## CI

**None.** No `.github/workflows`. Quality relies on husky + Dokploy/Railpack build-time checks.
