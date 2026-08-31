# Development Guide — `@pocket-dimension/db`

## Setup

```bash
# shared/db/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

sudo pg_ctlcluster 18 main start
bun run build:shared:db
bun run db:migrate
bun run db:studio    # optional UI
```

## Generate after schema edits

```bash
bun run db:generate
bun run db:migrate
```

Keep `casing: "snake_case"` identical in `drizzle.config.ts` and `lib/db.ts`.

## Adding a table

1. Edit the correct `src/schema/<app>.ts` under the right `pgSchema(...)`.
2. Reuse `id` / `timestamps` / `actionsByUser` when appropriate.
3. Export through `schema/index.ts` if adding a new file (also add to `drizzle.config.ts` schema array).
4. Generate + migrate.
5. Rebuild package before apps import new columns.

## Lazy client reminder

Importing `@pocket-dimension/db` does **not** require `DATABASE_URL` until `db` is first used. Drizzle-kit CLI commands do need `DATABASE_URL` at invocation.

## Typecheck / lint

```bash
cd shared/db
bun run typecheck   # tsgo
bun run lint
```
