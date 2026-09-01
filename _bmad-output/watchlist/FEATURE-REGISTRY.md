# Feature Registry — `watchlist`

Brownfield capability inventory for `apps/watchlist`. Derived from deep brownfield + deep-dive 2026-08-31 — see [project-overview.md](./project-overview.md), [architecture.md](./architecture.md).

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Watchlist data table | `/` | Product | Epic 1 | Live |
| F-2 | Per-user ratings | `/` | Product | Epic 1 | Live |
| F-3 | Tags | `/` | Product | Epic 1 | Live |
| F-4 | Saved views | `/` | Product | Epic 1 | Live |
| F-5 | User rating comparison | `/` | Product | Epic 1 | Live |
| F-6 | Analytics dashboard | `/dashboard` | Product | Epic 1 | Live |
| F-7 | Leaderboard | `/leaderboard` | Product | Epic 1 | Live |
| F-8 | Role-gated editing | `/` | Product | Epic 1 | Live |
| F-9 | Bulk update API | n/a | Product | Epic 1 | Live |
| F-10 | PWA install | `/` | Product | Epic 1 | Live |
| F-11 | Auth pages | `/login`, `/sign-up`, … | Product | Epic 1 | Live |

## Feature details

### F-1 — Watchlist data table

- **Goal:** One actionable home page — searchable, sortable, filterable catalog table.
- **Area:** Catalog
- **Includes:**
  - Infinite scroll; drag-and-drop column reorder; persisted column visibility/order
  - Inline edit mode and bulk edit
  - `@tanstack/table-core` + custom data-table helpers
- **Deferred:**
  - Multi-page CRUD redesign (explicitly out of product intent)
- **See also:**
  - [architecture.md](./architecture.md), [component-inventory.md](./component-inventory.md)

### F-2 — Per-user ratings

- **Goal:** Let each user rate items 0–10 plus special infinity / shitty states.
- **Area:** Ratings
- **Includes:**
  - Ratings apply only when progress is `watched` or `dropped`
  - Stored per user per item in `watch_item_ratings`
- **Deferred:**
  - Public review write-ups / Letterboxd-style social feed
- **See also:**
  - [data-models.md](./data-models.md)

### F-3 — Tags

- **Goal:** Free-form many-to-many tags with autocomplete and inline creation.
- **Area:** Catalog
- **Includes:**
  - `watch_tags` + `watch_item_tags` join
  - Autocomplete + create-on-type in the table UI
- **Deferred:**
  - None currently.
- **See also:**
  - [api-contracts.md](./api-contracts.md)

### F-4 — Saved views

- **Goal:** Named, shareable filter/sort/search presets per user.
- **Area:** Views
- **Includes:**
  - Up to 10 named views; up to 3 favorites
  - Built-in defaults: Watchlist, Watch Later, Watching
- **Deferred:**
  - None currently.
- **See also:**
  - [project-overview.md](./project-overview.md#core-features)

### F-5 — User rating comparison

- **Goal:** Show other users’ ratings as dynamic table columns.
- **Area:** Ratings
- **Includes:**
  - Pick usernames via rating preferences
  - Extra columns on the home table
- **Deferred:**
  - None currently.
- **See also:**
  - [data-models.md](./data-models.md) (`user_rating_preferences`)

### F-6 — Analytics dashboard

- **Goal:** KPI cards and charts for catalog vs personal stats.
- **Area:** Analytics
- **Includes:**
  - Type/progress/language mixes, top tags, rating histogram, averages
  - Catalog vs My Stats scope toggle for logged-in users
- **Deferred:**
  - None currently.
- **See also:**
  - [api-contracts.md](./api-contracts.md)

### F-7 — Leaderboard

- **Goal:** Rank users by watch-item counts for a chosen progress metric.
- **Area:** Analytics
- **Includes:**
  - Filterable by type / language / tags
- **Deferred:**
  - None currently.
- **See also:**
  - [project-overview.md](./project-overview.md)

### F-8 — Role-gated editing

- **Goal:** Gate add/edit/delete by `user` / `contributor` / `admin`, plus synthetic mobile lock.
- **Area:** Permissions
- **Includes:**
  - Client rules in `edit-mode.svelte.ts`; server re-check in bulk-update
  - Viewport < 768px forces synthetic `mobile` role (no edit)
  - Any verified logged-in user can enter edit mode; contributor+ for catalog fields; admin delete
- **Deferred:**
  - Dedicated mobile edit experience
- **See also:**
  - [architecture.md](./architecture.md#role-permissions)

### F-9 — Bulk update API

- **Goal:** Single mutation path for table edits.
- **Area:** API
- **Includes:**
  - `POST /api/watchlist/bulk-update` as the only table mutation endpoint
  - Supporting read APIs for table / dashboard / leaderboard / views
- **Deferred:**
  - None currently.
- **See also:**
  - [api-contracts.md](./api-contracts.md)

### F-10 — PWA install

- **Goal:** Make the app installable on supported browsers.
- **Area:** PWA
- **Includes:**
  - Manifest + minimal service worker
  - Chromium/Android install prompt; iOS Add-to-Home-Screen hint
- **Deferred:**
  - Offline-first caching strategy
- **See also:**
  - [architecture.md](./architecture.md)

### F-11 — Auth pages

- **Goal:** Login, sign-up, password reset, and email verification via shared Better Auth.
- **Area:** Auth
- **Includes:**
  - Email or username login; shared cookie/session contract with auth-service
- **Deferred:**
  - Local `http://localhost` session stickiness (shared auth cookie caveat)
- **See also:**
  - `_bmad-output/shared-auth/FEATURE-REGISTRY.md`
