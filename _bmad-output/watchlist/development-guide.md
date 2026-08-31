# Development Guide — `watchlist`

## Prerequisites

- Bun (this is a Bun + Turbo monorepo — see root [`AGENTS.md`](../../AGENTS.md)).
- PostgreSQL **18+** running locally (`sudo pg_ctlcluster 18 main start`) — PG16 fails migrations (`function uuidv7() does not exist`).
- `auth-service` running on port **5001** for any session-dependent flow (login, edit mode, saved views, "My Stats" dashboard scope). The public catalog (`/`, `/dashboard?scope=catalog`, `/leaderboard`) works without it.

## First-time setup

```bash
# 1. From repo root — start Postgres and apply the shared schema
sudo pg_ctlcluster 18 main start
bun run db:migrate

# 2. Build the shared packages this app imports (dist/, not source)
bun run build:shared:utils
bun run build:shared:db
bun run build:shared:auth

# 3. Copy env files
cp apps/watchlist/.env.example apps/watchlist/.env
cp shared/db/.env.example shared/db/.env   # only needs DATABASE_URL

# 4. Also bring up auth-service (separate terminal/session)
cp apps/auth-service/.env.example apps/auth-service/.env
bun run dev:app:auth
```

## `.env` (from [`.env.example`](../../apps/watchlist/.env.example))

| Var | Local value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | |
| `PORT` | `3002` | Read by `vite.config.ts` via `Bun.env.PORT` for the dev server port. |
| `PUBLIC_BASE_AUTH_URL` | `http://localhost:5001` | Must match wherever `auth-service` is actually running. Consumed via `$env/static/public` — **the app fails to typecheck/build without a `.env` file present**, since these are compile-time-inlined public env vars, not runtime-read. |
| `PUBLIC_BASE_AUTH_PATH` | `/` | |
| `RAILPACK_CONFIG_FILE` / `RAILPACK_BUILD_CMD` / `RAILPACK_START_CMD` | — | Deploy-only; see [deployment-guide.md](./deployment-guide.md). |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/postgres` | Same instance as every other auth-backed app; `watchlist` reads the `watchlist` Postgres schema plus `auth.user`. |
| `BETTER_AUTH_SECRET` | *(set a value — empty breaks nothing locally but should still be set)* | Must be **identical** to `auth-service`'s value or sessions won't validate. |
| `BETTER_AUTH_URL` | `http://localhost:5001` | |
| `BETTER_AUTH_PATH` | `/` | |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:5001,http://localhost:3002` | Must include this app's own origin. |
| `BETTER_AUTH_COOKIE_DOMAIN` | `localhost` | |
| `RESEND_API_KEY` | *(placeholder, e.g. `re_placeholder_local_dev_only`)* | Only required non-empty on **`auth-service`** (crashes at import otherwise) — watchlist itself doesn't send email, but copying the same placeholder is harmless. |
| `RESEND_FROM_EMAIL` | `noreply@z0xm.com` | Unused by this app directly. |

## Running

```bash
bun run dev:app:watchlist    # from repo root — Turbo filter, port 3002
# or, from apps/watchlist:
bun run dev
```

Visit `http://localhost:3002`. The home page (`/`) queries the DB on every load — if PostgreSQL isn't running, `(public)/+page.server.ts` catches the error and falls back to an empty table with defaults (no visible error banner), so an empty/broken-looking table with no obvious error is the first symptom of a down DB, not a crash.

## Type checking / linting

```bash
cd apps/watchlist
bun run check          # svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
bun run check:watch    # same, in watch mode
```

`bun run check` requires a `.env` file to exist in `apps/watchlist` (see above) — without it, `svelte-check` reports 6 spurious errors about `$env/static/public` having no exported members (`PUBLIC_BASE_AUTH_URL`/`PUBLIC_BASE_AUTH_PATH`), which disappear once `.env` is present. With `.env` present, `bun run check` currently reports **0 errors** and 3 pre-existing warnings (two `a11y_label_has_associated_control` warnings in `add-item-dialog.svelte`, one `state_referenced_locally` warning in `filter-dropdown.svelte`).

Root-level lint caveats (prettier flagging built `dist/` files under a subdir check, a few committed markdown files under `format:check`) apply here too — see root `AGENTS.md`.

## Tests

There are currently **no test files** in `apps/watchlist` (no `*.test.ts`/`*.spec.ts` anywhere under `src`), unlike `apps/zeo` (`bun test src`) and `apps/chhan-chhan`'s importers. Correctness currently relies on `bun run check` (types) plus manual QA.

## Building

```bash
bun run build:app:watchlist   # from repo root (requires build:shared:* to have run first)
# or, from apps/watchlist, after shared packages are built:
bun run build
bun run start                 # bun --env-file=.env ./build/index.js
```

## Common local pitfalls

- **Stale shared package types/behavior:** if you edit `shared/db/src/schema/watchlist.ts` or `shared/auth`, re-run the relevant `bun run build:shared:*` before `bun run dev:app:watchlist` picks it up — dev mode does not watch/rebuild the workspace packages automatically.
- **`vite-kysely-compat.ts`:** `vite.config.ts` imports this local compat shim (aliases `pg-native` to a no-op stub, `src/lib/pg-native-stub.js`) so the Bun/Vite build doesn't try to load the native `pg-native` addon that `pg` optionally requires. Don't remove this import or the alias — the watchlist `Dockerfile` even has a guard step that fails the build early if `vite.config.ts` stops referencing `./vite-kysely-compat`.
- **Session not persisting in the browser locally:** see [project-context.md](./project-context.md#known-gotchas-verified-against-source-2026-08-31) — Better Auth cookies are `secure`/`sameSite: none`, which many browsers refuse over plain `http://localhost`.
- **Email verification locally:** `auth-service`'s Resend integration is disabled-by-placeholder by default, so verification emails aren't actually delivered — flip `email_verified` directly in the `auth.user` table to test verified-only flows (saved views, edit mode, adding/deleting items all require it).

## Deploying

See [deployment-guide.md](./deployment-guide.md) for the full Dockerfile/Railpack walkthrough; the short version is: build from the **monorepo root**, not `apps/watchlist`, because of the `workspace:*` dependencies on `@pocket-dimension/{auth,db,utils}`.
