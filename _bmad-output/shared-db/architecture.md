# Architecture — `@pocket-dimension/db`

## Public API

```ts
import { db, schema } from "@pocket-dimension/db";
```

Only **`db`** and **`schema`** are exported. `env` is package-internal.

## Client (`src/lib/db.ts`)

- Lazy singleton: first property access on `db` Proxy creates `pg.Pool({ connectionString })` + `drizzle(pool, { schema, casing: "snake_case" })`.
- Defers env validation and pool open until first use (unlike auth’s eager import).
- Default `pg.Pool` options (no custom SSL/size).
- Functions are auto-bound through the Proxy.

## Env (`src/lib/env.ts`)

- Schema: `{ DATABASE_URL: z.url() }` + inherited `NODE_ENV`.
- Lazy Proxy around `validateEnv("db", …)`.

## Drizzle kit (`drizzle.config.ts`)

| Key | Value |
| --- | --- |
| `out` | `./migrations` |
| `schema` | auth, watchlist, howwasyourday, chhanchhan, meviayou, zeo (not `common.ts`) |
| `dialect` | postgresql |
| `casing` | snake_case |
| credentials | `env.DATABASE_URL` |

## Schema merge (`src/schema/index.ts`)

Combines auth + watchlist + howwasyourday + chhanChhan + meViaYou + zeo namespaces into one `schema` object.

## Build

```bash
bun run build:shared:db
# externals: drizzle-orm, pg, zod, @pocket-dimension/utils, better-auth
```

`types` point at `./src/index.ts`; `main` at `./dist/index.js`.

## Scripts note

`auth:generate` points at missing `./src/lib/auth.ts` — **stale**. Use `shared/auth` `auth:generate` instead.
