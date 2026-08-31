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
bun run build                 # shared dist/ required
bun run db:migrate
```

## Day-to-day

```bash
bun run build:shared:utils && bun run build:shared:db && bun run build:shared:auth
# or: bun run build

bun run dev:app:auth          # :5001 — needed for auth-backed apps
bun run dev:app:<name>        # see AGENTS.md port table

bun run typecheck
bun run test                  # packages that define tests (e.g. zeo, heimdall)
bun run heimdall doctor
bun run heimdall dev          # :5174 UI / :5175 API
```

## Env caveats

- Bun loads `.env` from each package cwd (Turbo runs tasks in package dirs).
- `shared/db/.env` only needs `DATABASE_URL`.
- Empty `RESEND_API_KEY` crashes auth at module load.
- Local session cookies may not persist over `http://localhost` — signup can still work; mark `email_verified` in DB if needed.

## Lint / format quirks

- Per-package `bun run lint` (Prettier) may flag `dist/` because subdirectory Prettier ignores root `.prettierignore`.
- Prefer root `bun run format:check` for whole-repo formatting signal.

## More detail

- Cloud agent caveats: root `AGENTS.md`
- Deploy: [deployment-guide.md](./deployment-guide.md) and root `DEPLOY.md`
- Package-specific: `_bmad-output/shared-*/`
