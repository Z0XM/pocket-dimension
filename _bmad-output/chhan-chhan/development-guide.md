# Development Guide — `chhan-chhan`

## Prerequisites

- Bun (this is a Bun + Turbo monorepo — see root [`AGENTS.md`](../../AGENTS.md)).
- PostgreSQL **18+** running locally (`sudo pg_ctlcluster 18 main start`) — PG16 fails migrations (`function uuidv7() does not exist`).
- `auth-service` running on port **5001** for any session-dependent flow (login, ledger, control, dashboards — the entire `(protected)/app` tree requires a session).

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
cp apps/chhan-chhan/.env.example apps/chhan-chhan/.env
cp shared/db/.env.example shared/db/.env   # only needs DATABASE_URL

# 4. Also bring up auth-service (separate terminal/session)
cp apps/auth-service/.env.example apps/auth-service/.env
bun run dev:app:auth
```

## `.env` (from [`.env.example`](../../apps/chhan-chhan/.env.example))

| Var | Local value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | |
| `PORT` | `3005` | Read by `vite.config.ts` via `Bun.env.PORT` (the config casts through `globalThis` so `svelte-check`, running under Node, doesn't crash on a missing `Bun` global). |
| `PUBLIC_BASE_AUTH_URL` | `http://localhost:5001` | Must match wherever `auth-service` is actually running — the README's mention of 3001 is stale. |
| `PUBLIC_BASE_AUTH_PATH` | `/` | |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/postgres` | Not read directly by this app's own source, but required transitively by `@pocket-dimension/db`; also gates whether `scripts/deploy-build.sh` runs migrations at build time. |
| `BETTER_AUTH_SECRET` | *(set a value)* | Must be **identical** to `auth-service`'s value and every other frontend app's, or sessions won't validate. |
| `BETTER_AUTH_URL` | `http://localhost:5001` | |
| `BETTER_AUTH_PATH` | `/` | |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:5001,http://localhost:3005` | Must include this app's own origin. |
| `BETTER_AUTH_COOKIE_DOMAIN` | `localhost` | |
| `RESEND_API_KEY` | *(placeholder, e.g. `re_placeholder_local_dev_only`)* | Must be **non-empty** or `auth-service` crashes at module load (`shared/auth/src/lib/emails.ts` constructs the Resend client eagerly). Watchlist-style placeholder is fine — signup/account-creation works without real delivery. |
| `RESEND_FROM_EMAIL` | `noreply@example.com` | Unused by this app directly. |
| `BODY_SIZE_LIMIT` | `10M` | **Must be raised** from the default adapter limit (512K) for large multi-year PDF statement uploads — explicitly called out in `IMPORT.md` issue #4 and the `.env.example` comment. |
| `ORIGIN` | *(unset locally; required in prod)* | Needed behind a reverse proxy for correct redirect/link generation. |
| `RAILPACK_CONFIG_FILE` / `RAILPACK_BUILD_CMD` / `RAILPACK_START_CMD` | — | Deploy-only, meant for the monorepo-root env, not local dev — see [deployment-guide.md](./deployment-guide.md). |

## Running

```bash
bun run dev:app:chhan-chhan    # from repo root — Turbo filter, port 3005
# or, from apps/chhan-chhan:
bun run dev
```

Visit `http://localhost:3005`. Every page under `(protected)/app` requires a session and a verified email; unverified users are redirected to `/check-email?reason=verify`. Signup works without real email delivery (the verification email send is fire-and-forget); to actually reach `/app` locally, flip `email_verified` directly in the `auth.user` table.

## Type checking / linting

```bash
cd apps/chhan-chhan
bun run check          # svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
bun run check:watch    # same, in watch mode
```

`bun run check` currently passes cleanly per the deep-dive review. Root-level lint caveats (Prettier flagging built `dist/` files under a subdir check, a few committed markdown files under `format:check`) apply here too — see root `AGENTS.md`.

## Tests

```bash
cd apps/chhan-chhan
bun test src/lib/importers/    # importer unit tests (kotak-pdf, icici-pdf, hdfc-pdf)
bun test src/lib/finance/      # finance helper tests (bill-categories, billing, dashboard-widgets, filter-params, merchant-match, transaction-search)
```

There is no test runner wired into `package.json`'s `scripts` — tests are run ad-hoc via `bun test` per `IMPORT.md`. The 2,446-LOC ledger page (`(protected)/app/+page.svelte`) and the 946-LOC Control page have **no automated test coverage at all**; correctness there currently relies on `bun run check` (types) plus manual QA.

## Building

```bash
bun run build:app:chhan-chhan   # from repo root (requires build:shared:* to have run first)
# or, from apps/chhan-chhan, after shared packages are built:
bun run build
bun run start                    # bun ./build/index.js
bun run start:local               # bun --env-file=.env ./build/index.js
```

## Common local pitfalls

- **Stale shared package types/behavior:** if you edit `shared/db/src/schema/chhanchhan.ts` or `shared/auth`, re-run the relevant `bun run build:shared:*` before `bun run dev:app:chhan-chhan` picks it up — dev mode does not watch/rebuild the workspace packages automatically.
- **`vite-kysely-compat.ts`:** don't remove or relocate this file or its import in `vite.config.ts` — the Dockerfile has a fail-fast guard step that checks for it explicitly, because a stale Docker layer with the old `../../vite-kysely-compat` import path is a documented historical footgun (see `apps/chhan-chhan/DEPLOY.md`).
- **Session not persisting in the browser locally:** Better Auth cookies are `secure: true`/`sameSite: "none"`; many browsers refuse to persist them over plain `http://localhost`. Signup/API calls still succeed; verify via the DB (`email_verified` flip) rather than relying on browser session persistence for manual auth-flow testing.
- **Default account is alphabetical, not "primary."** If you create a second finance account for testing multi-account behavior via `POST /api/accounts`, be aware `getOrCreateDefaultAccount` (used by every page and every Control action) resolves to whichever account sorts first by name — not the one you just created, and not necessarily the one you expect. See [project-context.md](./project-context.md).
- **Large PDF/CSV uploads failing silently:** confirm `BODY_SIZE_LIMIT=10M` (or larger) is set — the default SvelteKit/adapter limit (512K) rejects most real multi-page bank statement PDFs.
- **Reset + reimport a statement:** `cd apps/chhan-chhan && bun --env-file=.env scripts/dedupe-transactions.ts <account-id> file.pdf --reset` — useful when iterating on an importer parser against a real statement.

## Deploying

See [deployment-guide.md](./deployment-guide.md) for the full Dockerfile/Railpack walkthrough; the short version is: build from the **monorepo root**, not `apps/chhan-chhan`, because of the `workspace:*` dependencies on `@pocket-dimension/{auth,db,utils}`.
