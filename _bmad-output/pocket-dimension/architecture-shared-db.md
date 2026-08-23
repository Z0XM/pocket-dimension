# Architecture — shared-db

**Type:** library  
**Path:** `shared/db`  
**Package:** `@pocket-dimension/db`

## Executive Summary

The only database package in the monorepo. Lazy Drizzle + `pg` Pool, snake_case, one `schema` object that merges every app’s tables. Requires PostgreSQL 18+ for `uuidv7()`.

## Technology Stack

| Category | Technology | Justification |
| --- | --- | --- |
| ORM | Drizzle 0.45 | Typed SQL, Kit migrations |
| Driver | pg 8.16 | Node-compatible pool (Bun) |
| DB | PostgreSQL 18+ | Native `uuidv7()` |

## Architecture Pattern

Data-access library. Apps import `db` and `schema`; they do not open their own pools.

## Data Architecture

See [data-models.md](./data-models.md). Named schemas isolate apps while sharing `auth.user`.

## Entry

- `src/index.ts` — `db`, `schema`
- `src/lib/db.ts` — lazy Proxy singleton
- `src/lib/env.ts` — `DATABASE_URL`
- `drizzle.config.ts` — Kit

## Development

`bun run db:generate` / `db:migrate` / `db:studio` from repo root.

## Testing

None in-package.
