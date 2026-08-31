# Architecture — `watchlist`

## SvelteKit route structure

Routes are organized into four groups plus a flat `api/` tree, all under `apps/watchlist/src/routes/`:

| Group | Guard (enforced in `hooks.server.ts`) | Routes |
| --- | --- | --- |
| `(auth)/` | If a **verified** session exists, redirect to `/`. Unverified sessions may still reach `verify-email`/`check-email`. | `login`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`, `check-email` — plus a shared `(auth)/+layout.svelte` (centered card + `z.png` side image). |
| `(protected)/` | Requires a session (→ `/login` if absent) **and** a verified email (→ `/check-email?reason=verify` if not). | `list` — the guard is live but this is the only route in the group, and it's dead/unlinked (see [project-context.md](./project-context.md#known-gotchas-verified-against-source-2026-08-31)). |
| `(public)/` | No server-side gate at all. All feature-level access control (editing/adding/deleting rows) happens client-side inside the data table via `userRole`/`isEmailVerified`. | `/` (the actual watchlist table, despite the group name), `/about`, `/dashboard`, `/leaderboard`. |
| `api/` | Per-endpoint (see [api-contracts.md](./api-contracts.md)). | `dashboard`, `leaderboard`, `user-rating-preferences`, `users`, `views`, `views/[viewName]`, `watchlist`, `watchlist/bulk-update`, `watchlist/validate-title`. |
| root | Renders global chrome for every route. | `+layout.svelte` — mounts `Background`, `Overlay` (top nav), `PwaInstallButton`, `Toaster`; registers the service worker; subscribes to `authClient.useSession()` once to keep the session store warm app-wide. |

Route-group folder names are an organizational convention here, not a security boundary by themselves — `(public)/+page.svelte` is the actual editable watchlist, and its own edit/add/delete affordances are gated by role, not by the route group.

## Auth flow (`src/hooks.server.ts`)

```ts
export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({ headers: event.request.headers });
  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as typeof schema.user.$inferSelect;
  }
  // (auth)/* redirect-if-already-verified-and-logged-in logic
  // (protected)/* require-session-and-verified-email logic
  return svelteKitHandler({ event, resolve, auth, building });
}
```

- `auth.api.getSession(...)` comes from `@pocket-dimension/auth`'s single `auth` export (a configured Better Auth instance backed by the Drizzle adapter over `@pocket-dimension/db`).
- On every request, if a session exists, `event.locals.session`/`event.locals.user` are populated — this is what every `+page.server.ts` load function and every `api/**/+server.ts` handler reads via `locals.user`/`locals.session`.
- `svelteKitHandler({ event, resolve, auth, building })` (from `better-auth/svelte-kit`) is called last and handles Better Auth's own REST surface (sign-in, sign-up, verify, etc.) actually served by `auth-service` on port 5001, not by this app — `watchlist` only needs the session-reading half of the handler plus its own redirect rules.
- Client-side, `src/lib/auth-client.ts` creates a `better-auth/svelte` client (`authClient`) pointed at `PUBLIC_BASE_AUTH_URL`/`PUBLIC_BASE_AUTH_PATH`, with the `usernameClient()` plugin (for username-based login) and a 5-minute session refetch interval + refetch-on-focus. Pages call `authClient.signIn.email/username`, `authClient.signUp.email`, `authClient.signOut()`, and reactively read `authClient.useSession()`.
- Three flows bypass the `authClient` SDK entirely and hit `auth-service`'s REST endpoints with raw `fetch(`${PUBLIC_BASE_AUTH_URL}/...`)` calls: `forgot-password`, `reset-password`, and the resend-verification action shared by `login`/`check-email`. This is because those endpoints aren't exposed as typed client methods by the SDK.
- **Type-declaration gap:** `src/app.d.ts` declares `App.Locals` as `{ session?: Session; user?: typeof schema.user.$inferSelect }` and imports `Session` from `$lib/auth` — but `apps/watchlist/src/lib/auth.ts` does not exist (only `auth-client.ts` does). See [project-context.md](./project-context.md) for why this doesn't currently surface as a build error.

## Server-side libs (`src/lib/server/*`, `src/lib/leaderboard.ts`)

| File | Responsibility |
| --- | --- |
| `src/lib/server/watchlist.ts` | `getWatchlistForUser(user, options)` — the single source of truth for the home table's data. Builds one composed raw SQL query (via Drizzle's `sql` tagged template, not the query builder) with CTEs for global rating aggregates, the current user's own ratings, comma-joined tags, and one CTE per "preferred user" (dynamic rating-comparison columns). Also returns the intermediate `withQuery`/`baseQuery`/`*FilterQuery` fragments so `+page.server.ts` can reuse them to build "what other values are still selectable" facet queries without duplicating the WHERE-clause logic. |
| `src/lib/server/dashboard.ts` | `getDashboardData(userId, scope)` — runs ~10 independent aggregate queries in parallel (`Promise.all`) against `watchlist.watch_items`/`watch_item_ratings`/`watch_tags`/`watch_languages`, branching per query on `scope` ("catalog" vs. "personal"). Returns a single `DashboardData` object consumed directly by `/dashboard`'s chart components. |
| `src/lib/server/leaderboard.ts` | `getLeaderboardData(metric, filters)` and `getLeaderboardFilterOptions()` — ranks `auth.user` rows by count of matching `watch_item_ratings`, joined against `watch_items`/`watch_languages`/`watch_item_tags`/`watch_tags` for the type/language/tag filters. |
| `src/lib/leaderboard.ts` | Pure, isomorphic (no DB import) types + `parseLeaderboardParams(url)` — shared verbatim between `leaderboard/+page.server.ts` (server) and `leaderboard-content.svelte` (client), so both agree on canonical query-param parsing/defaults. This is the one place in the app where param-parsing is *not* duplicated between server and client. |

All three server-lib files import `db`/`schema` from `@pocket-dimension/db` and query the `watchlist` Postgres schema plus `auth.user` (for usernames/leaderboard identities) — see [data-models.md](./data-models.md).

## Data table architecture (summary)

Full detail: [deep-dive-watchlist.md §4.2](./deep-dive-watchlist.md). Summary:

- **Fetch/pagination:** `(public)/+page.server.ts` performs the initial SSR fetch (page 0, 25 rows) via `getWatchlistForUser`, plus filter-facet and edit-dropdown-option queries. Client-side, `useDataFetch` (`data-table-helpers/data-fetch.svelte.ts`) owns subsequent pages against `GET /api/watchlist`, resetting to page 0 whenever search/sort/filter params change and re-syncing from server data after `invalidateAll`.
- **Infinite scroll:** `useInfiniteScroll` (`data-table-helpers/infinite-scroll.svelte.ts`) wraps an `IntersectionObserver` on a sentinel row, debounced 500ms.
- **Edit mode:** Fully client-side state machine (`data-table-helpers/edit-mode.svelte.ts`, `createEditModeState()`), provided via Svelte context (`editModeContext`) from `data-table.svelte` down to every cell/dialog/panel. Tracks per-row field edits with undo snapshots, tag add/remove diffs, deletions, and multi-selection. On Save, `getChangeset()` flattens everything into `{ updates, newItems, deleteIds }` and POSTs once to `POST /api/watchlist/bulk-update` — the single mutation endpoint for the entire feature (see [api-contracts.md](./api-contracts.md)).
- **Filters:** Four dimensions (language, tags, progress, type) as comma-separated URL query params (`filterLanguage`, `filterTags`, `filterProgress`, `filterType`), applied server-side inside `getWatchlistForUser`'s SQL. Desktop uses per-column `FilterDropdown`s; mobile consolidates language/tags/type into `MobileFilterDialog` (progress is excluded from mobile filtering) plus a long-press `RowDetailsDialog`.
- **Columns:** Static definitions in `(public)/columns.ts` (`select`, `order`, `title`, `tags`, `type`, `language`, `my_progress_status`, `my_rating`, `avg_rating`, `actions`) plus dynamically-generated per-preferred-user rating columns (`createUserRatingColumns`). Visibility/order persist to `localStorage` via `column-settings.svelte.ts`; drag-and-drop reordering uses `svelte-dnd-action`. Mobile forces a reduced visible set (`order`, `title`, `my_progress_status`, `my_rating`, `avg_rating`) and hides `select`/`actions`.
- **Saved views:** Implemented entirely in `overlay.svelte` (top nav), not in `data-table.svelte` — CRUD against `GET/POST /api/views` and `PUT/DELETE /api/views/[viewName]`, snapshotting the current URL's filter/sort/search query params as JSON.

## Role permissions

Authoritative source: `edit-mode.svelte.ts`'s `canEditField`/`canAddRows`/`canDeleteRows`, cross-checked against `data-table.svelte`'s `canEdit`/`canAddRows`/`canDeleteRows` derived values and the server-side enforcement in `POST /api/watchlist/bulk-update`.

| Role | Enter edit mode | Edit own rating/progress fields (`my_rating`, `my_infinity`, `my_shitty`, `my_progress_status`) | Edit `title`/`languageId`/`type`/tags | Add new rows | Delete rows |
| --- | --- | --- | --- | --- | --- |
| `user` (any logged-in, email-verified account) | Yes | Yes | No | No | No |
| `mobile` (synthetic — forced whenever viewport < 768px, regardless of the account's real role) | Yes | Yes | No | No (checked against the *real* `userRole`, not the effective mobile override — so a mobile-viewport contributor/admin can still add rows) | No |
| `contributor` | Yes | Yes | Yes | Yes | No |
| `admin` | Yes | Yes | Yes | Yes | Yes |

Notes:
- `role` is a column on `auth.user` (`user_role` enum: `user` \| `contributor` \| `admin`), owned by `@pocket-dimension/auth`/`@pocket-dimension/db` — not by this app. Watchlist only reads it (`locals.user.role`) to decide contributor/admin gating in `bulk-update`.
- The `mobile` role is a **UI-layer** override (`effectiveUserRole = isMobile ? "mobile" : userRole` in `data-table.svelte`) that narrows editable fields; it has no server-side representation, and the bulk-update endpoint checks the real `role` column, not a mobile flag.
- All edit-mode gates additionally require `isEmailVerified` (i.e. `locals.user.emailVerified`) — the server enforces this independently with a 403 on `bulk-update`, `views` (GET/POST/PUT/DELETE), and is mirrored client-side.
- `about/+page.svelte`'s prose says mobile users have "read-only access" and "cannot edit" — this is **narrower than the actual permission model** (see the gotcha in [project-context.md](./project-context.md)); mobile users can edit their own rating/progress fields, just not title/language/type/tags and not add/delete rows.
- Ratings (`my_rating`/`my_infinity`/`my_shitty`) are only meaningful (readable/writable) when `my_progress_status` is `watched` or `dropped` — enforced independently in `editable-select-cell.svelte` (client), `editable-rating-cell.svelte` (client, `canRate` gate), and `bulk-update/+server.ts`'s `processUpdate`/`processNewItem` (server, the actual boundary) — changing progress away from those two values clears the rating fields.

## PWA

- `apps/watchlist/static/manifest.json` — name "Watchlist", `display: standalone`, single SVG icon (`/icon.svg`, `any maskable`), theme/background `#0b1220`.
- `apps/watchlist/static/sw.js` — minimal service worker: `skipWaiting()` on install, `clients.claim()` on activate; no caching strategy (no `fetch` handler, no offline support) — it exists purely to satisfy the installability criteria, not to provide offline functionality.
- Registered from the root `+layout.svelte` via `navigator.serviceWorker.register("/sw.js")` (silently ignores registration failures).
- `src/lib/components/pwa-install-button.svelte` — floating bottom-right button; captures the browser's `beforeinstallprompt` event (Chromium/Android) and shows a `window.alert()`-based manual "Add to Home Screen" hint on iOS (UA-sniffed, since iOS doesn't fire `beforeinstallprompt`). Mounted globally, visible on every page including auth pages.

## Integration with `@pocket-dimension/{auth,db}`

- **`@pocket-dimension/auth`** — single import, `import { auth } from "@pocket-dimension/auth"`, used only in `hooks.server.ts` for `auth.api.getSession(...)` and as the `auth` argument to `svelteKitHandler`. All actual auth mutation endpoints (sign-up, sign-in, verify, reset, etc.) are served by the separate `auth-service` app on port 5001 — `watchlist` never calls `auth.api.*` mutation methods directly, only reads sessions and forwards to the shared handler. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_PATH`, `BETTER_AUTH_TRUSTED_ORIGINS`, and `BETTER_AUTH_COOKIE_DOMAIN` must match `auth-service`'s values exactly (see [development-guide.md](./development-guide.md)).
- **`@pocket-dimension/db`** — `import { db, schema } from "@pocket-dimension/db"` everywhere data is read/written: every `api/**/+server.ts` handler, both server-load functions (`(public)/+page.server.ts`, `dashboard/+page.server.ts`, `leaderboard/+page.server.ts`), and all three `src/lib/server/*.ts` files. The app only reads/writes the `watchlist` schema plus `auth.user` (for usernames and the leaderboard) — never the `auth`/`howwasyourday`/`chhanchhan`/`meviayou`/`zeo` schemas beyond that one join.
- Both packages are workspace dependencies (`workspace:*`) — the app imports their **built** `dist/` output, so `bun run build:shared:{utils,db,auth}` must run before `dev`, `build`, `check`, or Docker/Railpack builds (see [development-guide.md](./development-guide.md) and [deployment-guide.md](./deployment-guide.md)).

## Client state management (`.svelte.ts` runes modules)

Four modules encapsulate non-trivial client state as Svelte 5 rune-based composables, all under `(public)/data-table-helpers/`:

1. `data-fetch.svelte.ts` — generic paginated-fetch composable (`useDataFetch<T>`).
2. `infinite-scroll.svelte.ts` — generic `IntersectionObserver` wrapper.
3. `edit-mode.svelte.ts` — the edit-mode state machine (739 LOC), created per `data-table.svelte` instance via `createEditModeState()` and shared via Svelte context, not a module-level singleton (correctly scoped per table instance).
4. `column-settings.svelte.ts` — `localStorage` persistence composable that owns no `$state` itself; accepts getter/setter callbacks from the caller.

Cross-cutting pattern worth knowing before editing sort/filter/search or the saved-views selector: both `data-table.svelte` (`pendingSorting`/`pendingFilters`/`pendingQuery`) and `overlay.svelte` (`isManualSelection`) independently implement "echo suppression" — a local optimistic state change followed by `goto()` must not be immediately undone by the same component's own URL-sync `$effect` reacting to that same navigation. Neither implementation is shared; see [deep-dive-watchlist.md §4.5](./deep-dive-watchlist.md) for the full mechanics.
