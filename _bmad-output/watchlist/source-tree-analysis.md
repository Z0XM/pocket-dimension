# Source Tree — `watchlist`

Annotated tree of `apps/watchlist`, focused on `src/routes` and `src/lib`. `src/lib/components/ui/*` (shadcn-svelte primitives, copy-distributed boilerplate near-identical across every SvelteKit app in the monorepo) is collapsed to one line per group — see [component-inventory.md](./component-inventory.md) for the full primitive-group list and the feature-level components documented individually.

```
apps/watchlist/
├── package.json                  # @pocket-dimension/watchlist — dev/build/start/check scripts
├── svelte.config.js               # svelte-adapter-bun; aliases $lib, $routes, $components
├── vite.config.ts                 # kyselyCompat() + tailwindcss() + sveltekit(); port from Bun.env.PORT (default 3002); aliases pg-native → stub
├── vite-kysely-compat.ts          # local Vite plugin shim (do not remove — Dockerfile guard depends on it)
├── tsconfig.json                  # extends .svelte-kit/tsconfig.json; strict; skipLibCheck true (masks the app.d.ts $lib/auth gap)
├── components.json                # shadcn-svelte config (zinc base color, aliases → $lib/*)
├── .env.example                   # PORT=3002, PUBLIC_BASE_AUTH_*, DATABASE_URL, BETTER_AUTH_*, RESEND_*, RAILPACK_*
├── .npmrc
├── Dockerfile                     # multi-stage, monorepo-root build — see deployment-guide.md
├── railpack.json                  # alternative deploy path — see deployment-guide.md
├── DEPLOY.md                      # this app's deploy runbook (summarized in deployment-guide.md)
├── scripts/
│   └── deploy-build.sh            # monorepo-root install + shared-package build + optional db:migrate
├── static/
│   ├── icon.svg                   # PWA icon (single SVG, "any maskable")
│   ├── manifest.json              # PWA manifest — name "Watchlist", standalone, #0b1220 theme
│   ├── robots.txt
│   └── sw.js                      # minimal service worker (skipWaiting/clients.claim only — no caching strategy)
└── src/
    ├── app.html
    ├── app.css                    # Tailwind v4 entry (referenced by components.json)
    ├── app.d.ts                   # App.Locals { session?: Session; user?: ... }; imports Session from "$lib/auth" — FILE DOES NOT EXIST (see project-context.md gotcha #4)
    ├── hooks.server.ts            # session fetch + (auth)/(protected) redirect rules + svelteKitHandler — see architecture.md
    │
    ├── lib/
    │   ├── auth-client.ts         # better-auth/svelte client (usernameClient plugin, 5-min session refetch)
    │   │                          #   NOTE: no sibling "auth.ts" re-exporting `Session` — unlike zeo/me-via-you/chhan-chhan/howwasyourday
    │   ├── leaderboard.ts         # isomorphic types + parseLeaderboardParams(url) — shared by server load and client component
    │   ├── utils.ts                # cn() Tailwind class-merge helper (shadcn convention)
    │   ├── pg-native-stub.js      # no-op stub aliased in place of the native `pg-native` addon
    │   ├── assets/                # icon.svg, z.png (auth layout side image)
    │   │
    │   ├── server/                # server-only modules (never imported client-side)
    │   │   ├── watchlist.ts       # getWatchlistForUser — the home table's single raw-SQL query builder (CTEs + facet-query fragments)
    │   │   ├── dashboard.ts       # getDashboardData(userId, scope) — ~10 parallel aggregate queries
    │   │   └── leaderboard.ts     # getLeaderboardData / getLeaderboardFilterOptions
    │   │
    │   └── components/
    │       ├── background.svelte          # full-viewport SVG mosaic background (~140 tiles); animation currently disabled at call site
    │       ├── overlay.svelte             # top nav bar + entire "saved views" CRUD feature (774 LOC — largest chrome component)
    │       ├── logout-button.svelte       # authClient.signOut() + goto("/login")
    │       ├── theme-button.svelte        # dark/light toggle — ORPHANED, not imported anywhere (see project-context.md)
    │       ├── pwa-install-button.svelte  # beforeinstallprompt capture + iOS "Add to Home Screen" hint
    │       ├── dashboard/
    │       │   ├── donut-chart.svelte           # pure-CSS conic-gradient donut
    │       │   ├── histogram-chart.svelte       # pure-CSS bar histogram (rating buckets)
    │       │   ├── horizontal-bar-chart.svelte  # pure-CSS proportional bar list
    │       │   ├── stacked-bar-chart.svelte     # pure-CSS stacked bar (progress-by-type)
    │       │   └── stat-card.svelte             # KPI card primitive (~14 usages on /dashboard)
    │       └── ui/                # shadcn-svelte primitives — alert-dialog, badge, button, card, checkbox,
    │                               #   data-table (flex-render + render-helpers), dialog, dropdown-menu, field,
    │                               #   input, label, select, separator, sonner, table — copy-distributed, not
    │                               #   watchlist-specific logic; see component-inventory.md for the group list
    │
    └── routes/
        ├── +layout.svelte         # root chrome: Background, Overlay, PwaInstallButton, Toaster, SW registration
        │
        ├── (auth)/
        │   ├── +layout.svelte             # centered card + z.png side image, shared by every page below
        │   ├── login/+page.svelte          # email/username login; 403 "email not verified" resend flow
        │   ├── sign-up/+page.svelte         # registration + strong-password regex (duplicated in reset-password)
        │   ├── forgot-password/+page.svelte # raw fetch to auth-service (not authClient SDK)
        │   ├── reset-password/+page.svelte  # token-based; raw fetch; duplicated password regex
        │   ├── verify-email/+page.svelte    # post-redirect landing page only (no API call)
        │   └── check-email/+page.svelte     # shared "check your email" holding page (signup/resend/forgot/verify-required)
        │
        ├── (protected)/
        │   └── list/+page.svelte   # "Login Required" literal text, no script, no +page.server.ts — DEAD ROUTE, no incoming links
        │
        ├── (public)/               # the actual watchlist app — no server-side auth gate on this group itself
        │   ├── +page.svelte                # home page: assembles columns + useDataFetch + useInfiniteScroll → DataTable
        │   ├── +page.server.ts             # SSR page-0 fetch + preferred-users lookup + 7 filter-facet/edit-option queries
        │   ├── columns.ts                   # Watchlist type + static ColumnDef[] + createUserRatingColumns() factory
        │   ├── data-table.svelte            # 1472 LOC — the entire table feature root (see architecture.md)
        │   │
        │   ├── data-table-helpers/          # ~23 files backing data-table.svelte, via Svelte context (editModeContext, editOptions, filterContext, searchContext)
        │   │   ├── edit-mode.svelte.ts             # 739 LOC — edit-mode state machine, role gates (canEditField/canAddRows/canDeleteRows)
        │   │   ├── column-settings.svelte.ts       # localStorage column visibility/order persistence + migration
        │   │   ├── data-fetch.svelte.ts             # generic paginated-fetch composable (useDataFetch)
        │   │   ├── infinite-scroll.svelte.ts        # generic IntersectionObserver composable
        │   │   ├── add-item-dialog.svelte           # standalone "create new item" modal (POSTs to bulk-update directly)
        │   │   ├── bulk-edit-panel.svelte           # floating panel for ≥1 selected row — CONTAINS THE progressStatuses BUG (see project-context.md)
        │   │   ├── mobile-filter-dialog.svelte      # consolidated language/tags/type filter dialog for mobile
        │   │   ├── row-details-dialog.svelte        # mobile long-press row detail/filter popover
        │   │   ├── filter-dropdown.svelte           # generic multi-select filter widget — also reused by leaderboard-content.svelte
        │   │   ├── editable-cell-wrapper.svelte     # shared undo/error chrome for every editable cell type
        │   │   ├── editable-text-cell.svelte        # title cell — debounced validate-title call
        │   │   ├── editable-select-cell.svelte      # type/language/progress dropdown cell
        │   │   ├── editable-tags-cell.svelte        # tag add/remove/autocomplete cell
        │   │   ├── editable-rating-cell.svelte      # rating/infinity/shitty compound cell
        │   │   ├── clickable-cell.svelte            # ORPHANED — zero references
        │   │   ├── clickable-tags-cell.svelte       # ORPHANED — zero references
        │   │   ├── clickable-title.svelte           # click-a-word-to-search (used by editable-text-cell's read view)
        │   │   ├── row-actions-cell.svelte          # per-row delete/undo-delete/remove-draft
        │   │   ├── select-row-cell.svelte           # row/header checkbox, shift-click range select
        │   │   ├── user-rating-selector.svelte      # "compare ratings with" picker → /api/users, /api/user-rating-preferences
        │   │   ├── confirm-dialog.svelte            # generic yes/no AlertDialog wrapper
        │   │   ├── delete-confirmation-dialog.svelte # typed "DELETE" confirmation for bulk deletes
        │   │   └── unsaved-changes-dialog.svelte    # save/discard/stay gate for navigation-with-unsaved-edits
        │   │
        │   ├── about/+page.svelte            # static product/role/mobile-limitations documentation page
        │   ├── dashboard/
        │   │   ├── +page.svelte               # KPIs + 6 chart types, catalog/personal scope toggle
        │   │   └── +page.server.ts            # thin wrapper around getDashboardData
        │   └── leaderboard/
        │       ├── +page.svelte               # thin wrapper around leaderboard-content.svelte
        │       ├── +page.server.ts            # parseLeaderboardParams + getLeaderboardData
        │       └── leaderboard-content.svelte # full leaderboard UI (metric tabs, filters, ranked bars)
        │
        └── api/
            ├── dashboard/+server.ts                       # GET
            ├── leaderboard/+server.ts                     # GET
            ├── user-rating-preferences/+server.ts         # GET, POST
            ├── users/+server.ts                           # GET
            ├── views/
            │   ├── +server.ts                             # GET, POST
            │   └── [viewName]/+server.ts                  # PUT, DELETE
            └── watchlist/
                ├── +server.ts                             # GET (paginated table read)
                ├── bulk-update/+server.ts                  # POST (the one mutation endpoint)
                └── validate-title/+server.ts               # GET
```

See [api-contracts.md](./api-contracts.md) for full request/response contracts of everything under `api/`, and [component-inventory.md](./component-inventory.md) for a per-component summary of everything under `lib/components/` and `(public)/data-table-helpers/`.
