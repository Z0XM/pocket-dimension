# Data Models — Pocket Dimension (map)

Single Postgres database. Tables live in **named schemas**, not `public`. Authority and migrations: `@pocket-dimension/db` — see [`../shared-db/`](../shared-db/).

| PG schema | Package file | Used by |
| --- | --- | --- |
| `auth` | `shared/db/src/schema/auth.ts` | auth-service, all auth-backed apps |
| `watchlist` | `watchlist.ts` | watchlist |
| `howwasyourday` | `howwasyourday.ts` | howwasyourday |
| `chhanchhan` | `chhanchhan.ts` | chhan-chhan |
| `meviayou` | `meviayou.ts` | me-via-you |
| `zeo` | `zeo.ts` | zeo (+ music worker coordination tables as defined there) |

## Shared column helpers

From `shared/db/src/schema/common.ts`:

- `id` — UUID PK default `uuidv7()` (**PG18+**)
- `timestamps` — `created_at` / `updated_at`
- `actionsByUser` — `created_by_id` / `updated_by_id` → `auth.user`

## Access pattern

```ts
import { db, schema } from "@pocket-dimension/db";
```

Do not add a second ORM client or parallel migration path in apps.
