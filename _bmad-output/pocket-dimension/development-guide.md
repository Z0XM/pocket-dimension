# Development Guide

## Prerequisites

- Node.js >= 22.12
- **Bun 1.3.5**
- **PostgreSQL 18+** (not 16 — `uuidv7()` is required)
- For markitdown: Python 3, `ffmpeg`, `exiftool`

## First-time setup

```bash
# PostgreSQL 18
sudo pg_ctlcluster 18 main start   # or: sudo service postgresql start

# Repo
bun install
bun run build                      # builds shared dist/ packages

# Env (each package that needs it)
cp shared/db/.env.example shared/db/.env
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# Auth + each app: copy .env.example → .env
# BETTER_AUTH_SECRET must match across auth-service and all frontends
# RESEND_API_KEY must be non-empty (placeholder is fine to boot)

bun run db:migrate
```

Connection used in AGENTS.md: user `postgres`, password `postgres`, db `postgres`.

## Shared package build

Apps import `dist/` of `@pocket-dimension/{auth,db,utils}`. After changing shared code:

```bash
bun run build:shared:utils
bun run build:shared:db
bun run build:shared:auth
# or: bun run build
```

`auth-service` has no app build step (Bun runs TypeScript).

## Run locally

```bash
bun run dev:app:auth               # :5001 — needed for auth apps
bun run dev:app:watchlist          # :3002
bun run dev:app:rhymes             # :3003
bun run dev:app:howwasyourday      # :3004
bun run dev:app:chhan-chhan        # :3005
bun run dev:app:me-via-you         # :3006
bun run dev:app:markitdown         # :3009
bun run dev:app:pocket             # :3007
bun run dev:app:zeo                # :3008
bun run dev:app:zeo-music-worker   # :3010
```

Auth-backed apps also need `PUBLIC_BASE_AUTH_URL=http://localhost:5001`.

### zeo extras

LiveKit for local calls: see `apps/zeo/deploy/livekit/`. Shared listening needs the music worker + YouTube env vars.

### markitdown extras

```bash
cd apps/markitdown && bun run setup:python
```

## Database

```bash
bun run db:generate                # after schema edits
bun run db:migrate
bun run db:studio
```

Schemas: `auth`, `watchlist`, `howwasyourday`, `chhanchhan`, `meviayou`, `zeo`.

## Tests

| Area | Command | Notes |
| --- | --- | --- |
| Root | `bun run test` | Mostly empty; auth-service is `--passWithNoTests` |
| zeo | `cd apps/zeo && bun test src` | LiveKit/UI/game unit tests |
| chhan-chhan | `cd apps/chhan-chhan && bun test src/lib/importers/` | Bank importers |

## Lint / typecheck

```bash
bun run typecheck
bun run format:check               # root prettier (respects .prettierignore)
bun run lint                       # per-package prettier; may flag dist/ after build
```

## Session caveat

Better Auth uses `secure: true` / `sameSite: "none"`. On `http://localhost` the session cookie often does not persist. Signup still works; verifying users may require flipping `email_verified` in the DB if email is not delivered.

## Email

`RESEND_API_KEY` is required at module load (`shared/auth/src/lib/emails.ts`). Use a placeholder locally. Verification emails are fire-and-forget.

## Common tasks

| Task | Where |
| --- | --- |
| Add a DB table | `shared/db/src/schema/<app>.ts` → `db:generate` → `db:migrate` |
| Add an auth-backed app | hooks + auth-client + `BETTER_AUTH_*` + named schema |
| Add a bank importer | `apps/chhan-chhan` — see `IMPORT.md` |
| Switch BMAD project | Default is this folder; zeo/chhan-chhan keep their own trees |
