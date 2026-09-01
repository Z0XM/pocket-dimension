# API Contracts — `watchlist`

Every HTTP endpoint under `apps/watchlist/src/routes/api/**`. All handlers import `{ db, schema }` from `@pocket-dimension/db` and read `locals.user`/`locals.session` populated by `src/hooks.server.ts` (see [architecture.md](./architecture.md)). None of these routes are called cross-origin from other apps — they're consumed only by this app's own Svelte components/pages.

---

## `GET /api/dashboard`

**File:** `src/routes/api/dashboard/+server.ts`
**Auth:** None required. `locals.user?.id` is passed through and only affects whether `scope=personal` returns personalized data (falls back to `catalog` behavior if no user).

**Query params:**
| Param | Type | Notes |
| --- | --- | --- |
| `scope` | `"catalog" \| "personal"` | Any other/missing value is treated as `"catalog"`. |

**Response `200`:** `DashboardData` (see `src/lib/server/dashboard.ts`):
```ts
{
  scope: "catalog" | "personal",
  kpis: {
    totalTitles: number; movies: number; series: number; shorts: number;
    languages: number; tags: number; avgRating: number | null; totalRatings: number;
    // only present when scope resolves to "personal" (requires a logged-in user):
    watched?: number; watchLater?: number; watching?: number; dropped?: number;
    unmarked?: number; myAvgRating?: number | null; myInfinity?: number; myShitty?: number;
  },
  typeBreakdown: { label: string; count: number }[],
  languageBreakdown: { label: string; count: number }[],
  topTags: { label: string; count: number }[],           // top 15
  progressBreakdown: { label: string; count: number }[],
  progressByType: { type: string; status: string; count: number }[],
  ratingHistogram: { bucket: number; count: number }[],   // 0.5-wide buckets
  avgRatingByType: { label: string; avgRating: number | null }[],
  avgRatingByLanguage: { label: string; avgRating: number | null }[],
}
```

**Errors:** No explicit try/catch in the handler itself — an unhandled DB error propagates as a SvelteKit 500. (The page consuming this, `(public)/dashboard/+page.server.ts`, wraps its own call to `getDashboardData` in try/catch and falls back to a null dashboard; this raw API route does not.)

---

## `GET /api/leaderboard`

**File:** `src/routes/api/leaderboard/+server.ts`
**Auth:** None required.

**Query params** (parsed by the shared `parseLeaderboardParams`, `src/lib/leaderboard.ts`):
| Param | Type | Notes |
| --- | --- | --- |
| `metric` | `"watched" \| "watching" \| "watch_later" \| "dropped" \| "all_rated"` | Defaults to `"watched"` if missing/invalid. |
| `filterLanguage` | comma-separated string | Language names. |
| `filterType` | comma-separated string | `movie`/`series`/`shorts`. |
| `filterTags` | comma-separated string | Tag names. |

**Response `200`:** `LeaderboardData`:
```ts
{
  metric: LeaderboardMetric,
  filters: { languages: string[]; types: string[]; tags: string[] },
  entries: { rank: number; userId: string; username: string; displayUsername: string | null; name: string; count: number }[], // top 50
  filterOptions: { languages: string[]; types: string[]; tags: string[] }, // all distinct values, for populating filter UI
}
```

**Errors:** No explicit error handling; DB failure propagates as a 500.

---

## `GET /api/user-rating-preferences`

**File:** `src/routes/api/user-rating-preferences/+server.ts`
**Auth:** Required (session only, email verification **not** checked). `401 { error: "Unauthorized" }` if `locals.user` is absent.

**Response `200`:** `{ preferredUserIds: string[] }`
**Errors:** `500 { error: "Failed to fetch preferences" }` on DB failure (logged via `console.error`).

## `POST /api/user-rating-preferences`

**Auth:** Required (session only). `401` if unauthenticated.

**Body:** `{ preferredUserIds: string[] }` — `400 { error: "preferredUserIds must be an array" }` if not an array.

**Behavior:** Deletes all existing preference rows for the current user, then bulk-inserts the new list. The current user's own ID is filtered out defensively before insert (self-comparison ratings aren't a supported feature).

**Response `200`:** `{ success: true }`
**Errors:** `401` (no session), `400` (bad body shape), `500 { error: "Failed to save preferences" }`.

---

## `GET /api/users`

**File:** `src/routes/api/users/+server.ts`
**Auth:** Required (session only). `401` if unauthenticated.

**Response `200`:** `{ users: { id: string; username: string }[] }` — every `auth.user` row with a non-null `username`, excluding the current caller. Used to populate `user-rating-selector.svelte`'s "compare ratings with" picker.

**Errors:** `500 { error: "Failed to fetch users" }`.

---

## `GET /api/views`

**File:** `src/routes/api/views/+server.ts`
**Auth:** Required + `locals.user.emailVerified` must be `true`. `401` if unauthenticated, `403 { error: "Email not verified. Please verify your email to access views." }` if not verified.

