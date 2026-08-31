# Data Models — `watchlist`

Monorepo-wide schema reference: [`../shared-db/data-models.md`](../shared-db/data-models.md). This doc covers only the `watchlist` Postgres schema (`shared/db/src/schema/watchlist.ts`, `pgSchema("watchlist")`) and exactly which `apps/watchlist` files touch each table/enum. All tables use the `id`/`timestamps`/`actionsByUser` helpers from `shared/db/src/schema/common.ts` (`uuidv7()` PK, `createdAt`/`updatedAt`, `createdById`/`updatedById` → `auth.user`, PostgreSQL **18+** required).

## Enums

| Enum | Values | Used by app code? |
| --- | --- | --- |
| `watch_item_type` | `movie`, `series`, `shorts` | Yes — `type` column on `watch_items`; filter/sort/edit everywhere (`columns.ts`, `bulk-update`, `leaderboard`, `dashboard`). |
| `watch_progress_status` | `watch_later`, `watching`, `watched`, `dropped` | Yes — `progress_status` on `watch_item_ratings`; core to filtering, editing, and the "ratings only for watched/dropped" business rule. The client-side/UI concept of `unmarked` (no rating row at all) is **not** a DB enum value — it's synthesized in queries (`is null` checks) and dashboards. |
| `watch_item_release_status` | `released`, `on-going`, `coming-soon` | **No.** Column exists (`release_status` on `watch_items`, default `released`) but no app file (`+server.ts`, `+page.server.ts`, `src/lib/server/*`, `columns.ts`) selects, filters, or edits it. |
| `watch_recommendations` | `must_watch`, `go_for_it`, `one_time_watch`, `skip_it` | **No.** Column exists (`recommendation` on `watch_item_ratings`) but is never read or written by any route/lib in `apps/watchlist`. |

## Tables

