# shared-db — Project Context

**Package:** `@pocket-dimension/db`  
**Path:** `shared/db`

## Rules

- **PostgreSQL 18+** required — primary keys default to `uuidv7()`.
- One Drizzle client and one migrations folder for the whole monorepo. Do not add per-app ORMs or migration runners.
- Put new tables in the correct **named schema** file under `src/schema/` (`auth`, `watchlist`, `howwasyourday`, `chhanchhan`, `meviayou`, `zeo`).
- Reuse `id`, `timestamps`, and `actionsByUser` from `schema/common.ts`.
- Apps import `{ db, schema }` only from `@pocket-dimension/db` after shared build.
- `DATABASE_URL` lives in `shared/db/.env` (and consumers that need the pool).
- Generate/migrate from repo root: `bun run db:generate` / `bun run db:migrate` / `bun run db:studio`.

## Anti-patterns

- Creating tables in `public`
- Calling `uuid_generate_v4()` / random UUIDs instead of `uuidv7()` without an explicit decision
- Importing unbuilt TypeScript entry from apps in production paths (use workspace package → `dist/`)
