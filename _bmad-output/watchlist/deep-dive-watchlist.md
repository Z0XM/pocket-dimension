# watchlist — Deep Dive Documentation

**Generated:** 2026-08-31
**Scope:** `apps/watchlist` (entire app)
**Workflow Mode:** Exhaustive Deep-Dive (`bmad-document-project`)
**Heimdall module:** `watchlist`

Companion module docs in this folder: [index.md](./index.md), [architecture.md](./architecture.md), [api-contracts.md](./api-contracts.md), [component-inventory.md](./component-inventory.md), [development-guide.md](./development-guide.md).

---


Scope: every route file, every `data-table-helpers/*` file, and the feature components listed by the user (excluding shadcn/ui primitives under `$lib/components/ui/*`). All files below were read in full, line by line. LOC counts are from `wc -l`.

---

## 1. Layouts & Pages

### `src/routes/+layout.svelte` (37 LOC)
**Purpose:** Root layout for the entire app. Registers the global background, toaster, overlay (top nav bar), and PWA install button around every page's content. Also subscribes to the Better Auth session on mount purely to keep the session store warm/reactive app-wide, and registers the service worker for PWA support.
**Exports:** none (route layout component).
**Key props/state:** `children` snippet prop (SvelteKit layout convention). No local reactive state beyond the `onMount` subscription cleanup.
**API calls:** none directly; triggers `authClient.useSession()` (Better Auth client store) and `navigator.serviceWorker.register("/sw.js")`.
**Patterns:** onMount + subscribe/unsubscribe cleanup idiom; silent catch on service worker registration failure (`// Ignore registration failures to avoid breaking initial render.`).
**Contributor note:** This is the single place that mounts `Background`, `Overlay`, `PwaInstallButton`, and `Toaster` — any new chrome/global UI should be added here, not per-page.
**Risks:** The `session.subscribe(() => {})` with an empty callback is a no-op subscribe purely to force store initialization; if Better Auth's store semantics change (e.g., lazy init removed) this becomes dead code. Low risk but worth a comment.

### `src/routes/(auth)/+layout.svelte` (21 LOC)
**Purpose:** Shared visual shell for all `(auth)` pages (login, sign-up, forgot/reset password, verify/check email) — a centered card with a decorative side image (`z.png`) hidden on mobile.
**Exports:** none.
**Key props/state:** `children` snippet only.
**API calls:** none.
**Patterns:** Presentational-only layout; delegates all logic to child pages.
**Contributor note:** Any new auth page automatically gets this card+image chrome by living under `(auth)`.
**Risks:** None significant; purely presentational.

### `src/routes/(auth)/login/+page.svelte` (171 LOC)
**Purpose:** Login form supporting both email and username login modes. Handles the "email not verified" (403) error path with an inline resend-verification action.
**Exports:** none.
**Key props/state:** `loginBy` ("email"|"username"), `email`, `username`, `password`, `error`, `loading`, `emailNotVerified`, `resendingVerification`. Uses `$props.id()` for unique input IDs.
**API calls:** `authClient.signIn.email(...)` / `authClient.signIn.username(...)` (Better Auth client); manual `fetch(`${PUBLIC_BASE_AUTH_URL}/send-verification-email`)` POST for resend, then `goto("/check-email?type=resend&email=...")`. On success, `goto("/")`.
**Patterns:** Dual-mode toggle via linked `Button variant="link"` pair; error message sniffing (`status === 403` or message text match) to detect unverified-email special case; dynamic `import("$env/static/public")` inside a handler (avoids bundling env at module scope for that one call — inconsistent with other pages that import it statically).
**Contributor note:** `rememberMe: true` is hardcoded for both sign-in calls — there's no "remember me" checkbox in the UI.
**Risks:** Error detection for "email not verified" relies on brittle string matching (`message.includes("email") && message.includes("verif")`) in addition to status code; if the auth service copy changes, this silently stops working. The dynamic `import("$env/static/public")` inside `handleResendVerification` is inconsistent with static imports elsewhere and could be simplified.

### `src/routes/(auth)/sign-up/+page.svelte` (119 LOC)
**Purpose:** Registration form collecting email, name, username, password, and password confirmation, with client-side strong-password validation before calling Better Auth's sign-up.
**Exports:** none.
**Key props/state:** `name`, `email`, `username`, `password`, `confirmPassword`, `error`, `loading`; `strongPasswordRegex` constant.
**API calls:** `authClient.signUp.email({ email, password, name, username, callbackURL })`; on success `goto("/check-email?type=signup&email=...")`.
**Patterns:** Regex-based password strength gate before hitting the network; `callbackURL` points back to `/verify-email` for the email link.
**Contributor note:** The same `strongPasswordRegex` is duplicated in `reset-password/+page.svelte` — a shared validator/util would reduce drift risk.
**Risks:** Password policy duplicated in two files (sign-up, reset-password); if the policy changes it must be updated in both places (and ideally mirrored server-side).

### `src/routes/(auth)/forgot-password/+page.svelte` (84 LOC)
**Purpose:** Collects an email and requests a password-reset link via the auth service's REST endpoint (not the Better Auth client SDK).
**Exports:** none.
**Key props/state:** `email`, `error`, `loading`.
**API calls:** raw `fetch(`${PUBLIC_BASE_AUTH_URL}/forgot-password`, { method: "POST", body: { email, redirectTo } })`; success routes to `/check-email?type=forgot&email=...`.
**Patterns:** Direct REST call instead of `authClient` helper (unlike login/sign-up) — likely because Better Auth's client SDK doesn't expose this endpoint directly, or the team chose raw fetch for this flow.
**Contributor note:** `redirectTo` is hardcoded to `${origin}/reset-password`; keep in sync if the reset route path changes.
**Risks:** No rate limiting/feedback differentiation is done client-side (by design — the API intentionally returns success regardless of whether the email exists, per the check-email copy: "If an account exists...").

### `src/routes/(auth)/reset-password/+page.svelte` (168 LOC)
**Purpose:** Consumes a `token` query param to set a new password; handles multiple error states passed via `?error=` (missing/expired/invalid/already-used token) with friendly copy, and shows a success state with auto-redirect to `/login`.
**Exports:** none.
**Key props/state:** `token` and `errorParam` derived from `page.url.searchParams`; `password`, `confirmPassword`, `error`, `loading`, `success`. Reuses the same `strongPasswordRegex`.
**API calls:** raw `fetch(`${PUBLIC_BASE_AUTH_URL}/reset-password`, { method: "POST", body: { newPassword, token } })`.
**Patterns:** Three-way conditional render (`{#if !token || hasErrorFromParam}` / `{:else if success}` / `{:else}` form) driven by derived state; `setTimeout(() => goto("/login"), 3000)` for auto-redirect after success.
**Contributor note:** Error-code-to-message mapping (`getErrorMessage`) is duplicated conceptually with `verify-email/+page.svelte`'s own mapping — different code sets (`token_expired`, `token_invalid`, `token_already_used`, `missing_callback`, `unknown`) but same pattern; consider a shared `$lib` helper keyed by flow.
**Risks:** The `setTimeout`-based redirect isn't cleared on component destroy; if the user navigates away manually within 3s, the timer still fires `goto("/login")` (low-impact but a minor leak/surprise navigation).

### `src/routes/(auth)/verify-email/+page.svelte` (62 LOC)
**Purpose:** Terminal landing page for the email verification link. Shows success or a mapped error message based on `?error=` query param (better-auth redirects here after processing the token itself — this page does not call any verification API).
**Exports:** none.
**Key props/state:** `error`, `errorMessage`, `hasError` — all derived from `page.url.searchParams`.
**API calls:** none (purely presentational; verification happens server-side before redirecting here).
**Patterns:** Error-code map local to the component (`token_expired`, `token_invalid`, `token_already_used`, `user_not_found`, `email_already_verified`, `unknown`).
**Contributor note:** `window.close()` button on success assumes the page may have been opened in a new tab (e.g., clicking the email link from a mail client) — fails silently/no-ops if the tab wasn't script-opened.
**Risks:** None significant; static page depending entirely on hooks.server.ts / better-auth to have already processed the token before redirecting here.

### `src/routes/(auth)/check-email/+page.svelte` (119 LOC)
**Purpose:** Generic "we sent you an email" holding page reused across three flows (`signup`, `resend`, `forgot`) plus a `reason=verify` variant (reached when a logged-in-but-unverified user is redirected here by `hooks.server.ts`). Offers a resend-verification action inline.
**Exports:** none.
**Key props/state:** `type`, `email`, `reason` from query params; `resending`, `resendSuccess`, `resendError`; `title`/`description` are `$derived.by(...)` computed from `type`/`reason`.
**API calls:** `fetch(`${PUBLIC_BASE_AUTH_URL}/send-verification-email`, { method: "POST", body: { email, callbackURL } })`.
**Patterns:** Single page reused for 4 semantically different states via query-string flags rather than 4 separate routes — reduces route count at the cost of more branching logic in one file.
**Contributor note:** This is also the redirect target used by `hooks.server.ts` for unverified protected-route access (`/check-email?reason=verify`), so changing its query-param contract affects both client-triggered navigations and server redirects.
**Risks:** The resend button is hidden when `type === "forgot"` even if `reason === "verify"` and `type` defaults to `"signup"` — the `type !== "forgot" && email` guard is the only condition; logic is a bit tangled given 2 independent query flags (`type`, `reason`) driving overlapping UI branches.

### `src/routes/(protected)/list/+page.svelte` (1 LOC)
**Purpose:** Contains only the literal text `Login Required` with no `<script>` block, no markup structure, and no server load file in the same folder.
**Exports:** none.
**Key props/state:** none.
**API calls:** none.
**Patterns:** N/A — effectively a stub/placeholder file.
**Contributor note:** No other file in the codebase links to `/list` (confirmed via full-text search for `/list` across `src`), and there's no matching `+page.server.ts`. The `(protected)` route group *is* wired up in `src/hooks.server.ts` (redirects unauthenticated users to `/login`, unverified users to `/check-email?reason=verify`), so the guard logic is live, but this specific page is orphaned/dead code — likely a scaffold left over from an earlier design where the watchlist lived at `/list` before being moved to the `(public)` root `+page.svelte`.
**Risks:** Dead route; safe to delete or repurpose, but flag before removing in case it's intentionally kept as a smoke-test route for the `(protected)` guard.

### `src/routes/(public)/+page.svelte` (125 LOC)
**Purpose:** The actual watchlist home page (despite living under `(public)`) — assembles the data table: merges static `columns` with dynamically-generated per-preferred-user rating columns, filters out user-specific columns for anonymous visitors, wires up the `useDataFetch` + `useInfiniteScroll` composables, and passes everything to `DataTable`.
**Exports:** none.
**Key props/state:** `data` (page data from `+page.server.ts`); `session` via `authClient.useSession()`; `isSignedIn`, `isEmailVerified` derived from session; `preferredUsers` from server data; `userRatingColumns` (dynamic `ColumnDef[]`); `allColumns`/`filteredColumns` derived; URL-derived `searchQuery`/`sortBy`/`sortOrder`/`filterLanguage`/`filterTags`/`filterProgress`/`filterType`.
**API calls:** none directly — delegates paging fetches to `useDataFetch`, which calls `/api/watchlist`.
**Patterns:** Column composition by splicing the `actions` column out, appending dynamic user-rating columns, then re-appending `actions` at the end — order-sensitive and fragile if `columns` array shape changes; anonymous-user column filtering by checking both `id` and `accessorKey` for `"my_rating"`/`"my_progress_status"`.
**Contributor note:** This is the true home page; the route-group name `(public)` is a routing-organization choice, not an access-control statement — the *effective* access control for editing happens inside `DataTable`/`edit-mode.svelte.ts` via `userRole`/`isEmailVerified`, not via a route guard.
**Risks:** `(data as any)` casts throughout — `PageProps` typing from server load isn't strongly propagated to consumed fields, so a server-side rename would not be caught at compile time here.

