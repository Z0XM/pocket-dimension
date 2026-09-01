# Project Overview — `@pocket-dimension/db`

Central Drizzle ORM client, merged schema, and SQL migrations for every app schema.

| Field | Value |
| --- | --- |
| Type | library |
| Dialect | PostgreSQL |
| Migrations | `shared/db/migrations/` (~33 SQL files) |
| Runtime deps | drizzle-orm, pg, zod, `@pocket-dimension/utils`, better-auth (declared) |

## Consumers

`shared/auth`, `apps/auth-service`, `apps/watchlist`, `apps/howwasyourday`, `apps/chhan-chhan`, `apps/me-via-you`, `apps/zeo`, `scripts` (devDependency for seed/ETL).

**Not used by:** pocket, markitdown, dashboard, rhymes, heimdall, zeo-music-worker.
