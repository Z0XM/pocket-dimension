# Development Guide — Pocket Dimension

## Prerequisites

- Node.js ≥ 22.12
- Bun 1.3.5
- PostgreSQL **18+** (native `uuidv7()`)

```bash
sudo pg_ctlcluster 18 main start
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

## First-time setup

```bash
bun install
# Copy each package/app `.env.example` → `.env`
# RESEND_API_KEY=re_placeholder_local_dev_only  (must be non-empty)
# BETTER_AUTH_SECRET=<same value everywhere>
bun run build                 # shared dist/ required (^build)
bun run db:migrate
```

## Day-to-day

```bash
bun run build:shared:utils && bun run build:shared:db && bun run build:shared:auth
# or: bun run build

bun run dev:app:auth          # :5001 — needed for auth-backed apps
bun run dev:app:<name>        # see AGENTS.md / project-overview ports

bun run typecheck             # turbo; shared uses tsgo; SvelteKit apps may use `check` only
bun run test
bun run format                # Prettier write (not Biome)
bun run format:check
bun run heimdall doctor
bun run heimdall dev          # needs apps/heimdall dist/cli.cjs or tsx
```

## Scripts / ETL

```bash
cd scripts
# watchlist / rhymes importers under src/; need DATABASE_URL + built db package
```

## Env caveats

- Bun loads `.env` from each package cwd (Turbo runs tasks in package dirs).
- `shared/db/.env` only needs `DATABASE_URL`.
- Importing `@pocket-dimension/auth` validates env **eagerly** — empty `RESEND_API_KEY` crashes.
- Local session cookies may not persist over `http://localhost`.

## Lint quirks

- Per-package `bun run lint` may flag `dist/` (subdir Prettier ignores root `.prettierignore`).
- Prefer root `bun run format:check` for whole-repo formatting signal.

## Pre-commit

Husky runs lint-staged → typecheck changed → build changed. Skip build with `SKIP_PRE_COMMIT_BUILD=1`.

## More detail

- Tools architecture: [architecture-monorepo-tools.md](./architecture-monorepo-tools.md)
- Deploy: [deployment-guide.md](./deployment-guide.md)
- Packages: `_bmad-output/shared-*/development-guide.md`
- Cloud agent caveats: root `AGENTS.md`