### `src/routes/(public)/+page.server.ts` (194 LOC)
**Purpose:** Server load function for the home page. Parses sort/filter query params, loads the current user's preferred-rating-users (for dynamic columns), calls `getWatchlistForUser` (from `$lib/server/watchlist`) for page 0 of results, then runs four additional distinct-value SQL queries (languages/tags/progress-statuses/types) scoped by the *other* active filters (so each filter dropdown only shows values still reachable given the other filters), plus three unfiltered "all" lookups (`allLanguages`, `allTags`, `allTypes`) used to populate edit-mode dropdowns.
**Exports:** `load: PageServerLoad`.
**Key props/state:** N/A (server function); locals: `locals.user`.
**API calls:** Drizzle `db.select()` against `schema.userRatingPreferences`/`schema.user`; raw `db.execute(sql\`...\`)` for the four faceted distinct-value queries plus three "all" queries against `watchlist.watch_languages`, `watchlist.watch_tags`, and the `watchlist.watch_item_type` Postgres enum.
**Patterns:** Cross-filtering facet queries built by re-injecting the shared `withQuery`/`baseQuery`/`*FilterQuery` SQL fragments returned from `getWatchlistForUser` — i.e., the language-options query applies every filter *except* the language filter itself, and so on, so dropdown option lists never self-exclude the user's own filter selection; broad `try/catch` returning an all-empty-arrays fallback shape on any failure (keeps the page rendering even if the DB is down).
**Contributor note:** The four facet queries plus `getWatchlistForUser`'s own query means up to 8 DB round-trips per full page load — a candidate for consolidation (e.g., a single query with `FILTER` clauses) if load-page latency becomes a concern.
**Risks:** Errors are swallowed to an all-defaults response with only a `console.error` — a systemic DB outage degrades to an empty watchlist with no user-visible error state (the page component doesn't distinguish "no results" from "load failed").

### `src/routes/(public)/about/+page.svelte` (153 LOC)
**Purpose:** Static informational/marketing page describing the app's purpose, design philosophy, feature list by role tier (core/mobile-limited/user/contributor/admin), and credits.
**Exports:** none.
**Key props/state:** none (fully static).
**API calls:** none.
**Patterns:** Plain content page using only `Card.*` primitives.
**Contributor note:** This page is the authoritative human-readable description of role-gated feature availability (user vs. contributor vs. admin) and mobile limitations — useful as a cross-check against the actual `edit-mode.svelte.ts` `canEditField`/`canAddRows`/`canDeleteRows` logic when auditing permissions.
**Risks:** Purely documentation-as-UI; will silently drift from actual behavior if permissions logic changes without updating this page.

### `src/routes/(public)/dashboard/+page.svelte` (224 LOC)
**Purpose:** Analytics dashboard rendering KPI stat cards and six chart types (type mix donut, progress donut, language bar, top-tags bar, progress-by-type stacked bar, rating histogram, avg-rating-by-type/language bars). Supports a "Catalog" vs. "My Stats" scope toggle for logged-in users, persisted via a `?scope=personal` query param.
**Exports:** none.
**Key props/state:** `data` (from `+page.server.ts`, typed via `DashboardData`); `dashboard`, `scope`, `isPersonal` derived; local `TYPE_COLORS`/`PROGRESS_COLORS` constant maps.
**API calls:** none directly — data comes from server load; `setScope()` uses `goto()` to mutate the URL (`keepFocus`, `noScroll`).
**Patterns:** Scope toggle implemented as URL state (not component state) so it's shareable/bookmarkable and triggers a full server reload via SvelteKit navigation; color-by-value mapping objects (`TYPE_COLORS`, `PROGRESS_COLORS`) passed into generic chart components.
**Contributor note:** All six chart components (`donut-chart`, `histogram-chart`, `horizontal-bar-chart`, `stacked-bar-chart`) are generic/presentational and reused verbatim between catalog and personal scope — only the `data`/`title` props change based on `isPersonal`.
**Risks:** `dashboard?.kpis.myAvgRating` etc. depend on `DashboardData` shape defined in `$lib/server/dashboard` (not in the reviewed file set) — any shape drift there breaks this page silently under `any`-adjacent optional chaining (no runtime validation).

### `src/routes/(public)/dashboard/+page.server.ts` (21 LOC)
**Purpose:** Thin server load wrapper: reads `?scope=personal|catalog` from the URL, calls `getDashboardData(locals.user?.id, scope)`, returns `{ dashboard, isLoggedIn }` with a null-fallback on error.
**Exports:** `load: PageServerLoad`.
**Key props/state:** N/A.
**API calls:** `getDashboardData` from `$lib/server/dashboard` (not in scope of this deep-dive but is the actual data source).
**Patterns:** Same fail-soft pattern as the home page loader (`catch` → `null` + `console.error`, no error surfaced to UI beyond dashboard component's "Unable to load dashboard data" fallback card).
**Contributor note:** Very small/simple — the real complexity lives in `$lib/server/dashboard.ts`, which is out of this deep-dive's scope but worth reviewing separately for query performance.
**Risks:** Same as home page: DB failure degrades silently to a generic "unable to load" card with no retry affordance.

### `src/routes/(public)/leaderboard/+page.svelte` (22 LOC)
**Purpose:** Thin wrapper that renders `LeaderboardContent` when data loaded successfully, or a fallback "unable to load" card otherwise.
**Exports:** none.
**Key props/state:** `data`, `leaderboard` derived and cast via `LeaderboardData` type from `$lib/leaderboard`.
**API calls:** none (delegates to server load).
**Patterns:** Simple conditional render guard, consistent with dashboard's fallback pattern.
**Contributor note:** Keeps the actual leaderboard UI logic entirely inside `leaderboard-content.svelte`, making this file trivial to scan.
**Risks:** None significant.

### `src/routes/(public)/leaderboard/+page.server.ts` (15 LOC)
**Purpose:** Parses metric + filter query params via `parseLeaderboardParams(url)` (shared with the client component) and calls `getLeaderboardData(metric, filters)`.
**Exports:** `load: PageServerLoad`.
**Key props/state:** N/A.
**API calls:** `getLeaderboardData` from `$lib/server/leaderboard` (out of scope for this deep-dive).
**Patterns:** Shares `parseLeaderboardParams` with the client-side `leaderboard-content.svelte` so both server and client agree on canonical query-param parsing/defaults — good single-source-of-truth pattern, unlike the ad hoc parsing duplicated between `+page.server.ts` and `data-table.svelte` for the watchlist filters.
**Risks:** None significant.

### `src/routes/(public)/leaderboard/leaderboard-content.svelte` (379 LOC)
**Purpose:** Full leaderboard UI: a metric tab-switcher (`watched`/`watching`/`watch_later`/`dropped`/`all_rated`), three `FilterDropdown` instances (type/language/tags), a ranked list with proportional bar-chart visualization, medal coloring for top 3 ranks, and a "clear filters" affordance — all state synced to the URL via `goto(..., { keepFocus: true, noScroll: true })`.
**Exports:** none (default component export only).
**Key props/state:** `leaderboard: LeaderboardData` prop; `maxCount` derived (for bar scaling); `activeFilterCount`, `filterSummary` derived.
**API calls:** none directly — all filtering/metric changes go through `updateUrl()` → `goto()` → server reload.
**Patterns:** Reuses the same `FilterDropdown` component from `data-table-helpers/` even though this page is unrelated to the data table — demonstrates that `data-table-helpers/filter-dropdown.svelte` is really a generic multi-select filter widget, not table-specific, despite its folder location; heavy scoped `<style>` block (component-local CSS rather than Tailwind utility classes) for the ranking rows/bars, unlike most of the rest of the app which is Tailwind-first.
**Contributor note:** `FilterDropdown` importing across a route-group boundary (`$routes/(public)/data-table-helpers/filter-dropdown.svelte`) is a code smell — it suggests this component should be promoted to `$lib/components/` since it's used outside the data-table's own route.
**Risks:** Named import path `$routes/(public)/data-table-helpers/filter-dropdown.svelte` couples the leaderboard page to the watchlist table's helper folder; moving/renaming `data-table-helpers` would silently break the leaderboard page unless caught by TypeScript path resolution.

### `src/routes/(public)/columns.ts` (345 LOC)
**Purpose:** Defines the `Watchlist` row type and the static `ColumnDef<Watchlist>[]` array consumed by TanStack Table (`select`, `order`, `title`, `tags`, `type`, `language`, `my_progress_status`, `my_rating`, `avg_rating`, `actions`), plus a factory `createUserRatingColumns(usernames)` that generates one dynamic column per "preferred user" for cross-user rating comparison. Also contains the avg-rating and per-user-rating color-coding logic (hardcoded 0–10 hex gradient) duplicated as raw HTML strings via `createRawSnippet`.
**Exports:** `WatchProgressStatus` type, `Watchlist` type, `columns` (`ColumnDef<Watchlist>[]`), `createUserRatingColumns(usernames: string[])`.
**Key props/state:** N/A (pure column-definition module, no component state).
**API calls:** none.
**Patterns:** `renderComponent`/`renderSnippet` bridge from `$lib/components/ui/data-table` to embed Svelte components and raw-HTML snippets as TanStack cell renderers; column `id`s double as CSS-selector-safe identifiers (usernames sanitized via `.replace(/[^a-zA-Z0-9_]/g, "_")` for dynamic column IDs); infinity (♾️)/shitty (💩) emoji-based rating overrides take precedence over numeric rating display in both the static `avg_rating` column and every dynamic per-user column.
**Contributor note:** The rating→color mapping function (`getRatingColor`, 10 discrete hex thresholds) is duplicated three times across the codebase: here (for `avg_rating` and dynamic user columns) and again in `editable-rating-cell.svelte`. Any rating-color-scheme change requires updating all three call sites.
**Risks:** `options: []` placeholders on the `type`/`language` `EditableSelectCell` column defs rely entirely on `data-table.svelte`'s `setContext("editOptions", ...)` to inject real option lists at render time — if a column cell is ever rendered outside that context provider, it silently gets an empty dropdown with no error.

### `src/routes/(public)/data-table.svelte` (1472 LOC)
**Purpose:** The largest and most complex file in this deep-dive — the entire watchlist data table: mobile detection, scroll-to-top tracking, edit-mode context creation, dynamic column ordering/visibility persisted via `useColumnSettings`, drag-and-drop column reordering (`svelte-dnd-action`), URL-synced sorting/filtering/search-with-debounce, keyboard shortcuts (Ctrl+Q search focus, Ctrl+S save, Esc cancel edit), the full edit-mode toolbar (enter/save/cancel/undo-all/add-row), save/delete/bulk-delete confirmation flows, and rendering of the actual `<Table.Root>` with infinite-scroll sentinel row.
**Exports:** none (generic component, `<script lang="ts" generics="TData, TValue">`).
**Key props/state:** Props: `data`, `columns`, `onSentinelMount`, `isLoading`, `userRole`, `isEmailVerified`, `filterOptions`. Local state (partial, most significant): `isMobile`, `effectiveUserRole` (forces `"mobile"` role below 768px), `editMode` (from `createEditModeState()`), `columnSettings`/`isSettingsLoaded`, `columnOrder`/`columnVisibility` derived, `sorting`/`filters` (URL-synced with a "pending" echo-suppression pattern to avoid feedback loops during `goto()`), `searchValue` (debounced 300ms), `dndItems`/`isDragging` for column-reorder drag state, `isSaving`/`isEnteringEditMode`, six dialog-open booleans, `canEdit`/`canAddRows`/`canDeleteRows` derived from role + email-verified.
**API calls:** `POST /api/watchlist/bulk-update` (executeSave — the single endpoint for all edit-mode creates/updates/deletes); indirectly, `AddItemDialog` and `BulkEditPanel` (children) also call `/api/watchlist/bulk-update` and their own endpoints.
**Patterns:** **Echo-suppression for URL-synced state** — `pendingSorting`/`pendingFilters`/`pendingQuery` string values are stashed before calling `goto()`, and the reactive `$effect` that normally syncs `sorting`/`filters`/`searchValue` from the URL skips syncing until the URL confirms the expected value, preventing the effect from "fighting" the local optimistic update while `goto()`'s navigation is in flight. **Double-rAF spinner pattern** in `handleEnterEditMode` — sets a loading flag, awaits `tick()`, then awaits two nested `requestAnimationFrame`s to guarantee the browser has actually painted the spinner before doing the (synchronous but expensive) `editMode.enterEditMode()` reactive cascade, then two more rAFs to clear the flag after the edit-mode UI has painted. **Context-based dependency injection**: `editModeContext`, `editOptions`, `filterContext`, `searchContext` are all provided via `setContext` here and consumed by nearly every `data-table-helpers/*` component — this is the backbone connecting the huge tree of small cell/dialog components without prop drilling. **New-row synthesis**: `tableData` derived merges `editMode.newRows` (temp client-side draft rows) with server `data`, mapping them into full `Watchlist` shape with placeholder fields, so TanStack Table renders drafts identically to persisted rows.
**Contributor note:** This file is a strong candidate for decomposition (it currently owns: mobile/scroll logic, column settings wiring, sorting URL sync, filter URL sync, search debounce, keyboard shortcuts, edit-mode toolbar UI, save/delete orchestration, and the table markup itself). Any of the `$effect` blocks around lines ~260–400 (sorting/filter URL sync) should be touched with extreme care — the pending-value echo-suppression logic is subtle and easy to break into an infinite goto loop.
**Risks:** Very high cyclomatic complexity concentrated in one file; the `(row.original as Watchlist)` casts throughout assume a fixed shape that must stay in sync with `columns.ts`'s `Watchlist` type; the `document.querySelector('[data-slot="table-container"]')` and `document.querySelector('[role="dialog"], [role="alertdialog"]')` DOM-probing (rather than refs/context) are fragile if the underlying `Table.Root`/dialog primitives change their markup/attributes in a future shadcn-svelte update.

---

## 2. `data-table-helpers/*` (all 23 files)

### `data-fetch.svelte.ts` (229 LOC) — `.svelte.ts` runes module
**Purpose:** Generic paginated-data-fetch composable (`useDataFetch<T>`) implementing cursor-less offset pagination with automatic reset when search/sort/filter parameters change, and synchronization with server-provided `initialData` (important for when SvelteKit's `invalidateAll` re-runs the load function after sort/filter/save actions).
**Exports:** `useDataFetch<T>(options)` returning `{ data, hasMore, loadMore }` (all via getters for reactivity).
**Key props/state:** `data`, `pageIndex`, `hasMore`, `initialized`, and six `last*` tracking variables (search/sort/sortOrder/filterLanguage/filterTags/filterProgress/filterType) used to detect parameter changes and trigger a reset.
**API calls:** `fetch(url)` where `url` is built by the caller-supplied `fetchUrl` function/string; expects either `{ watchItems: T[] }` or a bare `T[]` JSON response.
**Patterns:** Synchronous best-effort initialization (`try { initialData() } catch {}`) to avoid an initial loading flash when SSR data is already available; two separate `$effect`s — one to detect filter/search/sort changes (reset), one to sync from `initialData` changes on page 0 (post-navigation reload).
**Contributor note:** Generic enough to reuse for any other paginated list in the monorepo, not watchlist-specific despite living in this folder.
**Risks:** `hasMore` heuristic is "got fewer than `pageSize` items" — if the API ever returns exactly `pageSize` items on the true last page, one extra empty fetch will occur (self-correcting, not a bug, just a wasted request).

### `infinite-scroll.svelte.ts` (94 LOC) — `.svelte.ts` runes module
**Purpose:** Generic `IntersectionObserver`-based infinite-scroll composable (`useInfiniteScroll`) with debounce and an `enabled` gate.
**Exports:** `useInfiniteScroll(options)` returning `{ sentinelElement, isLoading, onSentinelMount }`.
**Key props/state:** `sentinelElement`, `isLoading`, `observerInstance`, `lastLoadTime` (debounce tracking).
**API calls:** none directly — invokes the caller's `loadMore()` callback.
**Patterns:** `$effect` re-creates the observer only once `sentinelElement` is set (via `onSentinelMount`) and tears it down on cleanup; debounce via timestamp comparison rather than `setTimeout` (simpler, avoids stacked timers).
**Contributor note:** Also fully generic/reusable outside the watchlist table.
**Risks:** None significant; well-isolated.

### `edit-mode.svelte.ts` (739 LOC) — `.svelte.ts` runes module, the largest state module
**Purpose:** The entire client-side edit-mode state machine: tracks per-row field edits with original-value snapshots (for undo), new draft rows, tag add/remove diffs per row, row deletions, multi-row selection (including shift-click range select), per-field validation errors, and role-based edit/add/delete permission checks. Also contains `getChangeset()`, which flattens all pending state into the exact payload shape the `/api/watchlist/bulk-update` endpoint expects, and `bulkEditField`/`bulkDeleteSelected`/`bulkAddTag` for the bulk-edit panel.
**Exports:** `UserRole` type, `EditableFields`/`OriginalValues`/`NewWatchItem`/`EditModeState` types, `createEditModeState()` (factory returning the full API), `EditModeContext` type, `setEditModeContext(context)`, `getEditModeContext()`.
**Key props/state:** `isEditMode`, `originalValues: Map<rowId, OriginalValues>`, `editedRows: Map<rowId, Partial<EditableFields>>`, `changedFields: Map<rowId, Set<string>>`, `newRows: NewWatchItem[]`, `deletedTagsByRow`/`addedTagsByRow: Map<rowId, string[]>`, `deletedRowIds`/`selectedRowIds: Set<string>`, `validationErrors: Map<rowId, Map<field, message>>`, `lastSelectedIndex`. Derived: `hasChanges`, `hasValidationErrors`, `selectedCount`, `deletedCount`.
**API calls:** none directly (pure state module) — its `getChangeset()` output is what `data-table.svelte`'s `executeSave()` POSTs.
**Patterns:** Every mutation creates a **new** `Map`/`Set` instance (`new Map(existing).set(...)`) rather than mutating in place — required for Svelte 5 rune reactivity to detect the change; `markFieldEdited` auto-reverts a field out of the "changed" tracking sets if the new value equals the stored original (clean self-healing undo semantics); rating fields are cleared automatically whenever `my_progress_status` changes to something other than `"watched"`/`"dropped"` (business rule: ratings only valid for watched/dropped items) — enforced in both `handleSelect` (editable-select-cell) and `getChangeset`'s new-item logic.
**Contributor note:** This module is the single source of truth for "who can edit what" — `canEditField`, `canAddRows`, `canDeleteRows` are the actual authorization gates (role: `"user" | "contributor" | "admin" | "mobile"`), duplicating the intent described in `about/+page.svelte`'s prose. Any permission model change must be made here first, then reflected in the About page copy.
**Risks:** Very large single-responsibility module (739 LOC) mixing five somewhat distinct concerns (field edit tracking, tag diffing, row deletion, row selection, validation) — a good candidate to split into composables if it grows further. `bulkEditField`'s `fieldToWatchlistKey` mapping (`languageId` → `language_id`) is a manual, easy-to-forget translation table between `EditableFields` names and `Watchlist` row-property names; adding a new bulk-editable field that has a differing key name requires remembering to extend this map.

### `column-settings.svelte.ts` (431 LOC) — `.svelte.ts` runes module
**Purpose:** Persists column visibility + order to `localStorage` (`data-table-column-settings` key), including migration from a legacy `data-table-column-visibility`-only format, and self-healing logic that detects "malformed" stored order (e.g., `avg_rating` sorted before `my_rating`/`my_progress_status`, indicating stale data from a previous column layout) and regenerates defaults while preserving visibility choices where possible.
**Exports:** `ColumnSettings` type, `getDefaultColumnOrder(availableColumns)`, `useColumnSettings(getColumnSettings, setColumnSettings, getIsSettingsLoaded, setIsSettingsLoaded, getDefaultColumnOrder)` returning `{ handleColumnVisibilityChange, handleColumnOrderChange }`.
**Key props/state:** No internal `$state` — this module accepts getter/setter callbacks from the caller (`data-table.svelte`) and installs two `$effect`s: one to load-from-storage on mount/order-change, one to save-to-storage on every settings change.
**API calls:** `localStorage.getItem/setItem/removeItem` only.
**Patterns:** Getter/setter-callback dependency injection (rather than owning `$state` itself) so the composable's storage logic stays decoupled from the parent's exact state shape; "preferred order" list (`title, tags, type, language, my_progress_status, my_rating, avg_rating`) hardcodes the canonical default column order, with `user_*_rating` dynamic columns auto-inserted right after `avg_rating`.
**Contributor note:** The malformed-order detection heuristic (`avgRatingOrder < myRatingOrder || avgRatingOrder < myProgressOrder`) is a targeted fix for one specific historical bug (columns saved in an old order) — if the canonical order changes again in the future, old users' `localStorage` will need a similar migration branch added.
**Risks:** `localStorage` schema has now been migrated once already (old→new key) — a third schema change would need yet another migration branch, and the regenerate-vs-patch heuristic (`missingColumns.length > orderedDefaultOrder.length / 2`) is a magic-number threshold that could mis-classify edge cases (e.g., adding many new columns at once could incorrectly trigger a full regenerate and silently reset user preferences).

### `add-item-dialog.svelte` (472 LOC)
**Purpose:** Modal form for contributors/admins to create a new watch item without first entering table edit mode — full field set (title, language, type, tags with autocomplete/create, progress, rating with infinity/shitty toggle), client validation, and direct POST on submit (bypasses the table's local edit-mode changeset entirely).
**Exports:** none.
**Key props/state:** `open` (bindable); form fields `title`/`languageId`/`type`/`progressStatus`/`rating`/`infinity`/`shitty`/`selectedTags`; `newTagInput`/`isTagDropdownOpen`; `isSaving`; `validationErrors: Record<string,string>`; derived `canRate`, `ratingMode` ("infinity"|"shitty"|"rating").
**API calls:** `POST /api/watchlist/bulk-update` with `{ updates: [], newItems: [newItem], deleteIds: [] }` — reuses the *same* bulk endpoint as the table's save flow for a single new item.
**Patterns:** Form reset via `$effect` keyed on `!open`; tag autocomplete dropdown mirrors `editable-tags-cell.svelte`'s UX (search/create pattern) but is a separate, non-shared implementation; on success calls `goto(page.url.toString(), { invalidateAll: true })` to refresh the table without a full page navigation.
**Contributor note:** Duplicates a fair amount of tag-input and rating-toggle UI/logic already present in `editable-tags-cell.svelte`/`editable-rating-cell.svelte` — a shared sub-component for "tag picker" and "rating picker" would reduce ~150 lines of duplication across these three files.
**Risks:** Independent validation logic from `edit-mode.svelte.ts`'s per-field validators — the two validation paths (this dialog's `validateForm()` vs. `EditModeState`'s field-level validators) could drift out of sync (e.g., a new required-field rule added to one but not the other).

### `bulk-edit-panel.svelte` (258 LOC)
**Purpose:** Floating bottom-center panel shown only in edit mode when ≥1 row is selected; lets the user apply a single Progress/Language/Type value or add a single tag to *all* selected rows at once, plus a bulk-delete action (admin only) and a clear-selection action.
**Exports:** none.
**Key props/state:** `data: Watchlist[]` prop (needed so `bulkEditField` can read each selected row's original value for undo tracking); `bulkLanguageId`/`bulkType`/`bulkProgress`/`bulkTag` local form state.
**API calls:** none directly — calls into `edit-mode.svelte.ts`'s `bulkEditField`/`bulkAddTag`/`bulkDeleteSelected`, which only mutate local state (actual persistence happens later via the table's `executeSave`).
**Patterns:** Role-gated sections (`canEditContributorFields` hides Language/Type/Tag controls for plain "user"/"mobile" roles, showing only Progress, which all roles can edit); each control has its own inline "clear selection" (X) + "apply" (check) button pair rather than a single global "Apply all" button.
**Contributor note:** Note that `editOptions` context here is typed with `progressStatuses: string[]` (a plain array) whereas the same context is populated by `data-table.svelte`'s `setContext("editOptions", ...)` (verified at that call site, lines 144–149) with exactly four keys: `languages`, `types`, `tags`, `userRole` — no `progressStatuses` key at all.
**Risks: CONFIRMED BUG.** `progressOptions` is `$derived(editOptions.progressStatuses.map(...))`, but `editOptions.progressStatuses` is `undefined` at runtime (never set by `data-table.svelte`), so opening the Bulk Edit panel (select ≥1 row in edit mode) will throw `TypeError: Cannot read properties of undefined (reading 'map')` when Svelte evaluates this derived value, breaking the entire panel (not just the Progress dropdown). This should be fixed by either adding `progressStatuses: () => filterOptions?.progressStatuses.map(p => p.my_progress_status ?? "unmarked") ?? []` to the `setContext("editOptions", ...)` call in `data-table.svelte`, or hardcoding the four known progress values in `bulk-edit-panel.svelte` directly (as `add-item-dialog.svelte` already does for its own progress dropdown).

### `clickable-cell.svelte` (61 LOC)
**Purpose:** Generic clickable/filterable text cell — renders a value (with a special-cased "Unmarked" label for null progress values) that, on click, calls `filterContext.addFilterValue(filterType, value)` to toggle that value into the active filter set.
**Exports:** none.
**Key props/state:** `value: string | null`, `filterType: "language"|"tags"|"progress"|"type"` props.
**API calls:** none (context-mediated).
**Patterns:** Keyboard-accessible click target (`role="button"`, `tabindex="0"`, Enter/Space handling) — a pattern repeated in `clickable-tags-cell.svelte`, `clickable-title.svelte`, and `row-details-dialog.svelte`'s filter buttons.
**Contributor note:** Despite the generic name, this is **not wired into any current cell** — language/type/progress cells use `EditableSelectCell`'s own `handleClick` (which duplicates this same filter-toggle behavior) instead of this component.
**Risks: CONFIRMED ORPHANED.** A full-text search across `apps/watchlist/src` for `ClickableCell`/`clickable-cell` finds zero references outside this file's own definition — dead code, safe to remove pending team confirmation.

### `clickable-tags-cell.svelte` (51 LOC)
**Purpose:** Renders a comma-joined tags string as a comma-separated list of individually clickable spans, each toggling that tag into the tags filter.
**Exports:** none.
**Key props/state:** `tags: string` prop; `tagList` derived by splitting/trimming.
**API calls:** none.
**Patterns:** Same accessible-click-target pattern as `clickable-cell.svelte`.
**Contributor note:** Like `clickable-cell.svelte`, this is not referenced from `columns.ts` (the `tags` column uses `EditableTagsCell`, which has its own non-edit-mode click-to-filter via `Badge` elements) — superseded/orphaned.
**Risks: CONFIRMED ORPHANED.** A full-text search across `apps/watchlist/src` for `ClickableTagsCell`/`clickable-tags-cell` finds zero references outside this file's own definition.

### `clickable-title.svelte` (71 LOC)
**Purpose:** Splits a title into word/separator segments and makes each word ≥3 characters clickable to toggle it in/out of the search box (via `searchContext.updateSearchQuery`), preserving punctuation/spacing exactly as plain text.
**Exports:** none.
**Key props/state:** `title: string` prop; `segments` derived via regex tokenization (`/([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g`).
**API calls:** none.
**Patterns:** Toggle semantics — clicking a word that's already the active search query clears the search instead of re-setting it.
**Contributor note:** This *is* actively used — it's rendered by `editable-text-cell.svelte` for the `title` field's read-only (non-edit-mode) display.
**Risks:** The 3-character minimum for "clickable" is a hardcoded heuristic (`word.length >= 3`) with no configuration; short but meaningful title words (e.g., "It", "A24") are not clickable by design.

### `column-settings.svelte.ts` — see Section 2 module list above (documented with `edit-mode.svelte.ts` group; full entry given there to avoid duplication).

### `confirm-dialog.svelte` (51 LOC)
**Purpose:** Generic reusable yes/no `AlertDialog` wrapper with configurable title/description/confirm-label/cancel-label/variant.
**Exports:** none.
**Key props/state:** `open` (bindable), `title`, `description`, `confirmLabel="Confirm"`, `cancelLabel="Cancel"`, `variant="destructive"|"default"`, `onConfirm`, `onCancel`.
**API calls:** none.
**Patterns:** Used for both "Discard Changes?" (cancel edit) and "Undo All Changes?" (reset) confirmations in `data-table.svelte` — a single generic component parameterized per call site.
**Contributor note:** Good example of the right level of reusability in this codebase (contrast with `delete-confirmation-dialog.svelte`, which has enough delete-specific logic — typed "DELETE" confirmation, title list — to justify being its own component rather than a `ConfirmDialog` variant).
**Risks:** None significant.

### `data-fetch.svelte.ts` — see Section 2 module list above.

### `delete-confirmation-dialog.svelte` (102 LOC)
**Purpose:** Specialized delete-confirmation dialog shown before saving a changeset that includes row deletions. For single-item deletes, a simple confirm suffices; for bulk deletes (>1 item), requires the user to type "DELETE" (case-insensitive) before the confirm button is enabled.
**Exports:** none.
**Key props/state:** `open` (bindable), `titles: string[]`, `onConfirm`, `onCancel`; local `confirmText`; derived `requireConfirmText` (`titles.length > 1`), `canConfirm`.
**API calls:** none.
**Patterns:** Progressive friction based on blast radius (1 item = simple confirm, N items = typed confirmation) — a deliberate UX safety pattern distinct from the generic `ConfirmDialog`.
**Contributor note:** Shows the list of titles-to-be-deleted directly in the dialog (`data.find(r => r.id === id).title` computed in `data-table.svelte`'s `deleteTitles` derived) so users can visually double check before confirming.
**Risks:** None significant; well-scoped.

### `editable-cell-wrapper.svelte` (86 LOC)
**Purpose:** Shared visual chrome for every editable cell type — renders the cell's `children` snippet and overlays an "undo" button (shown when the cell/row-field has been changed) or an error indicator dot (shown when validation fails), abstracting the edited/error visual state so individual cell components don't reimplement it.
**Exports:** none.
**Key props/state:** `rowId`, `field`, `canEdit`, `children` (snippet), `class`, `additionalFields?: string[]` (for compound cells like rating that touch 3 fields), `onUndo?` (custom undo handler override), `isEditedOverride?` (for tags, which use add/remove-set diffing instead of `changedFields`).
**API calls:** none — delegates to `getEditModeContext()`.
**Patterns:** Composition wrapper pattern — every one of `editable-text-cell`, `editable-select-cell`, `editable-rating-cell`, `editable-tags-cell` wraps its actual input/display markup in this component, giving consistent undo/error UX for free.
**Contributor note:** This is the correct place to add any new global "editable cell" affordance (e.g., a "copy value" button) since all editable cell types funnel through it.
**Risks:** None significant; well-isolated composition component.

### `editable-rating-cell.svelte` (203 LOC)
**Purpose:** Compound editable cell for the "My Rating" column — toggles between a numeric 0–10 input and two exclusive special states (♾️ infinity, 💩 shitty), gated entirely on whether the row's current progress status is `"watched"` or `"dropped"` (read-only "-" with a tooltip otherwise).
**Exports:** none.
**Key props/state:** `rowId`, `rating`, `infinity`, `shitty`, `progressStatus` props; derived `currentProgressStatus`/`currentRating`/`currentInfinity`/`currentShitty` (read directly from `editMode.editedRows` map for reactivity, falling back to props); `currentMode` ("rating"|"infinity"|"shitty").
**API calls:** none — all via `editMode.markFieldEdited`/`undoFieldEdit`/`setValidationError`.
**Patterns:** Compound-field undo — `handleRatingUndo()` calls `undoFieldEdit` for all three related fields (`my_rating`, `my_infinity`, `my_shitty`) together, and `EditableCellWrapper` is told about all three via `additionalFields` so the undo button appears if *any* of them changed; duplicates `getRatingColor` (0–10 hex threshold ramp) already present in `columns.ts`.
**Contributor note:** See `columns.ts`'s note about triplicated rating-color logic — this is the second of three copies.
**Risks:** Same duplication risk as noted for `columns.ts`.

### `editable-select-cell.svelte` (191 LOC)
**Purpose:** Generic dropdown-editable cell used for `type`, `language` (`languageId`), and `my_progress_status` columns. In edit mode, renders a `DropdownMenu` radio-group; in view mode, renders a styled, click-to-filter span with a hardcoded per-field color map (progress status colors, a partial language-name color map).
**Exports:** none.
**Key props/state:** `rowId`, `field: "languageId"|"type"|"my_progress_status"`, `value`, `displayValue`, `options` (prop fallback; actual options come from context for `languageId`/`type`), `placeholder`, `required`, `filterType`; derived `options` (context-injected for language/type, prop-based for progress), `canEdit`, `currentValue`, `currentLabel`.
**API calls:** none.
**Patterns:** Special-case side effect — selecting `my_progress_status` away from `"watched"`/`"dropped"` proactively clears `my_rating`/`my_infinity`/`my_shitty` via `markFieldEdited(..., null/false, ...)`, mirroring the same business rule enforced in `edit-mode.svelte.ts`'s `getChangeset()` for new rows; hardcoded `textColorMap` keyed by field name with commented-out `type` color entries (dead code left in place, `// type: { movie: ..., series: ..., shorts: ... }`).
**Contributor note:** The commented-out `type` color map suggests type-based coloring was tried and rolled back (or paused) — worth checking with the team before either re-enabling or deleting it.
**Risks:** `languageId` colors keyed by *language name* (`English`, `Japanese`, `Hindi`) rather than by ID — a hardcoded, non-exhaustive list that silently falls back to no color for any other language (not a bug, but a maintenance trap if the list of "important" languages grows).

### `editable-tags-cell.svelte` (178 LOC)
**Purpose:** Editable multi-tag cell with add/remove diffing against the original comma-separated `tags` string, autocomplete suggestions from the org-wide tag list (via context), and inline tag creation. In view mode, tags render as clickable `Badge`s that add to the tags filter.
**Exports:** none.
**Key props/state:** `rowId`, `tags: string` (comma-separated) props; derived `originalTags`, `addedTags`, `deletedTags`, `hasTagChanges`, `currentTags` (original minus deleted, plus added, de-duplicated), `availableTags` (all tags minus current), `suggestions` (filtered by input); local `newTagInput`, `isOpen`.
**API calls:** none — `editMode.addTagToRow`/`removeTagFromRow`/`undoTagChanges`.
**Patterns:** Tag diffing rather than replace-the-whole-list — if a tag was previously deleted and gets re-added in the same edit session, it's simply removed from the "deleted" set rather than being tracked as "added" (avoids sending a spurious remove+add pair to the API); uses `isEditedOverride={hasTagChanges}` on `EditableCellWrapper` since tags don't use the standard `changedFields` tracking.
**Contributor note:** Its add-tag dropdown UI (search + "Create X" affordance) is near-identical to `add-item-dialog.svelte`'s tag picker — a good candidate for extraction into a shared `TagPicker` component.
**Risks:** None beyond the noted duplication.

### `editable-text-cell.svelte` (94 LOC)
**Purpose:** Editable single-line text cell (currently only used for `title`), with debounced (300ms) async uniqueness validation against the API and required-field validation.
**Exports:** none.
**Key props/state:** `rowId`, `field: "title"`, `value`, `placeholder`, `required` props; derived `canEdit`, `currentValue`; local `validationTimer`.
**API calls:** `GET /api/watchlist/validate-title?title=...&excludeId=...` (debounced 300ms after each keystroke).
**Patterns:** Debounce-then-validate pattern distinct from the table's own search debounce (separate `setTimeout` per cell instance, cleaned up on destroy); falls back to `ClickableTitle` for read-only display specifically when `field === "title"` (otherwise generic `<span>`), even though the component's prop type is hardcoded to `field: "title"` only — the generic-`<span>` branch is currently unreachable dead code given the type constraint.
**Contributor note:** If this component is ever generalized to support other text fields (e.g., a future free-text field), the title-uniqueness API call inside `validateField` needs to be made conditional (it currently already checks `field === "title"` defensively, so it's mostly ready for that generalization).
**Risks:** Network errors during title-uniqueness validation are silently swallowed (`console.error` only) — a flaky network could let a duplicate title through validation optimistically (fails open, not closed).

### `edit-mode.svelte.ts` — see full entry above.

### `filter-dropdown.svelte` (160 LOC)
**Purpose:** Generic multi-select dropdown filter widget (search box + checkable option list + Clear/Apply buttons) used for every "language"/"tags"/"progress"/"type" column filter, and reused (across a route-group boundary) by the leaderboard page.
**Exports:** none.
**Key props/state:** `options: string[]`, `selectedValues: string[]`, `onApply: (values) => void`, `placeholder` props; local `searchValue`, `tempSelected` (draft selection not committed until Apply), `isOpen`, `dropdownContentRef`.
**API calls:** none.
**Patterns:** "Draft then apply" UX — `tempSelected` is only synced to `selectedValues` on dropdown open/close, so intermediate checkbox toggles don't trigger a `goto()` per click, only on explicit "Apply" (or Enter key, captured via a manually-attached `keydown` listener on the dropdown content div that special-cases the search `<input>` so Enter-to-apply doesn't fire while the input itself is focused... actually it does fire even from the input based on the effect logic, since the guard is `target.tagName === "INPUT"` which returns early — re-reading: the effect skips if focus is on the input, so applying via Enter from the search box specifically does *not* work through this global listener; the search input's own `onkeydown` handler duplicates the Enter-to-apply behavior directly).
**Contributor note:** This is the single most reused "helper" component outside its own folder (leaderboard) — a strong signal it belongs in `$lib/components/` rather than `routes/(public)/data-table-helpers/`.
**Risks:** Path-coupling risk as noted for `leaderboard-content.svelte`.

### `infinite-scroll.svelte.ts` — see full entry above.

### `mobile-filter-dialog.svelte` (262 LOC)
**Purpose:** Full-screen(ish) modal filter UI for mobile viewports, with collapsible sections per filter type (language/tags/type — notably **not** progress), each with its own search box, checkbox list, and selected-value chip row; applies all three filter types atomically on "Apply Filters".
**Exports:** none.
**Key props/state:** `open` (bindable), `languageOptions`/`tagOptions`/`typeOptions`, `selectedLanguages`/`selectedTags`/`selectedTypes`, `onApply` props; local `tempLanguages`/`tempTags`/`tempTypes`, per-section search strings, per-section `*Expanded` booleans (auto-expanded on open if that filter already has selections).
**API calls:** none — `onApply` callback triggers the parent's URL update.
**Patterns:** Same draft-then-apply pattern as `filter-dropdown.svelte`, but consolidated across three filter types in one dialog since mobile lacks per-column header space for individual `FilterDropdown`s.
**Contributor note:** Progress filter is deliberately excluded from mobile filtering (only language/tags/type) — likely because Progress is more naturally accessed via the default "views" (Watch Later/Watching links) shown in `overlay.svelte`, but this isn't documented anywhere in code comments.
**Risks:** If a future requirement adds mobile progress-filtering, this dialog and its `onApply` signature (`{ language, tags, type }`) will need extending, plus the call site in `data-table.svelte` (`filters.progress` is explicitly passed through unchanged: `progress: filters.progress`).

### `row-actions-cell.svelte` (68 LOC)
**Purpose:** Per-row edit-mode action cell — shows a remove (X) button for new/draft rows (available to any role that can add rows), or a delete-toggle (trash/undo icon) for existing rows, admin-only.
**Exports:** none.
**Key props/state:** `rowId`, `isNewRow` props; derived `userRole`, `canDelete`, `isDeleted`.
**API calls:** none — `editMode.removeNewRow`/`markRowDeleted`/`unmarkRowDeleted`.
**Patterns:** Icon-swap based on state (trash vs. rotate-ccw) rather than separate buttons.
**Contributor note:** None beyond standard row-action pattern.
**Risks:** None significant.

### `row-details-dialog.svelte` (135 LOC)
**Purpose:** Mobile-only detail popover triggered by a long-press (500ms `touchstart`/`touchend`/`touchmove` handling in `data-table.svelte`) on a table row, showing Type/Language/Tags as clickable filter buttons (with haptic feedback via `navigator.vibrate(50)` on long-press trigger, wired in the parent).
**Exports:** none.
**Key props/state:** `open` (bindable), `row: Watchlist | null` props; derived `tagList`, `isLanguageFiltered`, `isTypeFiltered`, `isTagFiltered` (as a function).
**API calls:** none.
**Patterns:** Provides on mobile the same "click value to filter" affordance that desktop gets for free via inline clickable cells (since mobile hides most columns), essentially acting as mobile's row-level filter shortcut menu.
**Contributor note:** Only rendered when `isMobile` is true in `data-table.svelte` — no desktop equivalent, and reasonably so given desktop already exposes these values as visible/clickable cells.
**Risks:** None significant.

### `select-row-cell.svelte` (69 LOC)
**Purpose:** Row/header selection checkbox cell for bulk operations — header checkbox supports tri-state (all/some/none selected among non-deleted rows), and individual row checkboxes support shift-click range selection.
**Exports:** none.
**Key props/state:** `rowId`, `rowIndex`, `allRowIds`, `isHeader` props; derived `isSelected`, `isDeleted`, `allSelected`, `someSelected` (header-only, excludes deleted rows from the denominator).
**API calls:** none — `editMode.selectAllRows`/`clearSelection`/`toggleRowSelection`/`handleShiftSelect`/`setLastSelectedIndex`.
**Patterns:** Shift-click range-select implemented by intercepting the click event before the checkbox's own change handler (`onclick` checks `e.shiftKey` and calls `handleShiftSelect` directly, bypassing the normal toggle path) — relies on `editMode.lastSelectedIndex` as anchor.
**Contributor note:** Deleted rows are excluded from bulk-select-all and cannot be individually checked (`disabled={!isHeader && isDeleted}`), preventing accidental double-processing of a row already marked for deletion.
**Risks:** None significant.

### `unsaved-changes-dialog.svelte` (36 LOC)
**Purpose:** Three-way choice modal ("Save & Continue" / "Discard & Continue" / "Stay Here") shown when the user attempts a server-triggering navigation (sort/filter/search change) while edit mode has unsaved changes — implemented via `checkUnsavedChanges(action)` in `data-table.svelte`, which stashes the pending action and shows this dialog instead of executing immediately.
**Exports:** none.
**Key props/state:** `open` (bindable), `onSaveAndContinue`, `onDiscardAndContinue`, `onCancel` props.
**API calls:** none directly (delegates to parent-supplied callbacks, which do call the save/discard flows).
**Patterns:** Deferred-action pattern — the "pending server action" is a closure captured before the dialog opens and invoked afterward, letting this dialog stay fully generic about *what* triggered it (sort, filter, search — all funnel through the same `checkUnsavedChanges` gate).
**Contributor note:** This is the mechanism that actually protects against silent data loss when a user changes a sort/filter mid-edit — important to preserve when refactoring `data-table.svelte`'s URL-sync effects.
**Risks:** None significant; the "trigger points" for `checkUnsavedChanges` are worth auditing — need to confirm every URL-mutating action in edit mode routes through it consistently (a quick grep shows it's used, but a new future filter/sort entry point could bypass it if added carelessly).

### `user-rating-selector.svelte` (127 LOC)
**Purpose:** Desktop-only "Users" dropdown letting a logged-in, email-verified user pick which other users' ratings should appear as extra dynamic columns in the table (backing `createUserRatingColumns` in `columns.ts` and the `userRatingPreferences` DB table queried in `+page.server.ts`).
**Exports:** none.
**Key props/state:** `allUsers: User[]`, `selectedUserIds: string[]`, `searchQuery`, `isLoading`, `isSaving`; derived `filteredUsers`, `selectedCount`.
**API calls:** `GET /api/users` + `GET /api/user-rating-preferences` (parallel, on mount); `POST /api/user-rating-preferences` with `{ preferredUserIds }` on each toggle.
**Patterns:** Optimistic UI update (toggles `selectedUserIds` immediately) followed by a save request; on save success, calls `goto(page.url.toString(), { invalidateAll: true })` to force the server load to re-fetch the now-different set of dynamic user-rating columns; on save failure, reverts by re-fetching from the server (`fetchData()`) rather than manually rolling back the optimistic change.
**Contributor note:** This is the only feature-level control that changes the table's *column set* (not just filtering/sorting) at runtime — a change here cascades through `+page.svelte`'s `userRatingColumns`/`allColumns`/`filteredColumns` derivation chain.
**Risks:** Every toggle triggers its own independent save+reload round trip (no batching of rapid successive clicks) — a user rapidly toggling multiple checkboxes could fire overlapping `invalidateAll` navigations; not catastrophic (last request wins) but not debounced either.

---

## 3. Feature Components (`$lib/components/*`, non-shadcn)

### `background.svelte` (513 LOC)
**Purpose:** Renders a large static SVG mosaic (a purple-gradient tile grid, ~140 hardcoded `<rect>` tiles) used as the app's full-viewport fixed background, with an optional CSS `feTurbulence`/`feDisplacementMap` filter for a "glass/texture" look and eight selectable procedural animation modes (radial wave, left-to-right, top-to-bottom, diagonal wave, checkerboard, spiral, random-stagger) that stagger each tile's CSS animation-delay based on its position.
**Exports:** none.
**Key props/state:** `enableFilter?: boolean = true`, `enableAnimation?: boolean = true` props; `animations` is a local const object of positional-delay functions keyed by name, one chosen at random `onMount` when `enableAnimation` is true.
**API calls:** none.
**Patterns:** DOM-query-based post-render styling (`document.querySelectorAll(".tile")`, mutating `.style.animationDelay` imperatively) rather than binding style via Svelte reactivity — deliberate for performance (140 tiles) but bypasses Svelte's own reactivity model entirely; mobile handling via a CSS media query that rotates the whole background 90° and rescales it (`transform: rotate(90deg)`) rather than a different SVG layout, since the SVG's aspect ratio doesn't match typical portrait mobile screens.
**Contributor note:** `enableFilter=true, enableAnimation=false` is the configuration actually used in `+layout.svelte` — the eight animation functions are effectively dead code paths in production today (filter is on, animation is off) unless re-enabled somewhere else; worth checking if `enableAnimation` is toggled anywhere (a quick grep shows only the one usage in `+layout.svelte`).
**Risks:** All tile coordinates/colors are hand-authored inline SVG (not generated/data-driven) — any future redesign of the mosaic requires manually editing ~140 `<rect>` elements; the random animation selection means the choice isn't deterministic/testable without seeding, though this is moot since animation is currently disabled at the call site.

### `overlay.svelte` (774 LOC)
**Purpose:** Despite its generic name, this is the **top navigation/app bar** — not a modal overlay. It shows the app icon + current "view" name (editable inline for custom saved views), Dashboard/Leaderboard/About icon links, desktop badges for default/favorite saved views plus a dropdown for the rest, Save/Clear/New/Delete view action buttons, a Copy-URL share button, and on the right side either a Login button, a loading indicator, or the user's role badge + username + `LogoutButton`. Also implements the full CRUD flow for the "saved views" feature (named, shareable filter/sort/search presets persisted server-side per user).
**Exports:** none.
**Key props/state:** No external props — reads `authClient.useSession()` directly. Extensive local state: `isMobile`, `mobileMenuOpen`, `views: View[]` (fetched), `isLoadingViews`, `selectedViewName`, `isManualSelection` (guards against URL-driven view-selection effects overriding a just-made manual choice), `isEditingName`/`editedName`, `deleteDialogOpen`/`viewToDelete`; derived `selectedView`, `allViewsExcludingSelected`, `defaultAndFavoriteViews`, `remainingViews`, `effectiveRole` (forces `"mobile"` below 768px, mirroring `data-table.svelte`'s pattern).
**API calls:** `GET /api/views` (fetch on mount/user-change); `PUT /api/views/:viewName` (save filters, rename, toggle favorite — three different payload shapes through one endpoint); `POST /api/views?<current-query-string>` (create a new view snapshotting the current URL's filters); `DELETE /api/views/:viewName`.
**Patterns:** Three hardcoded `defaultViews` (Watchlist `/`, Watch Later `/?filterProgress=watch_later`, Watching `/?filterProgress=watching`) are always present alongside server-persisted custom views and are visually/behaviorally indistinguishable except they can't be renamed/deleted (`isDefaultView` guard everywhere); URL↔selected-view two-way sync via a `$effect` with a manual-override escape hatch (`isManualSelection`) to prevent the URL-matching effect from immediately re-selecting a different view right after the user explicitly picks one (a very similar "echo suppression" pattern to `data-table.svelte`'s pending-sort/filter values, but implemented independently here rather than sharing logic); inline rename via a focused `<Input>` that swaps in for the `<a>` view-name link, saved on Enter/check-icon click, cancelled on Escape/X-icon click.
**Contributor note:** This component and `data-table.svelte` independently reimplement a very similar "reconcile local UI state with just-navigated URL without fighting each other" pattern (`isManualSelection` here vs. `pendingSorting`/`pendingFilters`/`pendingQuery` there) — extracting a shared `useUrlSyncedState`-style composable would reduce duplicated subtlety across the two largest files in this app.
**Risks:** High complexity for a "just render the nav bar" component — it owns the entire saved-views feature's CRUD + optimistic-ish UI, not just navigation chrome; the desktop/mobile view-menu markup is duplicated almost entirely twice (a `{#each defaultAndFavoriteViews}` + dropdown block for desktop, and a separate near-identical `{#each ...}` IIFE-computed list for mobile) rather than sharing one render path gated by a CSS/display class, meaning any future view-menu-item feature (e.g., adding an icon) must be added in two places.

### `logout-button.svelte` (30 LOC)
**Purpose:** Single-purpose button that calls Better Auth's `signOut()` and then navigates to `/login`, with a loading spinner while in flight.
**Exports:** none.
**Key props/state:** `class` prop (styling passthrough via `cn()`); local `loading`.
**API calls:** `authClient.signOut()`.
**Patterns:** Minimal, single-responsibility component — the smallest in this deep-dive.
**Contributor note:** No error toast/feedback shown if `signOut()` throws — only `console.error` and the loading flag resets, leaving the user on the same page with the button clickable again.
**Risks:** Silent failure path on sign-out error (no user-facing feedback).

### `theme-button.svelte` (14 LOC)
**Purpose:** Light/dark mode toggle button using the `mode-watcher` library's `toggleMode()`, with animated sun/moon icon crossfade via Tailwind dark-mode variant classes.
**Exports:** none.
**Key props/state:** `class` prop only.
**API calls:** none (delegates entirely to `mode-watcher`).
**Patterns:** Two icons stacked/absolutely positioned with opposing `scale`/`rotate` transitions gated by the `dark:` variant, rather than conditionally rendering one icon — avoids layout shift and gives a smooth crossfade.
**Contributor note:** Smallest, simplest component in the feature set.
**Risks: CONFIRMED ORPHANED.** A full-text search across `apps/watchlist/src` for `ThemeButton`/`theme-button` finds zero references outside this file's own definition — not imported by `+layout.svelte`, `overlay.svelte`, or any other route/component. The app currently has no visible light/dark toggle in the UI despite `mode-watcher` being wired up (per the `dark:` variants used throughout, e.g., `logout-button.svelte`'s styling) — theme switching may rely purely on OS-level `prefers-color-scheme` with no manual override exposed to users.

### `pwa-install-button.svelte` (72 LOC)
**Purpose:** Floating bottom-right "Install" button that captures the browser's `beforeinstallprompt` event (Chromium/Android) to trigger the native PWA install flow, and shows a manual "Add to Home Screen" hint alert for iOS (which doesn't support `beforeinstallprompt`).
**Exports:** none.
**Key props/state:** `deferredPrompt: BeforeInstallPromptEvent | null`, `canInstall`, `showIosHint`.
**API calls:** none (browser PWA APIs only: `beforeinstallprompt`, `appinstalled`, `matchMedia("(display-mode: standalone)")`, UA-sniffing for iOS).
**Patterns:** Standard PWA install-prompt capture pattern (`event.preventDefault()` + stash the event for later `.prompt()` call); iOS detection via UA string + `MacIntel` + multi-touch heuristic (needed because iPadOS reports as `MacIntel` in its UA).
**Contributor note:** Mounted globally in the root `+layout.svelte` (visible on every page, including auth pages) — combined with `Overlay`'s own fixed positioning, worth checking for visual overlap on small screens with both nav and install button plus the mobile floating add/filter buttons from `data-table.svelte` all competing for bottom/corner screen real estate.
**Risks:** `window.alert(...)` for the iOS hint is a blocking, unstyled native browser dialog — inconsistent with the rest of the app's toast/dialog UI (`svelte-sonner` toasts, shadcn `Dialog`/`AlertDialog`) used everywhere else.

### `dashboard/donut-chart.svelte` (159 LOC)
**Purpose:** Generic CSS-`conic-gradient`-based donut/pie chart with a center total and a side legend — used for Media Type Mix and Progress breakdowns on the dashboard.
**Exports:** none.
**Key props/state:** `title`, `data: Slice[]` (`{label, count, color}`), `emptyLabel="No data yet"` props; derived `total`, `gradient` (CSS string).
**API calls:** none (pure presentational chart).
**Patterns:** No SVG/canvas/charting library — pure CSS `conic-gradient` computed from cumulative percentages, a lightweight dependency-free charting approach consistent with the other three chart components.
**Contributor note:** All dashboard charts follow this same "pure CSS, no charting library" philosophy — any future chart type should follow suit for consistency/bundle-size reasons rather than introducing a charting dependency.
**Risks:** Accessibility is `role="img"` + `aria-label={title}` only — the legend beside the donut does convey the same data as text, so screen-reader users aren't fully blocked, but the chart itself has no per-slice accessible description.

### `dashboard/histogram-chart.svelte` (104 LOC)
**Purpose:** Simple CSS-bar-based histogram for rating-distribution buckets.
**Exports:** none.
**Key props/state:** `title`, `data: Bucket[]` (`{bucket, count}`), `emptyLabel="No ratings yet"` props; derived `maxCount`; `barHeight(count)`/`formatBucket(bucket)` helpers.
**API calls:** none.
**Patterns:** CSS Grid `auto-fit` columns for responsive bar count without JS-computed breakpoints; minimum 6% bar height floor so near-zero counts remain visible/hoverable.
**Contributor note:** Consistent minimal-dependency charting approach.
**Risks:** None significant.

### `dashboard/horizontal-bar-chart.svelte` (110 LOC)
**Purpose:** Generic horizontal proportional-bar-chart list (label + value + bar), used for Titles-by-Language, Top-Tags, and both Avg-Rating-by-Type/Language charts.
**Exports:** none.
**Key props/state:** `title`, `data: BarItem[]` (`{label, value, color?, displayValue?}`), `emptyLabel`, `valueSuffix=""` props; derived `maxValue`.
**API calls:** none.
**Patterns:** Same bar-track/bar-fill CSS approach reused (and near-identical markup/CSS) to `leaderboard-content.svelte`'s inline ranking bars — another case of parallel, non-shared implementations of the same visual idiom.
**Contributor note:** `displayValue` override lets callers show formatted text (e.g., `"7.42"` for avg rating) while `value` drives the proportional bar width using the raw number — a clean separation of display vs. layout concerns.
**Risks:** None significant beyond the noted duplication with the leaderboard's bar markup.

### `dashboard/stacked-bar-chart.svelte` (149 LOC)
**Purpose:** Stacked horizontal bar chart per "type" row, segmented by "status" (e.g., Progress-by-Type: each media type's bar is divided into Watched/Watching/etc. segments), with a shared legend.
**Exports:** none.
**Key props/state:** `title`, `data: Row[]` (`{type, status, count}` flat rows), `statusColors: Record<string,string>`, `emptyLabel` props; derived `types`, `statuses` (deduped from data), `rows` (pivoted: type → list of status segments + total), `hasData`.
**API calls:** none.
**Patterns:** Client-side pivot of a flat `{type, status, count}[]` array into a grouped structure for rendering — the heaviest data-transformation logic among the four chart components; uses CSS flexbox `flex: ${count} 1 0` per segment for proportional width rather than manually computed percentages.
**Contributor note:** The pivot logic here (`types`/`statuses`/`rows` derivation) could itself be pushed server-side into `$lib/server/dashboard.ts` if the flat-row shape isn't otherwise needed by the client, but keeping it client-side does allow this component to remain fully generic/reusable for any type×status breakdown.
**Risks:** None significant.

### `dashboard/stat-card.svelte` (23 LOC)
**Purpose:** Small KPI display card (label + big number + optional hint text) — the simplest dashboard building block, used ~14 times across the dashboard page for all the top-row KPIs.
**Exports:** none.
**Key props/state:** `label`, `value: string|number`, `hint?` props.
**API calls:** none.
**Patterns:** Trivial presentational wrapper around shadcn `Card.*`.
**Contributor note:** None.
**Risks:** None.

---

## 4. Synthesis

### 4.1 Route Map

| URL | File | Auth Requirement | Purpose |
|---|---|---|---|
| `/` | `(public)/+page.svelte` + `+page.server.ts` | None (public) — but edit/add/delete features are role-gated client-side via `userRole`/`isEmailVerified` | The watchlist itself: searchable/sortable/filterable data table with infinite scroll, edit mode, bulk edit, saved views |
| `/about` | `(public)/about/+page.svelte` | None | Static marketing/feature/role documentation page |
| `/dashboard` | `(public)/dashboard/+page.svelte` + `+page.server.ts` | None to view catalog scope; must be logged in (`isLoggedIn`) to access `?scope=personal` toggle (UI hides the toggle otherwise, not server-enforced) | Analytics dashboard (KPIs + 6 chart types), catalog vs. personal scope |
| `/leaderboard` | `(public)/leaderboard/+page.svelte` + `+page.server.ts` | None | Ranked list of users by watch-item count, filterable by type/language/tags, switchable metric |
| `/login` | `(auth)/login/+page.svelte` | Redirects away if already logged in **and** verified (`hooks.server.ts`) | Email or username login; inline resend-verification on 403 |
| `/sign-up` | `(auth)/sign-up/+page.svelte` | Same auth-layout redirect rule | Account registration with strong-password validation |
| `/forgot-password` | `(auth)/forgot-password/+page.svelte` | Same | Request password-reset email |
| `/reset-password` | `(auth)/reset-password/+page.svelte` | Same (token-based, no session needed) | Consume reset token, set new password |
| `/verify-email` | `(auth)/verify-email/+page.svelte` | Explicitly excluded from the "already logged in → redirect" rule (`allowedAuthRoutes`) | Landing page after clicking the email verification link; shows success/error only |
| `/check-email` | `(auth)/check-email/+page.svelte` | Also excluded from the redirect rule; also the server-side redirect target for unverified users hitting `(protected)/*` | "We sent an email" holding page, reused for signup/resend/forgot flows and the verify-required redirect |
| `/list` | `(protected)/list/+page.svelte` | Requires session **and** verified email (`hooks.server.ts` `(protected)` branch) | **Orphaned/dead route** — no incoming links found anywhere in `src`; content is literally the text "Login Required" with no script |

Route-group semantics (enforced in `src/hooks.server.ts`, not by folder name alone):
- `(auth)/*`: if a verified session exists, redirect to `/`; unverified sessions may still reach `verify-email`/`check-email`.
- `(protected)/*`: requires a session (redirect to `/login` if absent) **and** a verified email (redirect to `/check-email?reason=verify` if unverified). Currently only guards the orphaned `/list` route.
- `(public)/*`: no server-side gate at all — includes the actual watchlist home page, dashboard, leaderboard, about. All feature-level access control for editing/adding/deleting rows happens client-side via `userRole`/`isEmailVerified` checks inside the data table, not via route guards.

### 4.2 Data Table Architecture

**Fetch/pagination:** `+page.server.ts` performs the initial SSR fetch (page 0, 25 items) via `getWatchlistForUser`, plus 7 additional queries for filter-option facets (4 filtered-distinct-value queries cross-filtered against the *other* active filters, 3 unfiltered "all values" queries for edit-mode dropdowns). Client-side, `useDataFetch` (in `data-table-helpers/data-fetch.svelte.ts`) owns subsequent pages: it resets to page 0 whenever search/sort/filter parameters change, tracks `hasMore` by comparing the last page's item count to `pageSize` (25), and re-syncs from `+page.server.ts`'s `data` prop whenever SvelteKit's `invalidateAll` re-runs the load (e.g., after a sort/filter `goto()` or a successful save). Actual network calls hit `GET /api/watchlist` with `pageIndex`/`q`/`sortBy`/`sortOrder`/`filterLanguage`/`filterTags`/`filterProgress`/`filterType` params, built by a `fetchUrl` callback defined in `(public)/+page.svelte`.

**Infinite scroll:** `useInfiniteScroll` (in `infinite-scroll.svelte.ts`) wraps an `IntersectionObserver` watching a sentinel `<div data-sentinel="true">` rendered as the last table row (only when there are results); calls `loadMore()` with a 500ms debounce floor and an `enabled` gate tied to `hasMore`.

**Edit mode:** Entirely client-side state (`edit-mode.svelte.ts`'s `createEditModeState()`), provided via Svelte context (`editModeContext`) from `data-table.svelte` down to every cell/dialog/panel component. Tracks, per row: field-level edits with original-value snapshots for undo, tag add/remove diffs, deletion flags, and multi-selection (with shift-click range select). New draft rows use `temp-{uuid}` IDs and are rendered inline (prepended) by merging into `tableData`. On Save, `getChangeset()` flattens all of this into `{ updates, newItems, deleteIds }` and POSTs once to `/api/watchlist/bulk-update`; the response's success/error counts drive toast notifications, and a successful save triggers `goto(url, { invalidateAll: true })` to reload fresh server data before clearing edit state. Business rule enforced in three places (`editable-select-cell.svelte`, `edit-mode.svelte.ts::getChangeset`, and implicitly `editable-rating-cell.svelte`'s `canRate` gate): ratings are only meaningful when `my_progress_status` is `"watched"` or `"dropped"`; changing progress away from those clears rating/infinity/shitty automatically.

**Filters:** Four filter dimensions (language, tags, progress, type), each backed by a `FilterDropdown` (desktop, per-column-header) or consolidated into `MobileFilterDialog` (mobile, minus progress) or `RowDetailsDialog` (mobile, long-press per-row). All filter state is the *URL* (`filterLanguage`, `filterTags`, `filterProgress`, `filterType` query params, comma-separated multi-values) — `data-table.svelte` maintains a local `filters` state object mirrored to/from the URL with an echo-suppression mechanism (`pendingFilters`) to avoid the URL-sync effect fighting an in-flight `goto()`. Clicking any filterable cell value (language, type, tag badges, progress label) toggles that value into the corresponding filter via a `filterContext` provided from the same component.

**Search:** A single free-text `q` param filters by title (server-side, inside `getWatchlistForUser`, not reviewed in this pass). Client debounces input by 300ms before updating the URL (`replaceState: true`, `invalidateAll: false` — search doesn't force a full data.reload signal the way sort/filter do, since `useDataFetch`'s own effect detects the `searchQuery` change and resets itself). Clicking a word (≥3 chars) in a title (`ClickableTitle`) toggles it as the active search query.

**Columns:** Static definitions in `columns.ts` (select, order, title, tags, type, language, progress, my_rating, avg_rating, actions) plus dynamically-generated per-preferred-user rating columns (`createUserRatingColumns`, driven by `user-rating-selector.svelte` + server-persisted `userRatingPreferences`). Visibility/order are persisted to `localStorage` via `column-settings.svelte.ts`, with drag-and-drop reordering (`svelte-dnd-action`) in the Columns dropdown. Mobile forces a reduced visible-column set (`order`, `title`, `my_progress_status`, `my_rating`, `avg_rating`) and hides `select`/`actions` regardless of stored settings.

**Bulk edit:** `BulkEditPanel` appears as a floating bottom panel whenever ≥1 row is selected in edit mode, offering single-value bulk apply for Progress (all roles), Language/Type/Add-Tag (contributor/admin only), and bulk delete (admin only) — all via `edit-mode.svelte.ts`'s `bulkEditField`/`bulkAddTag`/`bulkDeleteSelected`, which stage changes into the same edit-mode state consumed by the eventual single Save action (no separate bulk-specific API call).

### 4.3 Auth Pages Behavior — `authClient` methods used

| Page | `authClient` method(s) | Notes |
|---|---|---|
| `login` | `authClient.signIn.email(...)`, `authClient.signIn.username(...)` | `rememberMe: true` always; both variants checked for `result.error`, with special 403/"email"+"verif" string-matching to surface a resend-verification UI |
| `sign-up` | `authClient.signUp.email(...)` | `callbackURL` set to `/verify-email` |
| `forgot-password` | *(none — raw `fetch` to `${PUBLIC_BASE_AUTH_URL}/forgot-password`)* | Bypasses the Better Auth client SDK entirely |
| `reset-password` | *(none — raw `fetch` to `${PUBLIC_BASE_AUTH_URL}/reset-password`)* | Same pattern; token comes from `?token=` |
| `verify-email` | *(none)* | Purely a post-redirect landing page; verification itself happens server-side before the browser lands here |
| `check-email` | *(none — raw `fetch` to `${PUBLIC_BASE_AUTH_URL}/send-verification-email`)* | Resend action shared with `login`'s resend button (duplicated fetch call, not extracted to a shared helper) |
| `logout-button.svelte` (global) | `authClient.signOut()` | Used from `overlay.svelte`'s nav bar |
| `overlay.svelte` / root `+layout.svelte` | `authClient.useSession()` | Reactive session store consumed everywhere role/verification checks are needed |

Three flows (`forgot-password`, `reset-password`, `check-email`'s resend) bypass the `authClient` SDK in favor of raw `fetch` calls directly against `PUBLIC_BASE_AUTH_URL`, while `login`/`sign-up`/`logout` use the SDK. This split is likely because the SDK doesn't expose those particular Better Auth REST endpoints as typed client methods, but it does mean error-handling shape differs (SDK calls get a typed `{ error }` result object; raw fetches get a raw JSON body checked with `data.message ?? data.error ?? "..."` fallback chains).

### 4.4 Dashboard / Leaderboard UI Behavior

**Dashboard (`/dashboard`):** Server-rendered KPIs + 6 chart types (type-mix donut, progress donut, language horizontal-bar, top-tags horizontal-bar, progress-by-type stacked-bar, rating histogram, avg-rating-by-type/language horizontal-bars). A "Catalog" vs. "My Stats" scope toggle (visible only when `data.isLoggedIn`) is implemented as a URL query param (`?scope=personal`) rather than client state, so the toggle choice is a full server round-trip (`goto` → server `load` re-runs `getDashboardData(userId, scope)`) and is shareable/bookmarkable. All charts are pure-CSS, dependency-free (no chart library), and reused unchanged between scopes — only the underlying `data`/`title` props swap. Personal scope adds a second KPI row (Watched/Watch-Later/Watching/Dropped/Unmarked/Infinity/Shitty counts) not shown in catalog scope.

**Leaderboard (`/leaderboard`):** A metric tab-switcher (Watched/Watching/Watch Later/Dropped/All Rated) plus three `FilterDropdown`s (type/language/tags, reused from the data-table-helpers folder) drive `getLeaderboardData(metric, filters)` via URL params parsed by the shared `parseLeaderboardParams` helper (used identically by both the server load and the client component, avoiding drift). Rankings render as a list with rank-colored medal styling for top 3 and proportional bar-chart visualization per entry, using hand-rolled scoped CSS rather than Tailwind utilities (an outlier relative to the rest of the app's styling approach) and duplicating the bar-track/bar-fill visual idiom already implemented generically in `dashboard/horizontal-bar-chart.svelte`.

Both pages share the same fail-soft pattern: server `load` catches all errors, logs via `console.error`, and returns a null/empty data shape; the page component then renders a generic "Unable to load ... data. Make sure the database is running and try again." card rather than distinguishing "no data" from "load failed."

### 4.5 Client State Management Patterns (`.svelte.ts` runes modules)

Four `.svelte.ts` modules encapsulate all non-trivial client state as composables using Svelte 5 runes (`$state`, `$derived`, `$effect`) outside of `.svelte` component files:

1. **`data-fetch.svelte.ts`** — generic paginated-fetch composable; getter-based public API (`get data()`, `get hasMore()`); resets itself on parameter-change detection via manually-tracked "last value" state variables.
2. **`infinite-scroll.svelte.ts`** — generic `IntersectionObserver` wrapper; lazily creates the observer via `$effect` once a sentinel element is registered via a mount callback rather than a bindable prop.
3. **`edit-mode.svelte.ts`** — the largest and most complex module (739 LOC); a full state-machine object created per `data-table.svelte` instance via `createEditModeState()` and shared downward via Svelte context (`setEditModeContext`/`getEditModeContext`), rather than a module-level singleton store — this means edit-mode state is correctly scoped per table instance and does not leak across navigations/instances. Every mutation replaces `Map`/`Set` state wholesale (`new Map(old).set(...)`) rather than mutating in place, which is required for Svelte 5's fine-grained reactivity to detect changes to non-primitive state.
4. **`column-settings.svelte.ts`** — persistence-oriented composable that doesn't own its own `$state` at all; instead it accepts getter/setter callback pairs from the caller and installs `$effect`s to load-on-mount and save-on-change against `localStorage`, keeping the persistence logic decoupled from where the actual reactive state lives.

**Cross-cutting pattern — "echo suppression" for URL-synced state:** Both `data-table.svelte` (for `sorting`, `filters`, `searchValue`) and `overlay.svelte` (for `selectedViewName`) independently implement variations of the same problem: local component state that should stay in sync with `page.url.searchParams`, but where a user-initiated change triggers a `goto()` whose resulting URL update would otherwise be caught by the same sync-from-URL `$effect` and potentially "un-apply" or race the very change that was just made. `data-table.svelte` solves this with explicit `pending*` string echo trackers (compare the just-navigated-to expected URL string against the actual URL once it updates, and only resume normal syncing once they match); `overlay.svelte` solves a very similar problem with a single `isManualSelection` boolean flag. Neither implementation is shared — this is the most valuable candidate for extraction into a shared `$lib` composable identified in this deep-dive.

**Context-as-dependency-injection:** `data-table.svelte` provides four contexts (`editModeContext`, `editOptions`, `filterContext`, `searchContext`) consumed by nearly every file in `data-table-helpers/`. This is the primary mechanism connecting ~20 small, otherwise-decoupled components into one coherent feature without prop drilling, at the cost of implicit coupling — a cell component rendered outside `data-table.svelte`'s subtree (e.g., in a test harness) will throw or silently receive `undefined` context.

### 4.6 Component Inventory (Feature Components Only)

| Component | LOC | Category | Reused By |
|---|---|---|---|
| `background.svelte` | 513 | Global chrome | `+layout.svelte` |
| `overlay.svelte` | 774 | Global chrome / nav / saved-views feature | `+layout.svelte` |
| `logout-button.svelte` | 30 | Auth action | `overlay.svelte` |
| `theme-button.svelte` | 14 | Theme toggle | *(confirmed orphaned — zero references anywhere in `src`)* |
| `pwa-install-button.svelte` | 72 | PWA install prompt | `+layout.svelte` |
| `dashboard/donut-chart.svelte` | 159 | Chart primitive | `dashboard/+page.svelte` (×2) |
| `dashboard/histogram-chart.svelte` | 104 | Chart primitive | `dashboard/+page.svelte` (×1) |
| `dashboard/horizontal-bar-chart.svelte` | 110 | Chart primitive | `dashboard/+page.svelte` (×4) |
| `dashboard/stacked-bar-chart.svelte` | 149 | Chart primitive | `dashboard/+page.svelte` (×1) |
| `dashboard/stat-card.svelte` | 23 | KPI primitive | `dashboard/+page.svelte` (×~14) |
| `data-table.svelte` | 1472 | Feature root | `(public)/+page.svelte` |
| `columns.ts` | 345 | Column definitions | `(public)/+page.svelte`, `data-table.svelte` |
| `add-item-dialog.svelte` | 472 | Dialog | `data-table.svelte` |
| `bulk-edit-panel.svelte` | 258 | Panel | `data-table.svelte` |
| `mobile-filter-dialog.svelte` | 262 | Dialog | `data-table.svelte` |
| `edit-mode.svelte.ts` | 739 | State module | `data-table.svelte` + all editable-cell/action components |
| `column-settings.svelte.ts` | 431 | State module | `data-table.svelte` |
| `data-fetch.svelte.ts` | 229 | State module | `(public)/+page.svelte` |
| `infinite-scroll.svelte.ts` | 94 | State module | `(public)/+page.svelte` |
| `filter-dropdown.svelte` | 160 | Filter widget | `data-table.svelte` (×4 columns), `leaderboard-content.svelte` (×3) |
| `editable-text-cell.svelte` | 94 | Editable cell | `columns.ts` (title) |
| `editable-select-cell.svelte` | 191 | Editable cell | `columns.ts` (type, language, progress) |
| `editable-tags-cell.svelte` | 178 | Editable cell | `columns.ts` (tags) |
| `editable-rating-cell.svelte` | 203 | Editable cell | `columns.ts` (my_rating) |
| `editable-cell-wrapper.svelte` | 86 | Composition wrapper | all 4 editable-cell components |
| `row-actions-cell.svelte` | 68 | Row action | `columns.ts` (actions column) |
| `select-row-cell.svelte` | 69 | Row action | `columns.ts` (select column) |
| `row-details-dialog.svelte` | 135 | Mobile dialog | `data-table.svelte` |
| `delete-confirmation-dialog.svelte` | 102 | Confirmation dialog | `data-table.svelte` |
| `unsaved-changes-dialog.svelte` | 36 | Confirmation dialog | `data-table.svelte` |
| `confirm-dialog.svelte` | 51 | Generic confirmation dialog | `data-table.svelte` (×2 call sites) |
| `user-rating-selector.svelte` | 127 | Feature control | `data-table.svelte` |
| `clickable-title.svelte` | 71 | Click-to-filter/search | `editable-text-cell.svelte` |
| `clickable-cell.svelte` | 61 | Click-to-filter | *(confirmed orphaned — zero references anywhere in `src`)* |
| `clickable-tags-cell.svelte` | 51 | Click-to-filter | *(confirmed orphaned — zero references anywhere in `src`)* |

**Confirmed-orphaned components identified during this deep-dive (verified via full-text search across `apps/watchlist/src`, zero incoming references beyond their own definitions):** `clickable-cell.svelte` and `clickable-tags-cell.svelte` (superseded by inline click-to-filter logic in `editable-select-cell.svelte`/`editable-tags-cell.svelte`), and `theme-button.svelte` (not wired into `overlay.svelte`'s nav bar, `+layout.svelte`, or anywhere else). These are candidates for either removal or intentional re-wiring, pending confirmation with the team.

**Confirmed live bug identified during this deep-dive:** `bulk-edit-panel.svelte`'s `progressOptions` derived value reads `editOptions.progressStatuses.map(...)`, but the `editOptions` context object created in `data-table.svelte` (`setContext("editOptions", { languages, types, tags, userRole })`) never sets a `progressStatuses` key — opening the Bulk Edit panel throws a `TypeError` at that derived-value evaluation. See the `bulk-edit-panel.svelte` entry in Section 2 for the recommended fix.

### 4.7 Related Patterns Elsewhere in the Monorepo

Based on the paths visible in this deep-dive and the monorepo's documented app inventory (per `AGENTS.md`), `watchlist` is one of several structurally similar SvelteKit apps that sit on the shared `auth-service` + Postgres stack (`howwasyourday`, `chhan-chhan`, `me-via-you`, `zeo`). Observations specific to this codebase that are likely comparable across sibling apps (not independently verified in this pass, since the task scope was limited to `apps/watchlist`):

- The `(auth)`/`(protected)`/`(public)` route-group convention plus a `hooks.server.ts` gate (session fetch, redirect rules) is a pattern shared architecturally with any other app using `@pocket-dimension/auth`'s `svelteKitHandler` — the login/sign-up/forgot-password/reset-password/verify-email/check-email page set here is a near-complete reference implementation of the "Better Auth SvelteKit" flow described in the root `AGENTS.md` ("Auth session caveat" section), including the raw-`fetch`-for-endpoints-not-in-the-client-SDK workaround (`forgot-password`, `reset-password`, resend-verification) that other auth-backed apps would need to replicate identically since they share the same `auth-service`.
- The `$lib/components/ui/*` shadcn-svelte primitives (explicitly excluded from this deep-dive) are almost certainly shared/copied across all SvelteKit apps in the monorepo (standard shadcn-svelte distribution model is copy-in, not an installed package), so the *feature*-level components documented here (data table, dashboard charts, saved views) are the actually-differentiating code between `watchlist` and its sibling apps, whereas the primitive layer is likely near-identical boilerplate repeated per app.
- `zeo` is noted in `AGENTS.md` as having real automated tests (`bun test src`) and `chhan-chhan` has importer tests — `watchlist` was not observed to have any test files during this deep-dive (none were referenced in the requested file list, and none were incidentally discovered), suggesting `watchlist`'s correctness currently relies entirely on manual QA / type-checking rather than automated tests, unlike at least two sibling apps.
- The "saved views" feature in `overlay.svelte` (named, shareable filter/sort/search presets, with default/favorite/custom tiers) is a fairly sophisticated feature that doesn't have an obvious analog described in the root `AGENTS.md` service table — it may be worth checking whether `zeo` or `chhan-chhan` (the other two apps with meaningfully complex list/filter UIs per their DB schema names) have independently built something similar, as a candidate for future extraction into a shared `@pocket-dimension` package if the pattern repeats.
