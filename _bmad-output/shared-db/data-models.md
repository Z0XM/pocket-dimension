# Data Models — `@pocket-dimension/db`

All tables use named PG schemas. Helpers from `schema/common.ts`: `id` (`uuidv7()`), `timestamps`, `actionsByUser` → `auth.user`.

## `auth` — `schema/auth.ts`

| Object | Notes |
| --- | --- |
| enum `user_role` | `user` \| `contributor` \| `admin` |
| `user` | id, timestamps, name, email (unique), emailVerified, image, username (unique), displayUsername, role |
| `session` | userId→user cascade, token unique, expiresAt, ip/ua; idx userId |
| `account` | OAuth/password fields; userId→user; idx userId |
| `verification` | identifier, value, expiresAt; idx identifier |
| Relations | user 1–N session/account |

Better Auth drizzle adapter maps here. `generateId: false` in auth package → DB `uuidv7()`.

## `watchlist` — `schema/watchlist.ts`

Enums: item type, release status, recommendation, progress status.

Tables: `watch_items`, `watch_tags`, `watch_languages`, `watch_item_tags` (unique pair), `watch_item_ratings` (unique item+user), `watchlist_views`, `user_rating_preferences`. Most use `actionsByUser` + relations to `auth.user`.

## `howwasyourday` — `schema/howwasyourday.ts`

| Table | Notes |
| --- | --- |
| `day_data` | metadata json, day_int, user_id — **user_id has no `.references()` FK** |
| `push_subscription` | userId→auth.user, endpoint keys, timezone, reminderTime |

No `relations()` block.

## `chhanchhan` — `schema/chhanchhan.ts`

Enums: member role, transaction type, budget period, goal status.

Tables: `finance_accounts`, `finance_account_members`, `finance_categories` (`parentCategoryId` **no FK**), `finance_transactions`, `finance_budgets`, `finance_goals`, `finance_tags`, join tables for tags/groups/refund links. Full relations graph including refund link disambiguation.

## `meviayou` — `schema/meviayou.ts`

| Table | Notes |
| --- | --- |
| `forms` | userId→user, question, classification, status, publicSlug unique |
| `answers` | formId→forms; createdAt only (no updatedAt); no relations() |

## `zeo` — `schema/zeo.ts`

Largest schema: rooms, participants, session blocks, chat, waiting entries, game sessions/teams/participants/rounds/suggestions/votes, room_scores, youtube_account_links, listening sessions/queue, operator_settings.

Notable: partial unique indexes for one active game/listening session per room; some uuid columns without FK (`lockedSuggestionId`, `currentQueueItemId`). **No `relations()` block** — apps query manually.

## Known gaps / inconsistencies

- Non-FK uuid columns by convention only (howwasyourday day_data.user_id, category parent, zeo suggestion/queue refs).
- `updatedAt` may be null until first update.
- Early migration filenames contain spaces (drizzle-kit naming).

## Migrations

~33 SQL files `0000_…` … `0032_…` + `migrations/meta/`. Apply with PG18+ and `bun run db:migrate`.