### `watch_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `uuidv7()` |
| `title` | text, **unique** | `watch_items_title_unique` — enforced app-side too (`validate-title` endpoint, `processNewItem`'s pre-check + DB-error fallback) |
| `type` | `watch_item_type` | not null |
| `seasons` | integer, nullable | **Unused by the app** — declared on the `Watchlist` TS type in `columns.ts` but never selected/edited anywhere |
| `language_id` | uuid → `watch_languages.id`, `ON DELETE CASCADE` | not null |
| `release_status` | `watch_item_release_status`, default `released` | Unused by the app (see enum table above) |
| `order` | serial | Drives the default table sort (`order desc nulls last`) and the `order` column |
| `created_by_id`/`updated_by_id` | uuid → `auth.user.id` | from `actionsByUser` |

**Touched by:** `src/lib/server/watchlist.ts` (`getWatchlistForUser` — select/filter/sort), `(public)/+page.server.ts` (facet queries for filter dropdowns), `api/watchlist/bulk-update/+server.ts` (insert/update/delete), `api/watchlist/validate-title/+server.ts` (uniqueness check), `src/lib/server/dashboard.ts` (KPI/breakdown aggregates), `src/lib/server/leaderboard.ts` (joined for type/language filters).

### `watch_languages`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `language` | text, **unique** | `watch_languages_language_unique` |

**Touched by:** `getWatchlistForUser` (join for the `language` column and language filter), `(public)/+page.server.ts` (distinct-value queries for the language filter dropdown and edit-mode's "all languages" option list), `bulk-update` (`languageId` on create/update — no server-side FK-existence validation beyond the DB constraint itself), `dashboard.ts`/`leaderboard.ts` (breakdowns/filters). No endpoint currently *creates* a language row — new languages must be inserted directly (e.g. via `db:studio` or a script); the app only ever reads/references existing `watch_languages` rows by id.

### `watch_tags`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | text, **unique** | `watch_tags_name_unique` |

**Touched by:** `bulk-update`'s `addTagToItem` helper (get-or-create-by-name — the only place tags are created), `getWatchlistForUser`'s `connectedTagsQuery` CTE (joined via `watch_item_tags`, aggregated into a comma-joined `tags` string per item with `string_agg`), `(public)/+page.server.ts` (distinct tag list for filters/edit dropdowns), `dashboard.ts` (top-15 tags), `leaderboard.ts` (tag filter, `EXISTS` subquery per selected tag).

### `watch_item_tags` (join table)

| Column | Type | Notes |
| --- | --- | --- |
| `watch_item_id` | uuid → `watch_items.id`, `ON DELETE CASCADE` | |
| `watch_tag_id` | uuid → `watch_tags.id`, `ON DELETE CASCADE` | |
| unique | `(watch_item_id, watch_tag_id)` | `watch_item_tags_watch_item_id_watch_tag_id_unique` — prevents duplicate links; `addTagToItem` checks for an existing link before inserting |

**Touched by:** `bulk-update` (`addTagToItem` insert, tag-removal delete-by-`inArray`), `getWatchlistForUser` (join), `dashboard.ts`/`leaderboard.ts` (joins for tag-based aggregation/filtering).

### `watch_item_ratings`

| Column | Type | Notes |
| --- | --- | --- |
| `watch_item_id` | uuid → `watch_items.id`, `ON DELETE CASCADE` | |
| `user_id` | uuid → `auth.user.id`, `ON DELETE CASCADE` | |
| `rating` | numeric, nullable | 0–10 in practice (app-enforced via UI, not a DB check constraint) |
| `infinity` | boolean, default `false` | Mutually-significant with `rating`/`shitty` in the UI (only one "mode" active at a time), but the DB allows all three set simultaneously — the app's own write path (`bulk-update`) is what keeps them semantically exclusive |
| `shitty` | boolean, default `false` | |
| `recommendation` | `watch_recommendations`, nullable | **Unused by the app** |
| `review` | text, default `""` | **Unused by the app** — no route reads or writes it |
| `progress_status` | `watch_progress_status`, default `"watched"` | |
| `dropped_at_season` / `dropped_at_episode` | integer, nullable | **Unused by the app** |
| unique | `(watch_item_id, user_id)` | `watch_item_ratings_watch_item_id_user_id_unique` — one rating row per user per item; `bulk-update` selects-then-updates-or-inserts against this pair rather than relying on an upsert |

**Touched by:** `getWatchlistForUser` (three CTEs: `global_agg` for the catalog-wide average/infinity/shitty counts, `my_agg` for the current user's own rating, one `user_<username>_agg` per preferred user), `bulk-update`'s `processUpdate`/`processNewItem` (the only write path), `dashboard.ts` (KPIs, histogram, avg-by-type/language, progress breakdown), `leaderboard.ts` (the count-by-metric ranking query joins on this table and filters by `progress_status`).

### `watchlist_views`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid → `auth.user.id`, `ON DELETE CASCADE` | |
| `name` | text | |
| `filters` | json, default `{}` | Arbitrary bag of the seven recognized query-param keys (`filterLanguage`, `filterTags`, `filterProgress`, `filterType`, `sortBy`, `sortOrder`, `q`) — not validated against a schema beyond key allow-listing in the API handlers |
| `is_favorite` | boolean, default `false` | Server-enforced max of **3** favorites per user (oldest by `favorite_date` is evicted) |
| `favorite_date` | timestamp, nullable | |
| unique | `(user_id, name)` | `watchlist_views_user_id_name_unique` — per-user view names must be distinct; violating this returns `409` from the API, not a raw DB error |

**Touched by:** `api/views/+server.ts` (GET list, POST create — max 10 per user enforced in application code, not a DB constraint), `api/views/[viewName]/+server.ts` (PUT rename/update-filters/favorite-toggle, DELETE). Consumed exclusively by `overlay.svelte` (the saved-views nav UI) — no page-load function reads this table directly.

### `user_rating_preferences`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid → `auth.user.id`, `ON DELETE CASCADE` | the viewer |
| `preferred_user_id` | uuid → `auth.user.id`, `ON DELETE CASCADE` | whose ratings to show as extra columns |
| unique | `(user_id, preferred_user_id)` | `user_rating_preferences_user_id_preferred_user_id_unique` |

**Touched by:** `api/user-rating-preferences/+server.ts` (GET/POST — POST does a full delete-then-reinsert per save, not an incremental diff), `api/watchlist/+server.ts` (reads the current user's preferences to decide which `user_<username>_agg` CTEs to build), `(public)/+page.server.ts` (same lookup, server-rendered on first load so SSR includes the dynamic columns immediately).

## Relations

`shared/db/src/schema/watchlist.ts` defines a full `relations()` graph (`watchItemRelations`, `watchItemTagRelations`, `watchItemRatingRelations`, `watchTagRelations`, `watchLanguageRelations`, `userRatingPreferencesRelations`) — but **no file in `apps/watchlist` uses Drizzle's relational query API** (`db.query.watchItems.findMany({ with: ... })` etc.). Every read in this app is either a plain Drizzle query-builder call (`db.select().from(...).where(...)`) or, for the table/dashboard/leaderboard, a hand-written `sql\`...\`` template with explicit `JOIN`s. The `relations()` exports exist for potential future use or other consumers, not because `watchlist` relies on them.

## Notable app-level facts not visible from the schema alone

- The home table's SQL query dynamically builds one extra CTE (`user_<safe_username>_agg`) and two extra `SELECT`/`ORDER BY` fragments **per preferred user**, with usernames sanitized to `[a-zA-Z0-9_]` for use as raw SQL identifiers (`sql.raw(...)`) — see `getWatchlistForUser` in `src/lib/server/watchlist.ts`.
- "Unmarked" (no `watch_item_ratings` row for the current user) is a derived UI/query concept, not a `watch_progress_status` enum value — represented as `mr.my_progress_status is null` in SQL and as a synthesized `unmarked` bucket in `dashboard.ts`'s progress breakdown.
- Deleting a `watch_items` row cascades to `watch_item_ratings` and `watch_item_tags` automatically via FK `ON DELETE CASCADE` — `processDelete` in `bulk-update` only issues one `DELETE FROM watch_items`.
