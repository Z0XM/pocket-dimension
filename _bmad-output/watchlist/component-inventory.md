# Component Inventory — `watchlist`

Feature-level components, the `data-table-helpers/*` group, and a summary of the shadcn `ui/*` primitives. Full per-file detail (props, patterns, risks) lives in [deep-dive-watchlist.md](./deep-dive-watchlist.md) — this doc is the at-a-glance catalog. LOC counts are from the deep dive (`wc -l`, 2026-08-31).

## Global chrome (`src/lib/components/`)

| Component | LOC | Used by | Summary |
| --- | --- | --- | --- |
| `background.svelte` | 513 | `+layout.svelte` | Full-viewport SVG mosaic (~140 hand-authored `<rect>` tiles), optional glass filter + 8 procedural animation modes. Animation is disabled at the current call site (`enableAnimation=false`), so the 8 animation functions are effectively dead code in production today. |
| `overlay.svelte` | 774 | `+layout.svelte` | The top nav bar — icon/view name, Dashboard/Leaderboard/About links, and the **entire saved-views CRUD feature** (create/rename/favorite/delete against `/api/views`). Largest chrome component; independently reimplements the same "URL vs. local state" echo-suppression pattern used in `data-table.svelte`. |
| `logout-button.svelte` | 30 | `overlay.svelte` | `authClient.signOut()` + `goto("/login")`; no user-facing error feedback on failure. |
| `theme-button.svelte` | 14 | **none — orphaned** | Dark/light toggle via `mode-watcher`'s `toggleMode()`. Not imported anywhere; app currently has no manual theme toggle in the UI. |
| `pwa-install-button.svelte` | 72 | `+layout.svelte` | Captures `beforeinstallprompt` (Chromium/Android); `window.alert()`-based iOS "Add to Home Screen" hint. |

## Dashboard chart primitives (`src/lib/components/dashboard/`)

All four are pure-CSS (no charting library), presentational, and reused unchanged between "Catalog" and "My Stats" scope on `/dashboard`.

| Component | LOC | Used for |
| --- | --- | --- |
| `donut-chart.svelte` | 159 | Media type mix, progress breakdown (×2 on the page) |
| `histogram-chart.svelte` | 104 | Rating distribution (×1) |
| `horizontal-bar-chart.svelte` | 110 | Titles-by-language, top tags, avg-rating-by-type, avg-rating-by-language (×4) |
| `stacked-bar-chart.svelte` | 149 | Progress-by-type (×1) |
| `stat-card.svelte` | 23 | KPI number cards (~14 usages) |

## Data table feature root (`src/routes/(public)/`)

