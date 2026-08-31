# Project Overview — `watchlist`

## Purpose

`watchlist` is a personal movie/series/shorts tracking app: a single searchable, sortable, filterable data table for a shared media catalog, with per-user ratings, tags, saved "views", an analytics dashboard, and a cross-user leaderboard. Per the in-app [`about`](../../apps/watchlist/src/routes/(public)/about/+page.svelte) page, the design goal is "one actionable page" (the home table) rather than a multi-page CRUD app, styled with a purple ("Myurazaki") glass/highlight theme. It is not intended to replace review platforms like RottenTomatoes/Letterboxd — ratings are a feature of the catalog, not the product.

## Core features

- **Watchlist table** (`/`) — searchable/sortable/filterable, infinite scroll, inline edit mode, bulk edit, drag-and-drop column reordering, persisted column visibility/order.
- **Per-user ratings** — 0–10 numeric rating, plus two special states (♾️ infinity, 💩 shitty) per user per item; ratings only apply when progress is `watched` or `dropped`.
- **Tags** — free-form, many-to-many, autocomplete + inline creation.
- **Saved views** — up to 10 named, shareable filter/sort/search presets per user, with up to 3 "favorites"; 3 built-in default views (Watchlist, Watch Later, Watching) always present.
- **User rating comparison** — pick other users' usernames to show their ratings as extra dynamic table columns.
- **Dashboard** (`/dashboard`) — KPI cards + 6 chart types (type mix, progress mix, language breakdown, top tags, progress-by-type, rating histogram, avg rating by type/language), with a Catalog vs. My Stats scope toggle for logged-in users.
- **Leaderboard** (`/leaderboard`) — ranks users by watch-item count for a chosen progress metric, filterable by type/language/tags.
- **PWA** — installable (manifest + minimal service worker), install prompt for Chromium/Android and an iOS "Add to Home Screen" hint.
- **Auth pages** — login (email or username), sign-up, forgot/reset password, email verification landing pages — all rendering the same Better Auth flow shared across the monorepo's auth-backed apps.

## Roles

Four effective roles gate table editing (see [architecture.md](./architecture.md#role-permissions) for the authoritative table): `user`, `contributor`, `admin`, and a synthetic `mobile` role forced whenever the viewport is < 768px, regardless of the account's real role. Any logged-in, email-verified account can enter edit mode; **contributor**/**admin** can add items and edit title/language/type/tags; only **admin** can delete items.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | SvelteKit 5 (runes), TypeScript |
| Server adapter | `svelte-adapter-bun` |
| Styling | Tailwind CSS v4, `tailwind-variants`, `tw-animate-css` |
| UI primitives | shadcn-svelte (`bits-ui`) — copied into `src/lib/components/ui/*` |
| Icons | `@lucide/svelte` |
| Data table | `@tanstack/table-core` (headless) + custom render helpers |
| Drag and drop | `svelte-dnd-action` (column reordering) |
| Toasts | `svelte-sonner` |
| Theme | `mode-watcher` (dark/light via `prefers-color-scheme`; manual toggle component exists but is unwired — see [project-context.md](./project-context.md)) |
| Auth | `better-auth` client (`better-auth/svelte`) + `@pocket-dimension/auth` (server, via `auth-service`) |
| Database | `@pocket-dimension/db` (Drizzle ORM over PostgreSQL 18+), raw `sql\`...\`` for the table/dashboard/leaderboard queries |
| Build tool | Vite 7 |
| Runtime | Bun |

## Ports and topology

| App | Port | Depends on |
| --- | --- | --- |
| `watchlist` (this app) | **3002** (dev and prod) | PostgreSQL (`watchlist` schema, plus reads from `auth.user`), `auth-service` on port 5001 |

`watchlist` has no server-rendered dependency on `auth-service` beyond Better Auth's shared session/cookie contract (`svelteKitHandler`) — see [architecture.md](./architecture.md). It shares one PostgreSQL instance with every other auth-backed app in the monorepo, scoped to the `watchlist` Postgres schema (plus foreign keys into `auth.user`).

## Related docs

- [architecture.md](./architecture.md) — SvelteKit structure, auth flow, data table architecture, roles, PWA
- [api-contracts.md](./api-contracts.md) — every `/api/**` endpoint
- [data-models.md](./data-models.md) — `watchlist` Postgres schema usage
- [source-tree-analysis.md](./source-tree-analysis.md) — annotated file tree
- [component-inventory.md](./component-inventory.md) — component/composable catalog
- [development-guide.md](./development-guide.md) / [deployment-guide.md](./deployment-guide.md)
- [project-context.md](./project-context.md) — agent rules and known gotchas
- [deep-dive-watchlist.md](./deep-dive-watchlist.md) — exhaustive file-by-file review (source of most findings in this module)
