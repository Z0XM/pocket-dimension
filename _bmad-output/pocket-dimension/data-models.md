# Data Models — Pocket Dimension (map)

Single Postgres database. Tables live in **named schemas**, not `public`. Authority: `@pocket-dimension/db` — full inventory in [`../shared-db/data-models.md`](../shared-db/data-models.md).

| PG schema | File | Used by |
| --- | --- | --- |
| `auth` | `schema/auth.ts` | auth-service, all auth-backed apps |
| `watchlist` | `watchlist.ts` | watchlist |
| `howwasyourday` | `howwasyourday.ts` | howwasyourday |
| `chhanchhan` | `chhanchhan.ts` | chhan-chhan |
| `meviayou` | `meviayou.ts` | me-via-you |
| `zeo` | `zeo.ts` | zeo |

## Shared column helpers (`schema/common.ts`)

- `id` — UUID PK default `uuidv7()` (**PG18+**)
- `timestamps` — `created_at` / `updated_at` (`updatedAt` has `$onUpdate` only — may be null until first update)
- `actionsByUser` — `created_by_id` (required) / `updated_by_id` (optional) → `auth.user`

## Access

```ts
import { db, schema } from "@pocket-dimension/db";
```

Do not add a second ORM or migration path in apps. ~33 migrations under `shared/db/migrations/`.
