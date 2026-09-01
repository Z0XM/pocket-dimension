# shared-db — Project Context

**Package:** `@pocket-dimension/db`  
**Path:** `shared/db`

## Rules

- **PostgreSQL 18+** required — PKs default to `uuidv7()`.
- One Drizzle client and one migrations folder for the whole monorepo.
- Put new tables in the correct **named schema** file under `src/schema/`.
- Reuse `id`, `timestamps`, and `actionsByUser` from `schema/common.ts`.
- Keep `casing: "snake_case"` in sync between `drizzle.config.ts` and `lib/db.ts`.
- Apps import `{ db, schema }` only — `env` is internal.
- `DATABASE_URL` in `shared/db/.env` (and consumers that open the pool).
- Generate/migrate from root: `bun run db:generate` / `db:migrate` / `db:studio`.

## Anti-patterns

- Tables in `public`
- Second ORM / migration runner in an app
- Assuming `updatedAt` is set on insert (`$onUpdate` only)
- Relying on `auth:generate` in this package (`./src/lib/auth.ts` is stale — use `shared/auth`)