**Response `200`:** `{ views: View[] }`, ordered by `isFavorite desc, favoriteDate desc, createdAt desc`, where:
```ts
type View = {
  id: string; name: string;
  href: string;              // "/" + querystring rebuilt from the stored `filters` JSON
  isFavorite: boolean; favoriteDate: string | null;
  createdAt: string; updatedAt: string;
}
```
The stored `filters` JSON (arbitrary `Record<string, unknown>`) is converted back into a URL query string via a local `filtersToUrl` helper recognizing `filterLanguage`, `filterTags`, `filterProgress`, `filterType`, `sortBy`, `sortOrder`, `q`.

**Errors:** `500 { error: "Failed to fetch views" }`.

## `POST /api/views`

**Auth:** Same as GET (session + verified email).

**Query params (not body):** the endpoint reads the *creating page's current URL* query string — `filterLanguage`, `filterTags`, `filterProgress`, `filterType`, `sortBy`, `sortOrder`, `q` — and snapshots whichever are present into the new view's `filters` JSON column.

**Behavior:**
- Rejects with `400 { error: "Maximum of 10 views allowed" }` if the user already has ≥ 10 views.
- Auto-generates a name: `"View 1"`, `"View 2"`, … (first unused number).
- Inserts a `watchlistViews` row (`isFavorite: false`).

**Response `200`:** `{ view: View }` (same shape as GET, `href` built from the just-saved filters).
**Errors:** `401`, `403` (unverified), `400` (limit reached), `409 { error: "View name already exists" }` (unique-constraint race), `500 { error: "Failed to create view" }`.

---

## `PUT /api/views/[viewName]`

**File:** `src/routes/api/views/[viewName]/+server.ts`
**Auth:** Required + verified email. `viewName` path param required (`400` if empty, though SvelteKit routing makes this effectively unreachable).

**Body (JSON, all optional):**
```ts
{ name?: string; setFavorite?: boolean; filters?: Record<string, unknown> }
```

**Behavior:**
- **404** `{ error: "View not found" }` if no view with that name exists for the current user.
- **Rename:** if `name` differs from the current name, checks for a name collision first (`409` if taken by a different view).
- **Filters:** if `filters` is present in the body, only the seven known keys (`filterLanguage`, `filterTags`, `filterProgress`, `filterType`, `sortBy`, `sortOrder`, `q`) are copied through (`400 { error: "Filters must be an object" }` if `filters` is present but not a plain object). If `filters` is **absent from the body**, the handler falls back to reading the same seven keys from the **request URL's query string** instead (kept for parity with the `POST` creation flow) — only updates `filters` if at least one of those seven is present in the URL.
- **Favorites:** `setFavorite: true` marks the view favorite and sets `favoriteDate = now()`; if the user already has 3 favorites, the **oldest by `favoriteDate`** is automatically un-favorited to make room (max 3 favorites enforced server-side). `setFavorite: false` clears both `isFavorite` and `favoriteDate`.

**Response `200`:** `{ view: View }`.
**Errors:** `401`, `403` (unverified), `400` (missing viewName / bad filters shape), `404` (view not found), `409` (duplicate rename target), `500 { error: "Failed to update view" }`.

## `DELETE /api/views/[viewName]`

**Auth:** Required + verified email.

**Behavior:** Looks up the view by `(userId, name)` first (`404` if missing), then deletes it.

**Response `200`:** `{ success: true }`.
**Errors:** `401`, `403` (unverified), `400` (missing viewName), `404` (not found), `500 { error: "Failed to delete view" }`.

---

## `GET /api/watchlist`

**File:** `src/routes/api/watchlist/+server.ts`
**Auth:** None required — public catalog read. If `locals.user` is present, the handler additionally fetches that user's "preferred users" (from `user_rating_preferences`) and joins in their ratings as dynamic `user_<username>_rating`/`_infinity`/`_shitty` fields.

**Query params:**
| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | Free-text title search (`ilike '%q%'`, applied server-side in `getWatchlistForUser`). |
| `pageIndex` | number | 0-based; page size is fixed at **25** (hardcoded in `getWatchlistForUser`). |
| `sortBy` | comma-separated string | Column ids: `order`, `title`, `type`, `language`, `my_rating`, `avg_rating`, `my_progress_status`, or `user_<username>_rating`. |
| `sortOrder` | comma-separated string | `asc`/`desc` per corresponding `sortBy` entry (defaults to `asc` if malformed/missing). Multi-column sort is supported; the **last**-specified column becomes the SQL primary sort key (the array is reversed before building `ORDER BY`, so "most recently clicked column wins"). |
| `filterLanguage` | comma-separated string | Language names, case-insensitive exact match (`= any(...)`). |
| `filterTags` | comma-separated string | Tag names, each matched via `ilike '%tag%'` against the item's comma-joined tag string (AND across multiple selected tags). |
| `filterProgress` | comma-separated string | `watch_later`/`watching`/`watched`/`dropped`, plus the special value `unmarked` (items with no rating row for the current user). |
| `filterType` | comma-separated string | `movie`/`series`/`shorts`, case-insensitive. |