| File | LOC | Role |
| --- | --- | --- |
| `columns.ts` | 345 | `Watchlist` row type, static `ColumnDef[]`, `createUserRatingColumns(usernames)` factory, and the rating→color gradient (duplicated 3× across the codebase — see below). |
| `data-table.svelte` | 1472 | The entire feature: mobile detection, edit-mode toolbar, column settings/DnD reorder, URL-synced sort/filter/search with echo-suppression, keyboard shortcuts, save/delete/bulk-delete orchestration, infinite-scroll sentinel row. Largest and most complex file in the app — see [architecture.md](./architecture.md#data-table-architecture-summary). |

## `data-table-helpers/` (23 files)

Everything here is wired together through four Svelte contexts provided by `data-table.svelte` (`editModeContext`, `editOptions`, `filterContext`, `searchContext`) — a component in this folder rendered outside that subtree will throw or receive `undefined` context.

### State modules (`.svelte.ts`, no markup)

| Module | LOC | Purpose |
| --- | --- | --- |
| `edit-mode.svelte.ts` | 739 | The edit-mode state machine: field edits + undo snapshots, tag add/remove diffs, row deletion, multi-select (shift-click range), validation errors, `getChangeset()` (→ `POST /api/watchlist/bulk-update`), and the authoritative `canEditField`/`canAddRows`/`canDeleteRows` role gates (see [architecture.md](./architecture.md#role-permissions)). |
| `column-settings.svelte.ts` | 431 | `localStorage` persistence for column visibility/order, incl. legacy-format migration and malformed-order self-healing (a targeted fix for one historical layout bug). |
| `data-fetch.svelte.ts` | 229 | Generic paginated-fetch composable (`useDataFetch<T>`) — reusable outside watchlist, not table-specific. |
| `infinite-scroll.svelte.ts` | 94 | Generic `IntersectionObserver` composable — also reusable outside watchlist. |

### Dialogs and panels

| Component | LOC | Purpose |
| --- | --- | --- |
| `add-item-dialog.svelte` | 472 | Standalone "create new item" modal for contributors/admins — full field set incl. tags/rating, POSTs directly to `bulk-update` (bypasses the table's edit-mode changeset). |
| `bulk-edit-panel.svelte` | 258 | Floating panel shown when ≥1 row selected in edit mode — bulk Progress/Language/Type/tag apply + admin-only bulk delete. **Contains the `progressStatuses` bug** (see [project-context.md](./project-context.md)). |
| `mobile-filter-dialog.svelte` | 262 | Consolidated language/tags/type filter dialog for mobile (progress deliberately excluded). |
| `row-details-dialog.svelte` | 135 | Mobile-only long-press row detail popover exposing the same click-to-filter affordance desktop gets from visible cells. |
| `confirm-dialog.svelte` | 51 | Generic reusable yes/no `AlertDialog` (used for "Discard Changes?" / "Undo All Changes?"). |
| `delete-confirmation-dialog.svelte` | 102 | Delete-specific dialog — simple confirm for 1 item, typed "DELETE" confirmation for bulk deletes. |
| `unsaved-changes-dialog.svelte` | 36 | Three-way choice (Save & Continue / Discard & Continue / Stay) shown when a sort/filter/search change would discard unsaved edit-mode changes. |

### Editable cells

| Component | LOC | Field(s) |
| --- | --- | --- |
| `editable-cell-wrapper.svelte` | 86 | Shared undo-button/error-indicator chrome wrapped by all 4 cell types below. |
| `editable-text-cell.svelte` | 94 | `title` — 300ms-debounced live uniqueness check against `GET /api/watchlist/validate-title`. |
| `editable-select-cell.svelte` | 191 | `type`, `languageId`, `my_progress_status` — dropdown in edit mode, click-to-filter span in view mode. |
| `editable-tags-cell.svelte` | 178 | `tags` — add/remove diffing (not full-list replace), autocomplete + inline tag creation. |
| `editable-rating-cell.svelte` | 203 | `my_rating`/`my_infinity`/`my_shitty` compound cell, gated on progress being `watched`/`dropped`. Duplicates the rating→color gradient also present in `columns.ts`. |

### Row actions and selection

| Component | LOC | Purpose |
| --- | --- | --- |
| `row-actions-cell.svelte` | 68 | Per-row remove-draft (any add-capable role) or delete-toggle (admin only). |
| `select-row-cell.svelte` | 69 | Row/header checkbox, tri-state header, shift-click range select. |
| `user-rating-selector.svelte` | 127 | Desktop "compare ratings with other users" picker — `GET /api/users` + `GET`/`POST /api/user-rating-preferences`. |

### Click-to-filter/search

| Component | LOC | Status |
| --- | --- | --- |
| `clickable-title.svelte` | 71 | **Live** — used by `editable-text-cell.svelte`'s read-only title display; click-a-word-≥3-chars toggles it into the search box. |
| `clickable-cell.svelte` | 61 | **Orphaned** — zero references anywhere in `src`; superseded by `editable-select-cell.svelte`'s own click handler. |
| `clickable-tags-cell.svelte` | 51 | **Orphaned** — zero references anywhere in `src`; superseded by `editable-tags-cell.svelte`'s own `Badge` click handler. |
| `filter-dropdown.svelte` | 160 | **Live, and reused outside its own folder** — every desktop column filter (×4) *and* `leaderboard-content.svelte` (×3), despite living under `(public)/data-table-helpers/`. A strong signal it should live in `$lib/components/` instead. |

## `ui/*` (shadcn-svelte primitives — copy-distributed, not app-specific)

Not individually documented (near-identical across every SvelteKit app in the monorepo per `components.json`'s shadcn-svelte registry conventions). Groups present in `src/lib/components/ui/`:

`alert-dialog`, `badge`, `button`, `card`, `checkbox`, `data-table` (generic `flex-render.svelte` + `render-helpers.ts` bridging TanStack Table into Svelte, plus `data-table.svelte.ts`), `dialog`, `dropdown-menu`, `field`, `input`, `label`, `select`, `separator`, `sonner` (toast), `table`.

## Known duplication across components (candidates for extraction)

- **Rating→color gradient** (10 discrete hex thresholds, 0–10 scale): `columns.ts` (twice — `avg_rating` column and dynamic per-user columns) and `editable-rating-cell.svelte` — three independent copies.
- **Strong-password regex:** `sign-up/+page.svelte` and `reset-password/+page.svelte`.
- **Tag-picker UI (search + "Create X" affordance):** near-identical in `editable-tags-cell.svelte` and `add-item-dialog.svelte`.
- **Proportional bar-chart markup/CSS:** `dashboard/horizontal-bar-chart.svelte` and `leaderboard-content.svelte`'s own hand-rolled ranking bars.
- **URL-sync "echo suppression":** `data-table.svelte` (`pendingSorting`/`pendingFilters`/`pendingQuery`) and `overlay.svelte` (`isManualSelection`) independently solve the same problem.
