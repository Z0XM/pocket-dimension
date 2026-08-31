# Architecture — `@pocket-dimension/db`

## Purpose

Central Drizzle ORM client, merged schema, and SQL migrations for every app schema in the monorepo.

## Stack

| Item | Value |
| --- | --- |
| ORM | Drizzle (`drizzle-orm` + `pg` Pool) |
| Casing | `snake_case` |
| Config | `shared/db/drizzle.config.ts` |
| Migrations | `shared/db/migrations/` |

## Public API

`shared/db/src/index.ts` exports:

| Export | Role |
| --- | --- |
| `db` | Lazy Proxy → `NodePgDatabase` |
| `schema` | Merged table/relation object |

```ts
import { db, schema } from "@pocket-dimension/db";
```

## Schema layout

| File | PG schema | Highlights |
| --- | --- | --- |
| `schema/common.ts` | — | `id` (`uuidv7()`), `timestamps`, `actionsByUser` |
| `schema/auth.ts` | `auth` | `user`, `session`, `account`, `verification`, `user_role` |
| `schema/watchlist.ts` | `watchlist` | items, tags, ratings, views, preferences |
| `schema/howwasyourday.ts` | `howwasyourday` | day data, push subscriptions |
| `schema/chhanchhan.ts` | `chhanchhan` | accounts, transactions, budgets, tags, refunds, … |
| `schema/meviayou.ts` | `meviayou` | forms, answers |
| `schema/zeo.ts` | `zeo` | rooms, participants, chat, waiting, game/listening tables, operator settings |

Env: lazy `DATABASE_URL` validation via `@pocket-dimension/utils`.

## Commands

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```

## Consumers

`shared/auth`, auth-service, watchlist, howwasyourday, chhan-chhan, me-via-you, zeo.

## Build

```bash
bun run build:shared:db
```

Externals include `drizzle-orm`, `pg`, `zod`, `@pocket-dimension/utils`.