**Response `200`:** `{ watchItems: WatchItemRow[] }` — raw SQL rows (`db.execute(...).rows`), shape driven by `getWatchlistForUser`'s `SELECT`: `id, order, title, type, language_id, language, tags (comma string), avg_rating, infinity_counts, shitty_counts, my_rating, my_infinity, my_shitty, my_progress_status`, plus `user_<username>_rating/_infinity/_shitty` triples for each preferred user.

**Errors:** No explicit try/catch around the main `getWatchlistForUser` call (a DB error propagates as a 500); the preferred-users lookup *is* wrapped in try/catch and degrades to an empty preferred-users list on failure rather than failing the whole request.

---

## `POST /api/watchlist/bulk-update`

**File:** `src/routes/api/watchlist/bulk-update/+server.ts`
**Auth:** Required + `locals.user.emailVerified` must be `true`. `401` if unauthenticated, `403 { error: "Email not verified. Please verify your email to make edits." }` if not verified. This is the **single mutation endpoint** for the entire watchlist table — every create, update, and delete from edit mode, the bulk-edit panel, and the "add item" dialog goes through here in one request.

**Body:**
```ts
{
  updates: {
    id: string;
    title?: string; languageId?: string; type?: string;   // contributor/admin only
    addTags?: string[]; removeTags?: string[];             // contributor/admin only
    rating?: number | null; infinity?: boolean; shitty?: boolean; progressStatus?: string | null; // any role, own row
  }[];
  newItems: {
    tempId: string; title: string; languageId: string; type: string;
    tags?: string[]; rating?: number | null; infinity?: boolean; shitty?: boolean; progressStatus?: string | null;
  }[];
  deleteIds: string[];
}
```

**Role enforcement (server-side, the real security boundary):**
- `newItems.length > 0` and role is not `contributor`/`admin` → whole request rejected: `403 { error: "Only contributors and admins can add new items" }`.
- `deleteIds.length > 0` and role is not `admin` → whole request rejected: `403 { error: "Only admins can delete items" }`.
- Any `updates[]` entry touching `title`/`languageId`/`type`/`addTags`/`removeTags` when role is not `contributor`/`admin` → whole request rejected: `403 { error: "Only contributors and admins can edit title, language, type, and tags" }` (this check scans **all** updates before processing any — a single disallowed field anywhere in the batch blocks the entire batch, not just that item).

**Per-item processing (partial success model):** Updates, then new items, then deletes are each processed in a loop; failures for one item are pushed into an `errors[]` array and processing continues for the rest. The overall HTTP response is still `200` even when some/all items failed — check `success`/`errors` in the body, not the status code.

- **`processUpdate`** — validates the item exists (else per-item error "Item not found"); builds a partial `watch_items` update from `title`/`languageId`/`type`; handles the rating/progress upsert against `watch_item_ratings` (validates `progressStatus` is one of `watch_later`/`watching`/`watched`/`dropped`; rejects rating-field-only updates with `field: "my_rating"` error if the effective progress isn't `watched`/`dropped`; auto-clears `rating`/`infinity`/`shitty` when progress moves away from those two values); processes `removeTags` (delete matching `watch_item_tags` rows) then `addTags` (case-insensitive dedup, conflict check against `removeTags`, get-or-create tag via `addTagToItem`).
- **`processNewItem`** — validates `title`/`languageId`/`type` are present (per-field errors otherwise); checks title uniqueness pre-insert and also catches a unique-constraint DB error at insert time (race-condition fallback), both surfacing as `field: "title", message: "A watch item with this title already exists"`; inserts tags via the same `addTagToItem` helper; applies the same watched/dropped-only rating rule as updates.
- **`processDelete`** — deletes the `watch_items` row by id (cascades to `watch_item_ratings`/`watch_item_tags` via `ON DELETE CASCADE` FKs); per-item error `"Item not found or already deleted"` if nothing was deleted.

**Response `200`:**
```ts
{
  success: boolean,   // true only if errors[] is empty
  results: { created: { tempId: string; newId: string }[]; updated: string[]; deleted: string[] },
  errors: { id: string; field?: string; message: string }[],
}
```

**Errors:** `401` (no session), `403` (unverified email, or role checks above), `500 { error: "Failed to process bulk update" }` for an unhandled exception outside the per-item try/catch blocks (e.g. malformed JSON body).

---

## `GET /api/watchlist/validate-title`

**File:** `src/routes/api/watchlist/validate-title/+server.ts`
**Auth:** None required.

**Query params:**
| Param | Type | Notes |
| --- | --- | --- |
| `title` | string | Required — `400 { error: "Title is required" }` if missing. |
| `excludeId` | string | Optional. Ignored (not applied to the query) if it starts with `"temp-"` — i.e. draft/new rows never exclude themselves since they don't have a real id yet. |

**Response `200`:** `{ isUnique: boolean }` — `true` if no `watch_items` row has that exact (trimmed) title, excluding `excludeId` when applicable. Used by `editable-text-cell.svelte`'s 300ms-debounced live title validation and by `add-item-dialog.svelte`.

**Errors:** `400` (missing title), `500 { error: "Failed to validate title" }`.
