# Source Tree — `chhan-chhan`

Annotated tree of `apps/chhan-chhan/src`, focused on `src/routes` and `src/lib`. This app has **no `src/lib/components/ui/` directory** — every input/button/select is hand-rolled with Tailwind utility classes or the global `forge.css`/scoped `<style>` system (see [component-inventory.md](./component-inventory.md)).

```
apps/chhan-chhan/
├── package.json                    # @pocket-dimension/chhan-chhan — dev/build/start/check scripts, no test script wired in
├── svelte.config.js                 # svelte-adapter-bun (not adapter-auto, which is still listed as an unused devDependency)
├── vite.config.ts                   # kyselyCompat() + tailwindcss() + sveltekit(); port from Bun.env.PORT (default 3005); pg-native → stub
├── vite-kysely-compat.ts            # local Vite plugin shim — do not remove; Dockerfile guard depends on it
├── tsconfig.json                    # extends .svelte-kit/tsconfig.json; strict; moduleResolution: bundler
├── .env.example                     # PORT=3005, PUBLIC_BASE_AUTH_*, DATABASE_URL, BETTER_AUTH_*, RESEND_*, BODY_SIZE_LIMIT, RAILPACK_*
├── Dockerfile                       # multi-stage, monorepo-root build — see deployment-guide.md
├── railpack.json                    # alternative deploy path — see deployment-guide.md
├── DEPLOY.md                        # this app's deploy runbook (summarized in deployment-guide.md)
├── IMPORT.md                        # 399-line importer runbook: per-bank strategy, dedup rules, known issues #1–#7, debugging playbook
├── FUTURE-TODO.md                   # living backlog, 7 themes; checked items verified genuinely implemented
├── scripts/
│   ├── clear-transaction-notes.ts
│   ├── dedupe-transactions.ts        # supports --reset for a full wipe+reimport cycle
│   ├── deploy-build.sh               # monorepo-root install + shared-package build + optional db:migrate
│   └── sync-from-excel.ts
└── src/
    ├── app.html                     # dark mode forced (class="dark"), PWA manifest link, noindex/nofollow
    ├── app.css                      # Tailwind v4 entry + brand custom properties (--brand-*, --hi-*)
    ├── app.d.ts                     # App.Locals = { session?: Session; user?: typeof schema.user.$inferSelect }
    ├── hooks.server.ts              # session fetch + /sample legacy redirect + (auth)/(protected) rules + svelteKitHandler
    │
    ├── lib/
    │   ├── auth-client.ts           # better-auth/svelte client (usernameClient plugin, 5-min session refetch)
    │   ├── auth.ts                  # re-exports Session type from better-auth/types
    │   ├── import-stream.ts         # client-side NDJSON reader for /import/stream + progress-percent heuristics
    │   ├── pg-native-stub.js        # no-op stub aliased in place of the native pg-native addon
    │   │
    │   ├── actions/
    │   │   └── infinite-scroll.ts    # Svelte action wrapping IntersectionObserver (200px rootMargin)
    │   │
    │   ├── components/               # flat, no ui/ subfolder — 13 feature components
    │   │   ├── app-nav.svelte
    │   │   ├── app-settings.svelte
    │   │   ├── beta-banner.svelte
    │   │   ├── billing-panel.svelte
    │   │   ├── calculate-widget.svelte
    │   │   ├── category-trend-chart.svelte
    │   │   ├── dashboard-widget-picker.svelte
    │   │   ├── filter-multiselect.svelte
    │   │   ├── income-expense-bars.svelte
    │   │   ├── meter-bar.svelte
    │   │   ├── monthly-trend-chart.svelte
    │   │   ├── smart-categorize-popup.svelte
    │   │   └── smart-tag-popup.svelte
    │   │
    │   ├── finance/                  # pure/mostly-pure domain helpers, several with .test.ts siblings
    │   │   ├── bill-categories.ts (+ .test.ts)    # name-regex "is this a bill category" classifier
    │   │   ├── billing.ts (+ .test.ts)             # builds monthly/yearly bill breakdowns for the dashboard panel
    │   │   ├── currencies.ts                        # UI-only list of 10 supported currency codes
    │   │   ├── dashboard-widgets.ts (+ .test.ts)   # widget catalog, meter builders, category-trend chart data
    │   │   ├── filter-params.ts (+ .test.ts)       # comma-joined multi-value URL param helpers
    │   │   ├── merchant-match.ts (+ .test.ts)      # fuzzy merchant matching (Levenshtein + substring shortcut)
    │   │   ├── money.ts                             # parseSqlMinor, formatMoney, parseIndianAmount
    │   │   ├── refunds.ts                           # name-based "is this a Refund/Split Return category" check
    │   │   ├── summary.ts                           # period selection/formatting (month/year/all)
    │   │   ├── transaction-search.ts (+ .test.ts)  # free-text + amount-substring search predicates
    │   │   └── transaction-warnings.ts              # BFS connected-components refund-mismatch detection
    │   │
    │   ├── importers/                 # BankImporter registry + per-bank parsers
    │   │   ├── types.ts                             # ImportRow, ImportResult, StatementInput, BankImporter
    │   │   ├── index.ts                             # genericImporter (inline CSV) + getImporter/listImporters
    │   │   ├── import-report.ts                     # downloadable skipped/rejected-rows CSV (hardcodes INR — see project-context.md)
    │   │   ├── transaction-dedup.ts                  # transactionFingerprint / transactionDedupKey
    │   │   ├── kotak.ts / kotak-pdf.ts (+ .test.ts) / kotak-shared.ts   # CSV + 2 PDF sub-formats
    │   │   ├── icici.ts / icici-pdf.ts (+ .test.ts) / icici-shared.ts   # PDF only
    │   │   └── hdfc.ts / hdfc-pdf.ts (+ .test.ts) / hdfc-shared.ts      # PDF only
    │   │
    │   ├── server/                    # server-only modules (never imported client-side)
    │   │   ├── authz.ts                # requireUser, getMembershipOrThrow, canEdit — the authz chokepoint
    │   │   ├── balance.ts              # pure balance-snapshot comparison helpers
    │   │   ├── csv-parse.ts            # RFC4180-aware parser — actually used for CSV import
    │   │   ├── csv.ts                  # export CSV builder + a dead, naive parseCsv (never imported — see project-context.md)
    │   │   ├── http.ts                 # readJsonBody / parseSearch (Zod-validated)
    │   │   ├── pdf-text.ts             # extractPdfText via unpdf (whitespace-collapsed, page-merged)
    │   │   ├── import.ts               # 301 LOC — the transaction import engine
    │   │   └── finance.ts              # 1,844 LOC — all CRUD + analytics, largest file in the app
    │   │
    │   ├── styles/
    │   │   └── forge.css               # global chrome classes (.forge .topbar/.stat/.table/.panel/.meter, etc.)
    │   │
    │   └── validation/
    │       └── finance.ts              # every Zod schema for API/action payloads and query params
    │
    └── routes/
        ├── +layout.server.ts          # projects locals.user into { id, email, username } | null
        ├── +layout.svelte             # root chrome: imports app.css, subscribes to authClient.useSession() (keeps refetch polling warm)
        ├── +page.server.ts            # unconditional redirect(307, "/app")
        ├── +page.svelte               # 1-line "Redirecting…" placeholder
        │
        ├── (auth)/
        │   ├── +layout.svelte             # centered two-pane card + decorative image panel
        │   ├── login/+page.svelte          # email/username toggle; 403 "email not verified" resend flow
        │   ├── sign-up/+page.svelte         # registration + strong-password regex (duplicated in reset-password)
        │   ├── forgot-password/+page.svelte # raw fetch to auth-service (not authClient SDK)
        │   ├── reset-password/+page.svelte  # token-based; raw fetch; duplicated password regex
        │   ├── check-email/+page.svelte     # shared "check your email" holding page (signup/resend/forgot/verify-required)
        │   └── verify-email/+page.svelte    # post-redirect landing page, own error-code→copy map
        │
        ├── (protected)/app/
        │   ├── +layout.server.ts           # session guard + getOrCreateDefaultAccount — the ONLY account resolution point
        │   ├── +layout.svelte               # .forge .forge-shell chrome + <BetaBanner /> (hidden only in dev)
        │   ├── +page.server.ts              # ledger load: transactions page 1, analytics, summary, balance, category spend
        │   ├── +page.svelte                 # 2,446 LOC — largest file in the app; ledger table, all inline editors, 2 bulk modals
        │   │
        │   ├── control/
        │   │   ├── +page.server.ts          # 416 LOC — load + 13 form actions (see api-contracts.md)
        │   │   └── +page.svelte              # 946 LOC — import form, currency/opening-balance, CSV export, danger zone, 3 CRUD sections
        │   │
        │   └── dashboards/
        │       ├── +page.server.ts          # conditional per-widget query loading (needsX ? getX(...) : Promise.resolve([]))
        │       └── +page.svelte              # 685 LOC — widget grid render, localStorage-default/URL-truth widget selection
        │
        ├── api/accounts/
        │   ├── +server.ts                                          # GET list / POST create
        │   └── [accountId]/
        │       ├── analytics/+server.ts                            # GET
        │       ├── categories/+server.ts                           # GET / POST
        │       ├── budgets/+server.ts                              # GET / POST
        │       ├── budgets/[budgetId]/+server.ts                   # PATCH only — no DELETE
        │       ├── goals/+server.ts                                # GET / POST
        │       ├── goals/[goalId]/+server.ts                       # PATCH only — no DELETE
        │       └── transactions/
        │           ├── +server.ts                                  # GET (paginated) / POST (create — USD-hardcoded)
        │           ├── export/+server.ts                           # GET — unfiltered full-account CSV
        │           ├── import/+server.ts                           # GET (importer list) / POST (sync JSON result)
        │           ├── import/stream/+server.ts                    # POST — NDJSON progress (UI's primary import path)
        │           ├── smart-categorize/+server.ts                 # GET (preview) / POST (apply)
        │           ├── smart-tag/+server.ts                        # GET (preview) / POST (apply)
        │           └── [transactionId]/
        │               ├── +server.ts                              # PATCH / DELETE
        │               ├── tags/+server.ts                         # POST
        │               ├── tags/[tagId]/+server.ts                 # DELETE
        │               ├── groups/+server.ts                       # POST
        │               ├── groups/[groupId]/+server.ts             # PATCH / DELETE
        │               ├── refund-links/+server.ts                 # POST
        │               └── refund-links/[expenseTransactionId]/+server.ts   # DELETE
        │
        └── health/+server.ts            # GET — no auth, SELECT 1 liveness probe

shared/db/src/schema/chhanchhan.ts       # 333 LOC — see data-models.md
_bmad-output/chhan-chhan/                # this doc set + planning/implementation artifacts
```

See [api-contracts.md](./api-contracts.md) for full request/response contracts of everything under `api/`, and [component-inventory.md](./component-inventory.md) for a per-file summary of everything under `lib/components/`, `lib/importers/`, `lib/server/`, and `lib/finance/`.
