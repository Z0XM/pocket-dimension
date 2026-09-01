# Feature Registry — `@pocket-dimension/db`

Brownfield capability inventory for `shared/db`. Derived from deep scan 2026-08-31 — see [architecture.md](./architecture.md), [data-models.md](./data-models.md).

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Lazy Drizzle client | n/a | Platform | Epic 1 | Live |
| F-2 | Env validation (DATABASE_URL) | n/a | Platform | Epic 1 | Live |
| F-3 | Named-schema merge | n/a | Platform | Epic 1 | Live |
| F-4 | Common id / timestamp helpers | n/a | Platform | Epic 1 | Live |
| F-5 | Auth schema | n/a | Platform | Epic 1 | Live |
| F-6 | App schemas (watchlist…zeo) | n/a | Platform | Epic 1 | Live |
| F-7 | SQL migrations | n/a | Platform | Epic 1 | Live |
| F-8 | Package build & exports | n/a | Platform | Epic 1 | Live |

## Feature details

### F-1 — Lazy Drizzle client

- **Goal:** Expose a singleton `db` that opens the pool only on first use.
- **Area:** Client
- **Includes:**
  - `pg.Pool` + `drizzle(pool, { schema, casing: "snake_case" })` behind a Proxy
  - Auto-bound functions through the Proxy
- **Deferred:**
  - Custom SSL / pool sizing
- **See also:**
  - [architecture.md](./architecture.md#client-srclibdbts)

### F-2 — Env validation (DATABASE_URL)

- **Goal:** Require a valid `DATABASE_URL` without validating at import time.
- **Area:** Env
- **Includes:**
  - Lazy Proxy around `validateEnv("db", { DATABASE_URL: z.url() })`
  - Inherits `NODE_ENV` from `@pocket-dimension/utils`
- **Deferred:**
  - None currently.
- **See also:**
  - `_bmad-output/shared-utils/FEATURE-REGISTRY.md`

### F-3 — Named-schema merge

- **Goal:** Merge all app schemas into one export for Drizzle and migrations.
- **Area:** Schema
- **Includes:**
  - `schema/index.ts` combines auth, watchlist, howwasyourday, chhanChhan, meViaYou, zeo
  - Public API: `import { db, schema } from "@pocket-dimension/db"`
- **Deferred:**
  - Per-app schema packages (single merge remains intentional)
- **See also:**
  - [data-models.md](./data-models.md)

### F-4 — Common id / timestamp helpers

- **Goal:** Standardize primary keys and audit columns across tables.
- **Area:** Schema
- **Includes:**
  - `id` defaulting to native PG `uuidv7()` (requires PostgreSQL 18+)
  - `timestamps`, `actionsByUser` → `auth.user`
- **Deferred:**
  - None currently.
- **See also:**
  - [data-models.md](./data-models.md)

### F-5 — Auth schema

- **Goal:** Persist Better Auth users, sessions, accounts, and verification tokens.
- **Area:** Schema
- **Includes:**
  - `user_role` enum; `user`, `session`, `account`, `verification` tables
  - Relations user 1–N session/account
- **Deferred:**
  - None currently.
- **See also:**
  - `_bmad-output/shared-auth/` (adapter config)

### F-6 — App schemas (watchlist…zeo)

- **Goal:** Own named Postgres schemas for each auth-backed product app.
- **Area:** Schema
- **Includes:**
  - `watchlist`, `howwasyourday`, `chhanchhan`, `meviayou`, `zeo` schema modules
  - Enums, tables, and relations as documented in [data-models.md](./data-models.md)
- **Deferred:**
  - Fix non-FK uuid conventions / missing `relations()` blocks where noted
- **See also:**
  - Peer app module docs under `_bmad-output/watchlist/`, `chhan-chhan/`, `zeo/`

### F-7 — SQL migrations

- **Goal:** Version and apply schema changes with drizzle-kit.
- **Area:** Migrations
- **Includes:**
  - `shared/db/migrations/` (~33 SQL files) + `migrations/meta/`
  - `drizzle.config.ts` dialect postgresql, snake_case
  - Apply via `bun run db:migrate` on PG18+
- **Deferred:**
  - Rename early migration filenames that contain spaces
- **See also:**
  - [development-guide.md](./development-guide.md)

### F-8 — Package build & exports

- **Goal:** Ship ESM `dist/` for workspace consumers.
- **Area:** Package
- **Includes:**
  - Externals: drizzle-orm, pg, zod, utils, better-auth
  - Scripts: build, migrate helpers, typecheck
- **Deferred:**
  - Remove stale `auth:generate` script pointing at missing `./src/lib/auth.ts`
- **See also:**
  - [architecture.md](./architecture.md#build)
