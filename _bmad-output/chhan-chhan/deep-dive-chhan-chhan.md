# chhan-chhan — Deep Dive Documentation

**Generated:** 2026-09-01
**Scope:** `apps/chhan-chhan` (entire app)
**Workflow Mode:** Exhaustive Deep-Dive (`bmad-document-project`)
**Heimdall module:** `chhan-chhan`

Companion module docs in this folder: [index.md](./index.md). Existing product planning remains under [planning-artifacts/](./planning-artifacts/).

---

## Part A — API / server / importers

# chhan-chhan — Deep Dive: Core / Server / API / Auth / Importers / Config

**Scope:** `/workspace/apps/chhan-chhan` (SvelteKit app, port 3005) + `/workspace/shared/db/src/schema/chhanchhan.ts`.
**Method:** every file listed below was read in full, line by line — no sampling. LOC counts are exact (`wc -l`).
**Date:** 2026-09-01.

---

## Part A — File-by-file catalog

### A.1 CONFIG

| Path | LOC | Purpose | Exports | Authz | DB tables | Risks / notes |
|---|---|---|---|---|---|---|
| `package.json` | 55 | Bun/Turbo package manifest. Scripts: `dev`, `build`, `preview`, `start`, `start:local`, `prepare`, `check(:watch)`. | — | — | — | Deps: SvelteKit 2.49, Svelte 5.45, `svelte-adapter-bun`, `better-auth` 1.4.10, `drizzle-orm` 0.45.1, `kysely` 0.28.17 (pinned, see compat shim below), `unpdf` 1.6.2 (PDF text extraction), `zod` 4.2.1, `@pocket-dimension/{auth,db}` workspace deps. No test runner listed in scripts — tests run ad-hoc via `bun test` (see `IMPORT.md`), not wired into `package.json`. |
| `svelte.config.js` | 16 | SvelteKit config. | `config` (default) | — | — | Uses `svelte-adapter-bun` (not `adapter-auto`, despite it being a devDependency — dead dep). `$lib/*` and `$routes/*` aliases. |
| `vite.config.ts` | 19 | Vite config: port from `Bun.env.PORT` (default 3005), plugins `kyselyCompat()`, `tailwindcss()`, `sveltekit()`. Aliases `pg-native` → local stub. | `default` (defineConfig) | — | — | Reads `Bun.env` via `globalThis` cast so `svelte-check` (Node) doesn't crash on missing `Bun` global — a deliberate, slightly fragile compatibility trick. |
| `vite-kysely-compat.ts` | 55 | Vite plugin: virtual-module shim so `kysely@0.28` still exports `DEFAULT_MIGRATION_TABLE`/`DEFAULT_MIGRATION_LOCK_TABLE` (moved to `kysely/migration` in 0.29+) for `@better-auth/kysely-adapter`. | `kyselyCompat()` | — | — | Walks up the directory tree with `createRequire` to resolve `kysely` from anywhere in the monorepo. `DEPLOY.md` explicitly calls out a Docker build failure mode if a stale image still references the old `../../vite-kysely-compat` path — this file **must** stay in `apps/chhan-chhan/`, not shared. |
| `tsconfig.json` | 14 | Extends `.svelte-kit/tsconfig.json`; strict mode, `moduleResolution: bundler`. | — | — | — | Standard. |
| `.env.example` | 29 | Template env vars (see §7 Env vars). | — | — | — | `RAILPACK_*` vars are meant for the **monorepo root** env, not this app's `.env` — slightly confusing to keep in the same file as local-dev vars. |
| `DEPLOY.md` | 94 | Deployment guide: Dockerfile (recommended) vs Railpack, Dokploy field values, local smoke test, troubleshooting (stale build cache, wrong Docker context). | — | — | — | Explicitly documents 3 historical footguns: stale `../../vite-kysely-compat` import, missing `/shared`/`/turbo.json` (wrong context path), and Railpack auto-`bun install` clobbering workspace deps. |
| `Dockerfile` | 45 | Multi-stage build: `oven/bun:1.3.5` builder → `oven/bun:1.3.5-slim` runner. Builds shared packages then the app; final image only ships `node_modules`, `shared`, `apps/chhan-chhan/build`, `package.json`. | — | — | — | Has a **fail-fast guard** (line ~20): asserts `apps/chhan-chhan/vite-kysely-compat.ts` exists and `vite.config.ts` references `./vite-kysely-compat` — protects against the exact stale-layer bug `DEPLOY.md` warns about. Runs `bun install --filter '@pocket-dimension/chhan-chhan'` with `--linker hoisted`, then deletes all `node_modules` under `apps/`/`shared/` (hoisted installs leave broken symlinks there) and relies on root `node_modules` only. |
| `railpack.json` | 29 | Alternative to Dockerfile: shell provider, `install` step is a no-op (`true`), `build` step delegates to `scripts/deploy-build.sh` with a root-vs-app-relative fallback, `deploy.startCommand` cd's into the app dir if a root `package.json` with `"workspaces"` is present. | — | — | — | `deployOutputs.include` must be kept in sync with whatever `deploy-build.sh` produces, or the deployed image silently ships stale files. |
| `scripts/deploy-build.sh` | 40 | Bash build script run from repo root: verifies `shared/auth/package.json` exists (fails with actionable message otherwise), `bun install --filter` + prune node_modules, `svelte-kit sync`, builds `shared:utils`/`shared:db`/`shared:auth`/`app:chhan-chhan` with `TURBO_FORCE=1`, then conditionally runs `bun db:migrate` **only if `DATABASE_URL` is set at build time**. | — | — | — | If `DATABASE_URL` isn't set at build time (typical for a build stage without DB access), migrations must be run manually before serving traffic — an easy-to-miss operational step for a fresh deploy. |
| `IMPORT.md` | 399 | Exhaustive importer runbook: pipeline overview, per-bank strategy (Kotak CSV/PDF, ICICI PDF, HDFC PDF, generic CSV), dedup rules, known issues #1–#7 with root cause + fix, debugging playbook, balance-sync strategy, money/currency notes, related scripts, checklist. | — | — | `chhanchhan.finance_transactions` (SQL examples) | See §7 for gaps found vs. current code (Kotak "monthly" PDF format is undocumented here). |
| `FUTURE-TODO.md` | 87 | Living backlog across 7 themes (finish-what's-started, smarter workflow, search/nav, reporting, import/hygiene, QoL, higher-effort). Checkboxes mark 3 items done (clear-all, opening balance, HDFC importer, CSV export). | — | — | — | Cross-checked against code in §7 — all `[x]` items are genuinely implemented; most `[ ]` items are genuinely absent (verified against API routes and Control UI wiring). |

### A.2 CORE

| Path | LOC | Purpose | Exports | Authz | DB tables | Risks / notes |
|---|---|---|---|---|---|---|
| `src/hooks.server.ts` | 45 | Global SvelteKit `handle`: (1) legacy `/sample` → `/app` redirect, (2) loads Better Auth session into `event.locals.{session,user}`, (3) inside `(auth)` group redirects verified, logged-in users to `/app` (except `verify-email`/`check-email`), (4) inside `(protected)` group: 401→redirect to `/login?redirect=…` if no session, redirect to `/check-email?reason=verify` if email unverified, (5) delegates to `svelteKitHandler` (Better Auth's SvelteKit integration) for auth API routes. | `handle` | Gatekeeper for **all** routes | none directly | The `/sample` redirect (line 10) looks like leftover scaffolding from a starter template — dead route, low risk but should be removed or explained. Auth is enforced here **and again** in `(protected)/app/+layout.server.ts` (`if (!locals.user?.id) redirect(307, "/login")`) — defense in depth, not a bug. |
| `src/app.d.ts` | 20 | Ambient types: `App.Locals` = `{ session?: Session; user?: typeof schema.user.$inferSelect }`. | (types only) | — | — | Straightforward. |
| `src/app.html` | 26 | HTML shell; dark mode forced (`class="dark"` on `<html>`), PWA manifest link, `noindex, nofollow` (app not meant to be indexed — sensible for a personal finance tool). | — | — | — | — |
| `src/lib/auth-client.ts` | 14 | Browser Better Auth client via `createAuthClient` from `better-auth/svelte`, `usernameClient` plugin, session refetch every 5 min + on window focus. | `authClient` | — | — | — |
| `src/lib/auth.ts` | 3 | Re-exports `better-auth/types`'s `Session` type. | `Session` (type) | — | — | Trivial. |
| `src/app.css` | ~130 | Tailwind v4 + `@tailwindcss/forms`/`typography` + `tw-animate-css` + fonts, then a locked dark palette (`--brand-*` custom properties) mapped into Tailwind's `@theme inline` tokens, plus scrollbar styling. | — | — | — | Not requested as a separate deep-dive item but read per "src/app.css if any". |

### A.3 SERVER (`src/lib/server/**`)

| Path | LOC | Purpose | Key exports | Authz | DB tables touched | Risks |
|---|---|---|---|---|---|---|
| `src/lib/server/authz.ts` | 25 | Central authorization primitives. | `requireUser(locals)` → 401 if no `locals.user.id`; `getMembershipOrThrow(userId, accountId)` → 403 if no row in `financeAccountMembers`; `canEdit(role)` → `role === "owner" \|\| role === "editor"` | This **is** the authz layer | `financeAccountMembers` | `canEdit` treats `viewer` as read-only by omission (not an explicit deny-list) — safe today since the enum only has 3 values, but would silently become "read-only" for any new role added later unless this function is updated too. |
| `src/lib/server/balance.ts` | 33 | Pure helpers for picking the "latest" balance snapshot from a list of import rows vs. the stored account snapshot. | `latestBalanceFromRows(rows)`, `isBalanceSnapshotNewer(candidate, current)` | none (pure) | — | Comparison uses `>=` on `sortOrder` for same-date candidates — ties go to the *new* candidate, which is what import re-runs rely on (see `syncImportBalances`). |
| `src/lib/server/csv-parse.ts` | 59 | RFC4180-ish CSV tokenizer (handles quoted commas/newlines, `""` escaping, CRLF). | `parseCsvRows(text)`, `rowsToObjects(rows)` | none (pure) | — | This is the parser actually used for **importing** CSVs (Kotak CSV, generic CSV). Blank rows are dropped (`row.some(v => v.trim())` check). |
| `src/lib/server/csv.ts` | 35 | A second, much simpler CSV implementation: `escapeCsv`, `toCsv` (used for **exporting**), and a naive `parseCsv` (plain `split(",")`, no quote awareness). | `toCsv(rows, columns)`, `parseCsv(text)` | none (pure) | — | **Dead code / risk:** `parseCsv` is exported but never imported anywhere in the app (verified via repo-wide grep) — if it's ever wired up for import it will silently corrupt any field containing a comma or newline, because it lacks the quote-handling of `csv-parse.ts`. Two competing CSV parsers in the same server folder is a latent confusion/maintenance risk. |
| `src/lib/server/http.ts` | 26 | Request helpers: `readJsonBody(request, zodSchema)` → 400 on invalid JSON or schema failure; `parseSearch(url, zodSchema)` → 400 on invalid query params. | `readJsonBody`, `parseSearch` | none (used *after* authz in every route) | — | Every mutating API route calls `readJsonBody` **after** `canEdit` check — correct order (authz before validation avoids leaking schema details to non-members, though `getMembershipOrThrow` runs first anyway). |
| `src/lib/server/pdf-text.ts` | 7 | Extracts and normalizes PDF text via `unpdf` (`getDocumentProxy` + `extractText({ mergePages: true })`), collapses all whitespace to single spaces. | `extractPdfText(bytes)` | none | — | Whitespace collapsing is **load-bearing** for every PDF importer's regexes (they all assume single-space-separated tokens); if `unpdf`'s output format ever changes, all three bank parsers break simultaneously. No page-boundary markers are preserved — footer-stripping regexes are the *only* defense against page-boundary corruption (see IMPORT.md issue #1). |
| `src/lib/server/import.ts` | 301 | The transaction import engine: dedup-key computation, per-row insert loop with progress callbacks, balance sync, full reset, and a SQL-window-based post-import dedupe. | `importTransactionRows(userId, accountId, rows, options)`, `resetAccountTransactions(accountId)`, `dedupeAccountTransactions(accountId)`, type `ImportProgress` | Caller must have already checked `canEdit` — **this module does not check authz itself** | `finance_transactions` (insert/select/update), `finance_accounts` (balance sync/reset) | (1) Row-at-a-time `await db.insert(...)` **inside a `for...of` loop** (line ~210) — no batching/transaction wrapping; a large statement (thousands of rows) means thousands of sequential DB round-trips, and a mid-import crash leaves a **partial import** with no rollback (no `db.transaction()` wrapper around the whole loop). (2) `resetAccountTransactions` deletes all transactions **and immediately nulls the account balance snapshot** — cascades to tags/groups/refund-links per FK `onDelete: cascade`; no soft-delete/undo. (3) `dedupeAccountTransactions` uses a raw-SQL `ROW_NUMBER() OVER (PARTITION BY ...)` window keyed on **string concatenation** (`external_ref \|\| '\|' \|\| occurred_on::text \|\| ...`), preferring rows `external_ref IS NOT NULL`, then `balance_minor IS NOT NULL`, then earliest `created_at` — matches `IMPORT.md`'s documented dedupe strategy exactly. |
| `src/lib/server/finance.ts` | **1844** | The single largest file in the app — all CRUD + analytics for accounts, categories, tags, groups, transactions, budgets, goals, refund-links, smart-categorize/smart-tag preview+apply, and every dashboard aggregate query (summary, category/tag/merchant/group spend, monthly/category trend, bill-category breakdowns, analytics bundle). | ~45 exported functions (see §1 for the API-facing subset) | Functions themselves **do not check authz** — every caller (API route / form action) is responsible for `requireUser` + `getMembershipOrThrow` + `canEdit` before calling in | `finance_accounts`, `finance_account_members`, `finance_categories`, `finance_transactions`, `finance_tags`, `finance_transaction_tags`, `finance_groups`, `finance_transaction_groups`, `finance_transaction_refund_links`, `finance_budgets`, `finance_goals` | Multiple significant findings, detailed in §4/§7: **(a)** `createTransaction()` (manual "add transaction" API) hardcodes `currencyCode: "USD"` unconditionally — it ignores the account's actual `currencyCode` (unlike `importTransactionRows`, which correctly receives `currencyCode` from `getAccountCurrency()`). Any manually-added transaction on a non-USD account (e.g. the default "INR" personal account) is tagged with the wrong currency in the DB even though the UI displays it using the account's currency formatting. **(b)** `getOrCreateDefaultAccount` picks `listAccountsForUser(userId)[0]`, and that list is ordered `orderBy(asc(financeAccounts.name))` — i.e. "default account" is **alphabetically-first-by-name**, not "first created" or "owned". Renaming an account or creating a new one with an earlier name silently changes which account every single-account code path (layout, Control actions) operates on. **(c)** Many analytics functions use raw `sql\`...\`` template literals against the **literal schema-qualified table names** (`chhanchhan.finance_transactions`, etc.) rather than the Drizzle schema objects — twelve separate functions (`listDistinctMerchantsForType`, `getMerchantCategoryBreakdown`, `getTransactionSummary`, `getCategorySpend`, `getTagSpend`, `getMerchantSpend`, `getGroupSpend`, `getCategoryMerchantBills(ForYear)`, `getMonthlyTrend`, `getCategoryTrend`, `getAnalytics`, `listTransactionPeriods`) all hardcode `chhanchhan.` — safe from SQL injection (all values are parameterized via `sql` tagged templates) but a schema rename would require touching all of them individually since they bypass the Drizzle schema import. **(d)** `getRefundLinkClusterIds`/`loadRefundLinkRowsForTransactions` does a BFS over the refund-links table with a `while (frontier.length)` loop issuing one query per BFS level — fine for small refund chains, but no depth limit exists, so a pathological (accidentally cyclic via app bug, or very long) refund chain could issue many sequential queries per transaction-list page load. **(e)** `listTransactions` issues up to 5 sequential queries per page just for tag/group/refund-link/warning enrichment (`loadTagsForTransactions`, `loadGroupsForTransactions`, `loadRefundLinksForTransactions`, `buildRefundWarningsForTransactions`, optionally `loadGroupHiddenForTransactions`) — not a bug, but a clear scaling ceiling for accounts with very large transaction counts + heavy tagging. |
| `src/lib/validation/finance.ts` | 219 | All Zod schemas for API/action payloads and query params. | `transactionsQuerySchema`, `createAccountSchema`, `updateAccountCurrencySchema`, `updateAccountOpeningBalanceSchema`, `clearAccountOpeningBalanceSchema`, `create/update/deleteCategorySchema`, `create/update/deleteTagSchema`, `create/update/deleteGroupSchema`, `attachTransactionTagSchema`, `attachTransactionGroupSchema`, `attachRefundLinkSchema`, `setGroupHiddenSchema`, `transactionUpsertSchema`, `budgetUpsertSchema`, `goalUpsertSchema`, `csvImportRowSchema`, `smartCategorize{Preview,Apply}Schema`, `smartTag{Preview,Apply}Schema` | Schemas encode input shape only, not authz | — | **`createAccountSchema.currencyCode` defaults to `"USD"`** (line ~47) while `getOrCreateDefaultAccount` (finance.ts) hardcodes `"INR"` for its auto-provisioned account and the DB column itself (`financeAccounts.currencyCode`) defaults to `"USD"` — three different default-currency sources that disagree (see §4/§7). `transactionUpsertSchema` has **no currency field at all** — currency is never client-controlled for a single transaction, it's always server-derived (inconsistently, per finding above). |

### A.4 FINANCE / MONEY HELPERS (`src/lib/finance/**`)

| Path | LOC | Purpose | Exports | Risks |
|---|---|---|---|---|
| `src/lib/finance/money.ts` | 35 | Canonical money helpers. | `parseSqlMinor(value)` (bigint/number/string-safe coercion from raw SQL results), `formatMoney(minor, currency)` (₹ special-cased with `en-IN` grouping; all other currencies via `Intl` `style: "currency"`), `parseIndianAmount(raw)` (parses `"2,18,198.00"` → minor-unit integer, used by every bank importer) | `formatMoney` only special-cases `"INR"` — every other currency goes through `Intl.NumberFormat`'s locale-default grouping (not Indian digit grouping), which is correct behavior but worth knowing since the account currency picker (`currencies.ts`) offers 10 currencies. |
| `src/lib/finance/currencies.ts` | 16 | Static list of 10 supported currency codes for the account-currency picker. | `SUPPORTED_CURRENCIES`, `SUPPORTED_CURRENCY_CODES`, type `SupportedCurrencyCode` | This list is **UI-only** — nothing in `validation/finance.ts` or `finance.ts` actually restricts `currencyCode` to this set server-side (`createAccountSchema.currencyCode` just requires length 3); a client could set an arbitrary 3-letter code via direct API call. |
| `src/lib/finance/summary.ts` | 129 | Period selection/formatting: month-key parsing/resolution, year resolution (always includes current year), date-range derivation for month/year/all periods, label formatting (`en-IN` locale for month/year names). | `SummaryPeriod`, `SummarySelection` types; `parseSummaryPeriod`, `currentMonthKey`, `parseMonthKey`, `resolveMonthKey`, `parseYearValue`, `readRowYear`, `normalizeSummaryYears`, `resolveYearValue`, `monthKeyToDate`, `formatMonthKey(Short)`, `getSummaryLabel`, `getSummaryPrefix`, `buildSummarySelection`, `summarySelectionToDateRange` | Pure, well-tested indirectly via consumers (no dedicated test file, unlike most other `finance/*` modules). |
| `src/lib/finance/refunds.ts` | 12 | Category-name-based refund/split-return classification. | `REFUND_CATEGORY_NAME = "Refund"`, `SPLIT_RETURN_CATEGORY_NAME = "Split Return"`, `isRefundCategoryName`, `refundLinkKind` | **Fragile-by-design**: refund/split-return detection is a **string match on the category's display name**, not a dedicated boolean/enum column. Renaming the "Refund" category (which any user can do via Control CRUD, since categories are free-text) silently breaks `attachRefundLink`'s validation (`if (!credit \|\| !isRefundCategoryName(credit.categoryName)) return null;`) and all refund-mismatch warning computation. |
| `src/lib/finance/bill-categories.ts` | 19 | "Bill" categorization is also name-based: any category (or its parent) whose name matches `\bbill\b` (case-insensitive, word boundary) is a bill category, used to build the Dashboards "Monthly/Yearly bills" widgets. | `isBillCategoryName`, `billCategorySqlFilter()` (raw SQL regex `~* '\\mbill\\M'`), `filterBillCategoryRows` | Same fragility pattern as refunds — purely name-based, no schema flag. A category named "Utility Billing" would match; a category named "Rent" that a user mentally considers a "bill" would not. |
| `src/lib/finance/transaction-warnings.ts` | 116 | Computes cross-transaction warnings for mismatched refund/split-return link totals using a connected-components (BFS) graph algorithm over the refund-links table, then compares credit-total vs expense-total per component. | `computeRefundLinkWarnings(links, transactions, formatDifference)`, `transactionHasRefundLinks`, types `TransactionWarning`, `RefundLinkRow`, `RefundWarningTransaction` | Correctly handles N:M refund graphs (not just 1:1 pairs) via connected components — more sophisticated than the `IMPORT.md`/architecture docs let on. If a component has **both** a "Refund" and a "Split Return" credit, both warning codes get attached to every transaction in the component (line ~88, `if (!codes.size) codes.add("refund_mismatch")` fallback only fires when *neither* kind matches). |
| `src/lib/finance/dashboard-widgets.ts` | 298 | Dashboard widget catalog/registry (14 widget definitions across `summary/spending/trends/goals/billing` categories), per-widget enable/disable persistence via a comma-joined URL/localStorage string, meter-row builders (spend/budget/goal meters with % clamped to 100), and the "Top-N + Other" category-trend chart data builder. | `DASHBOARD_WIDGET_CATALOG`, `DEFAULT_DASHBOARD_WIDGETS`, `parseDashboardWidgets`, `serializeDashboardWidgets`, `isDashboardWidgetEnabled`, `METER_COLORS`, `meterColor`, `toSpendMeters`, `toBudgetMeters`, `toGoalMeters`, `buildMonthKeys`, `buildCategoryTrendChart` | `buildCategoryTrendChart` correctly buckets low-volume categories into an "Other" bucket only when the underlying data actually contains a non-top-N category for at least one visible month — otherwise "Other" is dropped from the legend entirely (line ~296 filter). |
| `src/lib/finance/filter-params.ts` | 19 | Tiny helpers for comma-joined multi-value URL query params (used for category/tag filters). | `parseMultiFilterParam`, `serializeMultiFilterParam`, `filterValidIds` | Trivial, well-covered by its 18-line test file. |
| `src/lib/finance/merchant-match.ts` | 55 | Fuzzy merchant-name matching for the smart-categorize/smart-tag "apply to similar merchants" feature: Levenshtein distance + substring-containment shortcut, normalized (lowercase, whitespace-collapsed) comparison. | `normalizeMerchant`, `merchantSimilarity`, `isFuzzyMerchantMatch(threshold=0.72)`, `rankFuzzyMerchants(limit=8)` | The substring-containment shortcut (`shorter.length >= 4 && longer.includes(shorter)`) returns a score floor of `0.75` regardless of how much longer the "longer" string is — e.g. "AMZN" (4 chars) inside "AMZN MKTPLACE SOME VERY LONG SUFFIX" (35 chars) still scores ≥0.75 and clears the 0.72 threshold, which is probably desirable for merchant-suffix noise but could also over-match short/generic merchant name fragments. |
| `src/lib/finance/transaction-search.ts` | 75 | Free-text transaction search: matches merchant/notes via `ILIKE`, plus **numeric-amount** matching two ways — exact parsed-amount equality, and a raw digit-substring match against the amount cast to text. | `parseAmountSearchTerm`, `extractAmountDigitPattern`, `transactionSearchMatchesAmount` (client-side variant), `buildTransactionSearchCondition` (Drizzle, used by `listTransactions`), `buildSummarySearchFilterSql` (raw SQL, used by all dashboard aggregate queries) | **False-positive risk:** the digit-substring match (`cast(amount_minor as text) ilike '%12345%'`) matches *any* transaction whose minor-unit integer contains that digit sequence anywhere — e.g. searching `"500"` matches an amount of `150050` (₹1,500.50) purely because `"150050"` contains `"500"` as a substring, with no boundary/decimal awareness. This is an intentional trade-off for "search by amount fragment" UX but is undocumented and could confuse users comparing search results to expected totals. |
| `src/lib/actions/infinite-scroll.ts` | 32 | Svelte action wrapping `IntersectionObserver` (`rootMargin: "200px"`) to trigger `onLoad()` for infinite-scroll transaction loading. | `infiniteScroll` (Svelte `Action`) | Standard, no issues found. |
| `src/lib/import-stream.ts` | 112 | Client-side NDJSON stream reader/parser for the `/import/stream` endpoint: progress-percent/label mapping per event type, and `importStatementWithProgress()` which does the actual `fetch` + `ReadableStream` line-buffered NDJSON parsing. | `ImportStreamPhase`, `ImportStreamEvent` (discriminated union: `phase`/`progress`/`complete`/`error`), `importProgressPercent`, `importProgressLabel`, `importStatementWithProgress` | Progress-percent mapping is a fixed heuristic (`parsing`=8%, `loading`=12%, `importing` interpolates 12–94% by row count, `syncing`=96%, `complete`=100%) — cosmetic only, doesn't reflect real work distribution (e.g. `syncImportBalances`'s per-row balance sync loop, which is itself O(n) DB writes, is compressed into the 94→96% jump). |
| `src/lib/pg-native-stub.js` | 2 | Empty default-export stub aliased for `pg-native` in `vite.config.ts` (native Postgres bindings aren't needed/available in this Bun+Drizzle setup). | `default` (undefined) | Trivial but load-bearing for the build — removing the alias would break bundling if any transitive dep tries to `require("pg-native")`. |

### A.5 IMPORTERS (`src/lib/importers/**`)

| Path | LOC | Purpose | Exports | Risks |
|---|---|---|---|---|
| `src/lib/importers/types.ts` | 44 | Shared type contracts. | `ImportRow`, `ImportResult`, `StatementInput`, `BankImporter` | `BankImporter.parse` returns `{ rows, metadata }` — no way for a parser to report *partial* failure short of throwing (all-or-nothing at the file level; per-row issues are only surfaced later, in `importTransactionRows`'s Zod validation, not from the bank parser itself — matches `deferred-work.md`'s "silently skip rows... no partial-import warning" for PDF-level skips). |
| `src/lib/importers/index.ts` | 53 | Importer registry + the `generic` CSV importer inline. | `genericImporter` (BankImporter), `getImporter(id)` (throws `Unknown bank importer` if missing), `listImporters()`, `importerAcceptList()` | `genericImporter.parse` does **not** apply `parseIndianAmount` — it does `Number(row.amountMinor)` directly, i.e. the generic CSV format expects **pre-converted minor-unit integers**, not "2,18,198.00"-style major-unit strings like the bank importers. This asymmetry (bank importers convert major→minor; generic importer expects minor already) is easy to get wrong when hand-authoring a generic CSV. |
| `src/lib/importers/import-report.ts` | 48 | Builds the downloadable "skipped/rejected rows" CSV report from accumulated `ImportIssue[]`. | `ImportIssue` (type), `importIssueFromRow`, `buildImportReportCsv` | Formats amounts via `formatMoney(amountMinor, "INR")` — **hardcodes INR** regardless of the account's actual currency; a non-INR account's import report would mislabel amounts with a ₹ symbol. |
| `src/lib/importers/transaction-dedup.ts` | 19 | Dedup-key computation shared between the pre-import skip check and post-import SQL dedupe. | `transactionFingerprint`, `transactionDedupKey` | Matches `IMPORT.md` exactly: with `externalRef` present, key = `ref\|date\|amount\|type`; without, key = `date\|amount\|merchant\|type`. Comment explicitly documents *why* amount+type must be part of the ref-based key even though ref alone should be unique: "Kotak reuses refs across related legs (deposit + fee, auth + reversal)". |
| `src/lib/importers/kotak.ts` | 86 | `BankImporter` for Kotak: dispatches to PDF (`parseKotakPdf`) or CSV (`parseKotakCsv`, defined inline in this file) based on MIME/extension. CSV path: finds the `Transaction Date` header row, extracts account-number/period/currency/IFSC metadata from preceding rows, then parses each numbered data row (serial/dates/description/reference/amount/CR-DR/balance). | `kotakImporter` | CSV metadata extraction (`extractCsvMetadata`) only scans the **first 20 rows** for `key,value` pairs — if Kotak ever moves metadata further down, extraction silently returns `{}` with no error. |
| `src/lib/importers/kotak-shared.ts` | 154 | Kotak-specific text helpers shared by CSV+PDF paths: date parsing (CSV `DD-MM-YYYY`, PDF `DD Mon YYYY`), merchant extraction from description (`UPI/`, `PCD/PCI/`, `ATW/`, `Int.Pd:`, `CASHBACK EARNED`, `NEFT ... name` patterns), external-ref regex/normalization (`UPI-`, `IMPS-`, `NEFTINW-`, `ONBF-`, bare 10–15-digit refs), **two** page-footer strippers (legacy vs "monthly" PDF format — see below), and account/period/IFSC/currency metadata extraction from PDF text. | `parseKotakCsvDate`, `parseKotakPdfDate`, `merchantFromDescription`, `extractKotakExternalRef`, `isKotakMonthlyPdf`, `stripKotakMonthlyPdfChunkFooter`, `parseSignedIndianAmount`, `stripKotakPdfChunkFooter`, `extractKotakMetadata` | **Both** footer strippers hardcode the literal account-holder name `"MUKUL SINGH"` in their regex patterns (`/\sMUKUL SINGH Account No\./i` and `/\sMUKUL SINGH Account Statement/i`) — `IMPORT.md` issue #5 documents this for the legacy stripper only; it is **also present, unfixed, in the newer monthly-format stripper**. Any other Kotak account holder's statement will fail footer-stripping and silently drop/corrupt the last transaction on every PDF page (the exact failure mode of the now-fixed issue #1). |
| `src/lib/importers/kotak-pdf.ts` | 120 | Two independent PDF parsers selected by `isKotakMonthlyPdf(text)`: **legacy** (`parseKotakLegacyPdf` — "Account Statement" layout, unsigned amount + running balance, type inferred from balance-delta sign, chronological order in the PDF) and **monthly** (`parseKotakMonthlyPdf` — "Account #" layout with per-transaction time-of-day, explicitly signed amount `+`/`-`, rows in **reverse-chronological** order in the PDF so the parser `.reverse()`s the array at the end). | `parseKotakPdf(text)` | This dual-format dispatch is a **substantial undocumented feature** relative to `IMPORT.md`, which only describes the legacy chunking strategy (see §7/contradictions). The `.reverse()` call for monthly PDFs (line ~109) is a subtle, easy-to-miss detail — if a third Kotak PDF layout is ever added with yet another row order, a naive copy-paste of the monthly parser would silently reverse-sort correctly-ordered data. |
| `src/lib/importers/icici.ts` | 22 | `BankImporter` for ICICI — **PDF only**, throws if a non-PDF file is uploaded. | `iciciImporter` | Simple, matches `IMPORT.md`. |
| `src/lib/importers/icici-shared.ts` | 101 | ICICI-specific helpers: date parsing (`DD.MM.YYYY` dotted or `DD Mon YYYY`), description-body extraction via a large alternation regex of ICICI transaction-type prefixes (`UPI/NEFT/IMPS/INF/INFT/ATM/BIL/ONL/VPS/IPS/EBA/NECS/RTGS/CMS/BPAY/RCHG/TOP/MMT/PAYC/CCWD/LNPY/PAVC/PAC/VAT/MAT/NFS/SMO/BCTT/SGB/DTAX/IDTX/BBPS`), external-ref extraction (12–15-digit path segment, or `PYTM...`/`YJP...` tokens), page-footer stripping (7 patterns), account/period metadata extraction. | `parseIciciPdfDate`, `iciciDescriptionFromBody`, `extractIciciExternalRef`, `stripIciciPdfChunkFooter`, `extractIciciMetadata` | The transaction-type alternation list is a maintenance burden — any ICICI narration prefix not in that list falls through to `body.trim()` (the whole un-trimmed body), likely including boilerplate before the real description. |
| `src/lib/importers/icici-pdf.ts` | 62 | Chunks PDF text by `serial + DD.MM.YYYY` starts (same pattern as Kotak legacy), strips footers, matches trailing `amount balance`, computes `type` from balance-delta sign (defaulting to `"expense"` when delta is `null` **or exactly `0`**), reuses **Kotak's** `merchantFromDescription` (imported from `kotak-shared.ts`) rather than an ICICI-specific merchant extractor. | `parseIciciPdf(text)` | **(a)** Rows with `transactionAmountMinor <= 0` are silently `continue`d (dropped) with zero reporting — matches `deferred-work.md`. **(b)** Reuses Kotak's merchant heuristic even though ICICI narrations (post `iciciDescriptionFromBody`) have a structurally different prefix format (`UPI/NAME/vpa@bank/...`) vs Kotak's (`UPI/NAME/ref/...`) — works because both start with `UPI/`, but is a cross-bank coupling that would break silently if either bank's format diverges. |
| `src/lib/importers/hdfc.ts` | 22 | `BankImporter` for HDFC — **PDF only**, throws if a non-PDF file is uploaded. | `hdfcImporter` | Simple, matches `IMPORT.md`. |
| `src/lib/importers/hdfc-shared.ts` | 98 | HDFC-specific helpers: date parsing (`DD/MM/YY` or `DD/MM/YYYY`, 2-digit years assumed `20xx`), merchant extraction (`UPI-`/`UPI-AUTOPAY-` hyphen-delimited narrations with VPA-boundary lookahead, `ACH D-`/`ACH C-` narrations), external-ref extraction (10+ digit Chq./Ref.No. only — shorter/alphanumeric refs return `undefined`), page-footer stripping (7 patterns incl. `STATEMENT SUMMARY`), and opening-balance extraction from the statement-summary block. | `parseHdfcPdfDate`, `merchantFromHdfcDescription`, `extractHdfcExternalRef`, `stripHdfcPdfChunkFooter`, `extractHdfcMetadata` | `merchantFromHdfcDescription`'s VPA-boundary lookahead regex is genuinely intricate (comment explains PDF text-wrap can insert spaces mid-token) — well-tested (4 assertions in the test file) but the most fragile single regex in the codebase. 2-digit-year assumption (`20${yearRaw}`) will misparse any statement from 1999 or earlier (not realistic for this app, but an unguarded Y2K-style assumption). |
| `src/lib/importers/hdfc-pdf.ts` | 65 | Chunks PDF text by `DD/MM/YY` **followed by a letter** (distinguishes transaction-start dates from value dates, which are followed by amounts), strips footers, matches trailing `ref(10+ digits) valueDate amount balance [wrapped-narration]`, computes `type` from balance-delta sign vs. **opening balance** (extracted from statement summary) seeded as `previousBalanceMinor`, defaults to `"expense"` when delta is `null`/`0`. | `parseHdfcPdf(text)` | **(a)** `sortOrder` is simply `parsedRows.length + 1` (positional, no serial number in the source PDF) — unlike Kotak/ICICI which use the statement's own serial column, so HDFC sort order has no independent cross-check against a bank-provided sequence number (can't detect a dropped row the way `IMPORT.md`'s "missing serial" SQL check does for Kotak). **(b)** `if (amountMinor <= 0) continue;` — same silent-drop pattern as ICICI. |

### A.6 API ROUTES (`src/routes/api/accounts/**/+server.ts`)

All 19 route files read in full; summarized in the API contracts table (§1). Common pattern across every mutating handler: `requireUser(locals)` → `getMembershipOrThrow(user.id, params.accountId)` → `if (!canEdit(membership.role)) throw error(403, ...)` → `readJsonBody`/`request.formData()` → call into `$lib/server/finance.ts` or `$lib/server/import.ts`. Read-only (`GET`) handlers stop after `getMembershipOrThrow` (viewers can read).

Notable per-route details not already covered under `finance.ts`/`import.ts`:

- **`transactions/export/+server.ts`** (55 LOC) — ignores all query-string filters (`type`, `dateFrom`, `dateTo`, `search`, etc.); always exports the **entire account's transaction history**, sorted by `occurredOn, id`. Confirms `FUTURE-TODO.md`'s unchecked "Filtered export" item is still genuinely unimplemented.
- **`transactions/import/+server.ts`** (56 LOC, JSON-response variant) vs **`transactions/import/stream/+server.ts`** (80 LOC, NDJSON streaming variant) — both call `getImporter` → `importTransactionRows` with the same options; the stream variant additionally wires `onProgress` into `ReadableStream` writes. The non-streaming variant's `GET` handler (line 8) doubles as a "list available importers" endpoint (`{ importers: [...] }`) — an unusual overload of a resource-oriented path (`GET .../import` returning importer metadata rather than import history/status, since there's no import-history feature at all yet, matching `FUTURE-TODO.md`).
- **`transactions/[transactionId]/+server.ts`** (30 LOC) — `PATCH` uses `transactionUpsertSchema.partial()`, so every field is independently optional; `updateTransaction` in `finance.ts` correctly distinguishes "field omitted" from "field explicitly set to null" only for `categoryId` (`if ("categoryId" in payload)` — the one nullable field), all other fields use `!== undefined` checks that can't represent "clear this field to empty" for `merchant`/`notes`/`externalRef` (they'd need an explicit empty string, which the Zod schema's `.optional()` without `.nullable()` doesn't cleanly support from a JSON `null`).
- **Budgets/goals `[id]/+server.ts`** — **only `PATCH` is exported, there is no `DELETE`** for either `budgets/[budgetId]` or `goals/[goalId]` (verified by direct read and repo-wide grep for `export async function DELETE` under both directories — zero matches). This contradicts `_bmad-output/chhan-chhan/planning-artifacts/api-contracts.md`, which lists `PATCH/DELETE` for both (see §8).

### A.7 AUTHZ-BEARING LOAD FUNCTIONS

| Path | LOC | Authz behavior |
|---|---|---|
| `src/routes/+layout.server.ts` | 13 | No authz — always returns `{ user: locals.user ? {...} : null }` for the root layout (used by nav/UI, not a gate). |
| `src/routes/+page.server.ts` | 7 | No authz — unconditional `redirect(307, "/app")`; the real gate happens downstream in `(protected)`. |
| `src/routes/(protected)/app/+layout.server.ts` | 13 | `if (!locals.user?.id) redirect(307, "/login")`, then `getOrCreateDefaultAccount(locals.user.id)` — **this is the only place account resolution happens for the whole `/app` UI tree**; no accountId comes from the URL or a cookie (see §5 Multi-account model). |
| `src/routes/(protected)/app/+page.server.ts` | 133 | Inherits `account` from parent layout (no additional membership check — relies on the layout having already resolved a valid account for this user via `getOrCreateDefaultAccount`, which by construction only ever returns accounts the user is a member of). Builds the full ledger page dataset: transactions page 1, analytics, summary, current balance, category spend, plus category/tag/group filter option lists and the refund-link cluster resolution for the `?link=` query param. |
| `src/routes/(protected)/app/control/+page.server.ts` | 416 | `load`: re-checks `if (!locals.user?.id) redirect(307, "/login")` (redundant with layout, defense-in-depth) then loads via parent's `account`. **13 form actions**, every one independently re-derives `user` → `account = getOrCreateDefaultAccount(user.id)` → `membership = getMembershipOrThrow(...)` → `canEdit` check — i.e. **every Control mutation is scoped to the user's default (alphabetically-first) account, never to a URL/form-supplied `accountId`** (see §5). Actions: `createCategory`, `updateCategory`, `deleteCategory`, `createTag`, `updateTag`, `deleteTag`, `createGroup`, `updateGroup`, `deleteGroup`, `updateCurrency`, `updateOpeningBalance` (handles both set and `clear=1` sentinel), `importStatement` (legacy non-streaming form-based import — the UI actually prefers the JS-driven `/import/stream` fetch call per `IMPORT.md`), `clearAllTransactions`. |
| `src/routes/(protected)/app/dashboards/+page.server.ts` | 181 | Inherits `account` from parent layout; no independent authz check (same trust chain as the ledger page). Notably **selective**: only fetches data for widgets currently enabled (`isDashboardWidgetEnabled`) via `needsX ? getX(...) : Promise.resolve([])` guards on every one of the ~10 possible aggregate queries — avoids unnecessary DB load when a user has disabled widgets. |
| `src/routes/health/+server.ts` | 12 | **No auth at all** (by design — it's a liveness probe): `SELECT 1` against the DB; `{status:"ok"}` / 200 on success, `{status:"error", db:false}` / 503 on failure (any thrown error, including auth/schema errors, is caught generically). |

### A.8 SHARED SCHEMA — `shared/db/src/schema/chhanchhan.ts` (333 LOC)

Postgres schema `chhanchhan` (via `pgSchema`). Enums: `account_member_role` (`owner`/`editor`/`viewer`), `transaction_type` (`expense`/`income`/`transfer`), `budget_period` (`monthly`/`weekly`/`custom`), `goal_status` (`active`/`paused`/`completed`/`cancelled`).

| Table | Key columns | FKs / cascade behavior | Indexes/constraints |
|---|---|---|---|
| `finance_accounts` | `owner_user_id`, `name`, `currency_code` (default `"USD"`), `timezone` (default `"UTC"`), `is_archived`, `balance_minor` (bigint, nullable), `balance_as_of` (date, nullable) | `owner_user_id` → `auth.user.id`, `onDelete: cascade` | index on `owner_user_id` |
| `finance_account_members` | `account_id`, `user_id`, `role` (default `"viewer"`) | both FKs `onDelete: cascade` | **unique** `(account_id, user_id)`; index on `user_id` |
| `finance_categories` | `account_id`, `name`, `kind` (default `"expense"`), `color_hex`, `parent_category_id` (self-ref, **no FK constraint defined** — plain `uuid()` column) | `account_id` → cascade | unique `(account_id, name)`; index on `account_id` |
| `finance_transactions` | `account_id`, `category_id` (nullable), `occurred_on` (date), `amount_minor` (bigint, **always positive**, sign implied by `type`), `currency_code` (default `"USD"`), `type`, `merchant`, `notes`, `external_ref`, `balance_minor` (nullable), `sort_order` (int, default 0) | `account_id` → cascade; `category_id` → `set null` on delete | composite indexes: `(account_id, occurred_on)`, `(account_id, category_id)`, `(account_id, sort_order)` |
| `finance_budgets` | `account_id`, `category_id` (nullable), `name`, `period`, `start_date`, `end_date` (nullable), `limit_minor` (bigint), `is_active` | `account_id` → cascade; `category_id` → **cascade** (deleting a category deletes any budget scoped to it — differs from `finance_transactions.category_id`'s `set null`) | index on `account_id` |
| `finance_goals` | `account_id`, `name`, `target_minor`, `current_minor` (default 0), `target_date` (nullable), `status` (default `"active"`) | `account_id` → cascade | index on `account_id` |
| `finance_tags` | `account_id`, `name`, `color_hex` | `account_id` → cascade | unique `(account_id, name)`; index on `account_id` |
| `finance_transaction_tags` | `transaction_id`, `tag_id` (junction, no own `id`) | both → cascade | composite PK `(transaction_id, tag_id)`; index on `tag_id` |
| `finance_groups` | `account_id`, `name`, `color_hex` | `account_id` → cascade | unique `(account_id, name)`; index on `account_id` |
| `finance_transaction_groups` | `transaction_id`, `group_id`, `is_hidden` (default false, junction) | both → cascade | composite PK `(transaction_id, group_id)`; index on `group_id` |
| `finance_transaction_refund_links` | `credit_transaction_id`, `expense_transaction_id` (junction) | both → `finance_transactions.id`, cascade | composite PK `(credit_transaction_id, expense_transaction_id)`; index on `expense_transaction_id` |

Every table also gets `id` (uuid PK, `default(sql\`uuidv7()\`)` — **requires PostgreSQL 18+**), `createdAt`/`updatedAt` (`timestamps`), and `createdById`/`updatedById` (`actionsByUser`, both FK to `auth.user.id`; `createdById` is `.notNull()`, `updatedById` is nullable and `onDelete: cascade` too — deleting the user who last touched a row **cascades and deletes that row**, not just nulls the field, since both FKs use `cascade` rather than `set null`).

**Notable schema-level risk:** `finance_categories.parent_category_id` is declared as a bare `uuid("parent_category_id")` with **no `.references()`** — unlike every other relationship in this file, there's no DB-level FK constraint enforcing that it points to a real category (or preventing dangling references after a parent category is deleted). The Drizzle `relations()` block (`parentCategory: one(financeCategories, {...})`) declares the *application-level* relation, but nothing stops orphaned `parent_category_id` values at the DB layer. This directly affects `billCategorySqlFilter()`'s `LEFT JOIN financeCategories parent ON parent.id = c.parent_category_id` in `finance.ts` — an orphaned parent id just yields `NULL` (safe), but it means parent-category integrity is entirely app-enforced (and no app code was found that actually *sets* `parent_category_id` anywhere — it's schema-only, unused by any current CRUD path).

---

## Part B — Synthesis

### 1. Complete API contracts table

All paths are relative to `/api/accounts`. Every route (mutating and read) requires an authenticated session (`requireUser`); every route requires `getMembershipOrThrow(user, accountId)` (403 if not a member). Routes marked **canEdit** additionally 403 unless `role ∈ {owner, editor}`.

| Method | Path | Authz | Body / Query | Notes |
|---|---|---|---|---|
| GET | `/api/accounts` | session only | — | Lists accounts the user is a member of (`listAccountsForUser`) |
| POST | `/api/accounts` | session only | `createAccountSchema` (name, currencyCode default `"USD"`, timezone default `"UTC"`) | Creates account + inserts caller as `owner` member, in one DB transaction |
| GET | `/api/accounts/[accountId]/analytics` | member | — | `getAnalytics`: monthly + all-time summary, this-month category spend, active-budget usage, goals |
| GET | `/api/accounts/[accountId]/categories` | member | — | `listCategories` |
| POST | `/api/accounts/[accountId]/categories` | **canEdit** | `createCategorySchema` | 409 on duplicate name (unique constraint → `onConflictDoNothing` → null) |
| GET | `/api/accounts/[accountId]/budgets` | member | — | `listBudgets` |
| POST | `/api/accounts/[accountId]/budgets` | **canEdit** | `budgetUpsertSchema` | Create only |
| PATCH | `/api/accounts/[accountId]/budgets/[budgetId]` | **canEdit** | `budgetUpsertSchema` | 404 if not found in this account. **No DELETE route exists.** |
| GET | `/api/accounts/[accountId]/goals` | member | — | `listGoals` |
| POST | `/api/accounts/[accountId]/goals` | **canEdit** | `goalUpsertSchema` | Create only |
| PATCH | `/api/accounts/[accountId]/goals/[goalId]` | **canEdit** | `goalUpsertSchema` | 404 if not found. **No DELETE route exists.** |
| GET | `/api/accounts/[accountId]/transactions` | member | `transactionsQuerySchema` (pageIndex, pageSize≤200, search, categoryIds, tagIds, type, dateFrom/To, groupId, linkTransactionId, sortBy, sortDirection) | Paginated; enriches each row with tags/groups/refundLinks/warnings (and `groupHidden` if `groupId` filter set) |
| POST | `/api/accounts/[accountId]/transactions` | **canEdit** | `transactionUpsertSchema` | **Hardcodes `currencyCode: "USD"`** regardless of account currency (see §7) |
| PATCH | `/api/accounts/[accountId]/transactions/[transactionId]` | **canEdit** | `transactionUpsertSchema.partial()` | 404 if not found in this account |
| DELETE | `/api/accounts/[accountId]/transactions/[transactionId]` | **canEdit** | — | Cascades tags/groups/refund-links |
| GET | `/api/accounts/[accountId]/transactions/export` | member | — | Full-account CSV (ignores all filters — see §7) |
| GET | `/api/accounts/[accountId]/transactions/import` | member | — | Returns `{ importers: [{id,label}] }` (metadata endpoint reused as "GET on import path") |
| POST | `/api/accounts/[accountId]/transactions/import` | **canEdit** | multipart: `file`, `importer` (default `"kotak"`), `skipDuplicates` (default true unless `"false"`) | Synchronous JSON result (`ImportResult`) |
| POST | `/api/accounts/[accountId]/transactions/import/stream` | **canEdit** | same multipart shape | NDJSON streaming progress (`phase`/`progress`/`complete`/`error` events); UI's primary import path |
| GET | `/api/accounts/[accountId]/transactions/smart-categorize` | member | `merchant`, `newCategoryId?`, `sourceTransactionId`, `type` (query) | Preview of exact + fuzzy-merchant category migrations |
| POST | `/api/accounts/[accountId]/transactions/smart-categorize` | **canEdit** | `smartCategorizeApplySchema` | Applies category to source txn + selected merchant migrations |
| GET | `/api/accounts/[accountId]/transactions/smart-tag` | member | `merchant`, `newTagId`, `sourceTransactionId`, `type` (query) | Preview of exact + fuzzy-merchant tag-profile migrations |
| POST | `/api/accounts/[accountId]/transactions/smart-tag` | **canEdit** | `smartTagApplySchema` (adds `mode: "replace"\|"append"`) | Applies tag to source txn + selected merchant migrations |
| POST | `.../transactions/[transactionId]/tags` | **canEdit** | `attachTransactionTagSchema` (tagId) | 404 if txn or tag not found in account |
| DELETE | `.../transactions/[transactionId]/tags/[tagId]` | **canEdit** | — | 404 if link not found |
| POST | `.../transactions/[transactionId]/groups` | **canEdit** | `attachTransactionGroupSchema` (groupId) | 404 if txn or group not found |
| PATCH | `.../transactions/[transactionId]/groups/[groupId]` | **canEdit** | `setGroupHiddenSchema` (hidden: boolean) | Sets per-transaction group visibility (used for "hide from group total" without removing the group tag) |
| DELETE | `.../transactions/[transactionId]/groups/[groupId]` | **canEdit** | — | 404 if link not found |
| POST | `.../transactions/[transactionId]/refund-links` | **canEdit** | `attachRefundLinkSchema` (expenseTransactionId) | `transactionId` must be a "Refund"/"Split Return"-categorized credit; expense must be `type: "expense"` in same account |
| DELETE | `.../transactions/[transactionId]/refund-links/[expenseTransactionId]` | **canEdit** | — | 404 if link not found |
| GET | `/health` (top-level, not under `/api/accounts`) | **none** | — | DB liveness probe (`select 1`) |

**Not exposed via `/api`** (only as SvelteKit form actions on `/app/control`, always scoped to `getOrCreateDefaultAccount(user)` — see §5): update/delete category, update/delete tag, update/delete group, update account currency, set/clear opening balance, legacy (non-streaming) import, clear-all-transactions.

### 2. Auth / membership / canEdit flow

1. **Session establishment** — `src/hooks.server.ts` runs on every request: calls `auth.api.getSession({ headers })` (Better Auth, via `@pocket-dimension/auth`), populates `event.locals.session`/`event.locals.user` if a valid session cookie exists. This is the *only* place session state enters `locals`.
2. **Route-group gating** (still in `hooks.server.ts`):
   - `(auth)/*` (login/sign-up/forgot-password/etc.): if a session exists **and** `emailVerified`, redirect to `/app` — except `verify-email` and `check-email`, which remain visible to logged-in-but-unverified users so they can complete verification.
   - `(protected)/*`: no session → redirect to `/login?redirect=<original path+query>`; session but `!emailVerified` → redirect to `/check-email?reason=verify`.
   - After both checks, `svelteKitHandler({ event, resolve, auth, building })` runs Better Auth's own route handling (for its internal API paths) before `resolve(event)` proceeds normally.
3. **Per-page defense in depth** — `(protected)/app/+layout.server.ts` and `control/+page.server.ts`'s `load` **both** re-check `if (!locals.user?.id) redirect(307, "/login")` even though `hooks.server.ts` already guarantees this for anything under `(protected)`. Belt-and-suspenders, not a functional gap.
4. **Account membership** — `getMembershipOrThrow(userId, accountId)` (`src/lib/server/authz.ts`) is the single chokepoint: queries `financeAccountMembers` for a `(accountId, userId)` row; throws SvelteKit `error(403, ...)` if none exists. Every API route and every Control form action calls this (directly, or transitively via `requireUser` + explicit call) before touching any finance data.
5. **Role-based write gating** — `canEdit(role)` returns `true` only for `"owner"` or `"editor"`; `"viewer"` (and any future role not in that check) is implicitly read-only. Every mutating API route follows the identical pattern: `requireUser` → `getMembershipOrThrow` → `if (!canEdit(membership.role)) throw error(403, "You only have read access")` → validate body → mutate.
6. **Ownership at creation** — `createAccount(userId, payload)` (`finance.ts`) wraps account creation + the creator's `owner` membership row in a single `db.transaction()`, guaranteeing an account is never created without an owning member.
7. **Account *resolution* is currently single-account-only in the UI** — see §5. There is no accountId-in-URL routing for the `(protected)/app` tree; every page and Control action derives the account from `getOrCreateDefaultAccount(user.id)`, which itself calls `getMembershipOrThrow`-equivalent logic implicitly (it only ever returns accounts from `listAccountsForUser`, which is already scoped to the user's own memberships).
8. **Cookie caveat** (documented in `AGENTS.md`/`project-context.md`, confirmed by reading `auth-client.ts`): Better Auth cookies are `secure: true`/`sameSite: "none"`; over plain `http://localhost` the browser may not persist the session, so local manual testing of the auth flow can appear to "not stick" even though signup/verification logic itself is correct.

### 3. Importer architecture (kotak / icici / hdfc / generic)

```
StatementInput { fileName, mimeType, bytes }
        │
        ▼
 getImporter(id)  ──►  BankImporter.parse(input)
        │                     │
        │            ┌────────┴─────────┐
        │        CSV path            PDF path
        │     (Kotak, generic)    (Kotak, ICICI, HDFC)
        │                              │
        │                    extractPdfText(bytes)   [unpdf; merges pages, collapses whitespace]
        │                              │
        │                    {bank}-shared.ts helpers:
        │                      date parsing, merchant extraction,
        │                      external-ref extraction, footer stripping,
        │                      metadata extraction
        │                              │
        │                    {bank}-pdf.ts: regex-chunk by "serial + date" (or,
        │                      for HDFC, "date + letter") transaction starts,
        │                      strip page footer from each chunk, match trailing
        │                      "amount [+ balance]" pattern, derive type from
        │                      balance-delta sign (or explicit +/- for Kotak monthly)
        ▼
   { rows: ImportRow[], metadata: Record<string,string> }
        │
        ▼
 importTransactionRows(userId, accountId, rows, { skipDuplicates, currencyCode, onProgress })
        │   1. Load existing dedup keys for the account (if skipDuplicates)
        │   2. Per row: Zod-validate (csvImportRowSchema) → dedup-check → insert (sequential, unbatched)
        │   3. syncImportBalances(): per-row balance backfill on existing rows + advance
        │      account-level balance snapshot if this file's latest row is newer
        ▼
 ImportResult { totalRows, accepted, rejected, skipped, rejectionReasons, issues, reportCsv? }
```

**Per-bank format matrix:**

| Bank | Formats | Txn-start regex | Type inference | Merchant extractor | External-ref pattern |
|---|---|---|---|---|---|
| Kotak | CSV, PDF (2 sub-formats) | CSV: header-row anchored; PDF legacy: `serial + "DD Mon YYYY"`; PDF monthly: `serial + "DD Mon YYYY" + "HH:MM AM/PM" + valueDate` | CSV: explicit CR/DR column; PDF legacy: balance-delta sign; PDF monthly: explicit `+`/`-` sign on amount | `merchantFromDescription` (kotak-shared) — also reused by ICICI | `UPI-`/`IMPS-`/`NEFTINW-`/`ONBF-`/bare 10–15 digits, trailing in description |
| ICICI | PDF only | `serial + "DD.MM.YYYY"` | Balance-delta sign (0/null → expense) | Same `merchantFromDescription` as Kotak | 12–15-digit path segment, or `PYTM.../YJP...` tokens |
| HDFC | PDF only | `"DD/MM/YY"` followed by a **letter** (distinguishes from value-date-then-amount) | Balance-delta sign vs. opening-balance-seeded running total (0/null → expense) | `merchantFromHdfcDescription` (hyphen-delimited UPI/ACH parsing) | 10+ digit Chq./Ref.No. only |
| Generic | CSV only | N/A (column-mapped) | Explicit `type` column | Explicit `merchant` column (optional) | Explicit `externalRef` column (optional) |

**Dedup** is bank-agnostic and lives in `transaction-dedup.ts` + `import.ts`: prefer `externalRef|date|amount|type`, fall back to `date|amount|merchant|type` when no ref. Kotak's ref-reuse-across-legs behavior (documented in code comments and `IMPORT.md`) is the reason amount+type stay in the key even when a ref is present.

**Extending with a new bank**: implement `BankImporter` (`id`, `label`, `accept`, `parse`), register in `importers/index.ts`'s `importers` map, and — per the established convention — add `{bank}.ts` + `{bank}-pdf.ts` + `{bank}-shared.ts` + a `.test.ts` file, then document the strategy section in `IMPORT.md` (exactly as done for HDFC, traceable via `spec-hdfc-bank-importer.md`).

### 4. Money / minor-units conventions

- **All monetary amounts are stored as integer minor units** (e.g. paise for INR) in `bigint` DB columns (`amount_minor`, `balance_minor`, `limit_minor`, `target_minor`, `current_minor`) — never floats, never major-unit decimals.
- **Canonical conversion helpers** live in `src/lib/finance/money.ts`: `parseIndianAmount(raw)` converts an Indian-grouped decimal string (`"2,18,198.00"`) to minor units via `Math.round(parseFloat(cleaned) * 100)`; `formatMoney(minor, currency)` converts back to a locale-formatted display string (₹ gets `en-IN` grouping via a special case; everything else uses `Intl`'s currency formatter).
- **`parseSqlMinor`** exists specifically because raw `sql\`...\`` query results (used throughout the dashboard aggregate functions) return `bigint` from Postgres, which Drizzle/pg surfaces inconsistently as `bigint`/`number`/`string` depending on the driver path — this helper normalizes all three to a safe `number`.
- **Sign convention**: `amount_minor` is **always stored positive**; the signed direction is carried entirely in the separate `type` enum column (`expense`/`income`/`transfer`). All aggregate SQL uses `CASE WHEN type = 'income' THEN amount_minor ELSE 0 END` style conditional sums rather than relying on a signed value.
- **Currency-per-row is theoretically per-transaction** (`finance_transactions.currency_code`, default `"USD"`) but **in practice every write path either derives it from the account or hardcodes a default**, and those two paths disagree:
  - `importTransactionRows` correctly threads `currencyCode` from `getAccountCurrency(accountId)` (which reads `finance_accounts.currency_code`, defaulting to `"INR"` only if the account row itself is somehow missing/null).
  - `createTransaction` (manual "add transaction," both the JSON API and — transitively, since it's the only creation path — nowhere else) **hardcodes `currencyCode: "USD"` unconditionally**, ignoring the account's actual currency entirely. On the default auto-provisioned account (`"INR"`), every manually-typed transaction is silently mis-tagged as USD in the DB (though the UI never displays a raw per-transaction currency — it always formats using the *account's* currency — so this is a latent data-integrity bug rather than a visibly broken UI today).
  - The DB column default (`"USD"`), the Zod `createAccountSchema` default (`"USD"`), and the auto-provisioning default in `getOrCreateDefaultAccount` (`"INR"`) are three independent, disagreeing sources of truth for "what currency does a new account/transaction get."
- **No FX/multi-currency math anywhere** — `FUTURE-TODO.md`'s "Multi-currency" item (unchecked) confirms this is intentionally out of scope for now; the `currencyCode` column exists at the account level purely for **display formatting**, not for any cross-currency aggregation (all dashboard sums simply add `amount_minor` regardless of currency, which is only safe because every account is effectively single-currency in practice).

### 5. Multi-account model

**Data model already fully supports multiple accounts per user, and multiple users per account** (`finance_accounts` ← `finance_account_members` →, many-to-many, role-gated). Every `/api/accounts/[accountId]/...` route is genuinely account-scoped and membership-checked — the API layer has no "single account" assumption baked in.

**The UI layer, however, is still single-account** (confirmed by reading every load function and form action, and cross-checked against the existing planning docs):

- `(protected)/app/+layout.server.ts` calls `getOrCreateDefaultAccount(locals.user.id)` — the **only** account-resolution call for the entire `/app`, `/app/dashboards`, and `/app/control` page tree. There is no `accountId` route param, no cookie, no account switcher.
- `getOrCreateDefaultAccount` → if the user has zero accounts, creates one named `"Personal"` with `currencyCode: "INR"`, `timezone: "Asia/Kolkata"`, and makes the user its `owner`. If the user already has ≥1 account, it returns `listAccountsForUser(userId)[0]` — and that list is sorted `ORDER BY name ASC`, i.e. **"default account" means "alphabetically first account name," not "first created" or "primary."**
- `control/+page.server.ts`'s 13 form actions **each independently call `getOrCreateDefaultAccount(user.id)` again** rather than trusting `parent().account` — meaning every Control mutation is *always* re-resolved against the alphabetically-first account at action-invocation time, with no way to target a different account even if the user somehow has multiple.
- A genuine `POST /api/accounts` (create) and `GET /api/accounts` (list) exist and are fully functional, but **no UI calls them** — verified via repo-wide grep for `fetch(...api/accounts` (zero matches in `.svelte` files). Multi-account creation is only reachable today via direct API calls (e.g. `curl`/Postman), not through any button in the product.
- **This is a known, already-tracked gap**, not a surprise: `_bmad-output/chhan-chhan/planning-artifacts/architecture-multi-account.md` (status: `draft`, dated 2026-08-23) proposes exactly this fix — a `chhan_active_account_id` HTTP cookie, a `resolveActiveAccount(userId, cookies)` helper to replace `getOrCreateDefaultAccount` everywhere, and an account-switcher UI component. **None of that has been implemented yet** — verified by grepping the entire `src/` tree for `resolveActiveAccount`, `chhan_active_account_id`, and `setActiveAccount`: zero matches. `project-context.md` already accurately states this ("Until shipped, UI still uses `getOrCreateDefaultAccount()`"), so this is a confirmation of the documented plan's premise, not a contradiction — see §8 for the one *actual* contradiction found (budgets/goals DELETE).
- **Role model**: `owner`/`editor` can write (via `canEdit`), `viewer` is read-only everywhere. There is currently no UI to invite/add a member to an account, or to change a member's role — `finance_account_members` rows are only ever created by `createAccount` (as `owner`) and never elsewhere in the current codebase (no `POST /api/accounts/[id]/members` route exists).

### 6. Env vars

From `.env.example` (29 lines) + confirmed usages in code:

| Var | Used by | Purpose / notes |
|---|---|---|
| `NODE_ENV` | Bun/SvelteKit | `development`/`production` |
| `PORT` | `vite.config.ts` (dev), `svelte-adapter-bun` (prod) | Default 3005 |
| `PUBLIC_BASE_AUTH_URL` | `src/lib/auth-client.ts` (`$env/static/public`) | Must match `auth-service`'s public URL; **5001**, not the README's stale 3001 |
| `PUBLIC_BASE_AUTH_PATH` | `src/lib/auth-client.ts` | Better Auth basePath, default `/` |
| `DATABASE_URL` | `@pocket-dimension/db` (not directly read in this app's own source, but required transitively) | Postgres 18+ connection string; also gates whether `scripts/deploy-build.sh` runs migrations at build time |
| `BETTER_AUTH_SECRET` | `@pocket-dimension/auth` | **Must be identical** across `auth-service` and every frontend app (per root `AGENTS.md`) |
| `BETTER_AUTH_URL` | `@pocket-dimension/auth` | Same as `PUBLIC_BASE_AUTH_URL` typically |
| `BETTER_AUTH_PATH` | `@pocket-dimension/auth` | Default `/` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `@pocket-dimension/auth` | Comma-separated list; must include both auth-service and this app's own origin |
| `BETTER_AUTH_COOKIE_DOMAIN` | `@pocket-dimension/auth` | `localhost` in dev; `.example.com` (shared parent domain) in prod for cross-subdomain cookies |
| `RESEND_API_KEY` | `shared/auth/src/lib/emails.ts` (transitively, via `@pocket-dimension/auth`) | Must be **non-empty** or `auth-service` crashes at module load; a placeholder is fine locally |
| `RESEND_FROM_EMAIL` | same | Email "from" address |
| `BODY_SIZE_LIMIT` | SvelteKit/adapter | **Must be raised** (example: `10M`) for large multi-year PDF statement uploads — default adapter limit (512K) is too small; explicitly called out in both `IMPORT.md` issue #4 and `.env.example` comment |
| `ORIGIN` | SvelteKit adapter | Required in production behind a reverse proxy, for correct redirect/link generation |
| `RAILPACK_CONFIG_FILE` / `RAILPACK_BUILD_CMD` / `RAILPACK_START_CMD` | Railpack/Dokploy only | Not app runtime vars — only relevant when deploying from the monorepo root via Railpack instead of Docker |

Not in `.env.example` but referenced in code: none found — the app's own env surface is fully covered by the example file (aside from vars consumed only by `@pocket-dimension/db`/`@pocket-dimension/auth` internally, which have their own `.env.example` files per package, outside this deep-dive's scope).

### 7. Known gotchas / FUTURE-TODO items still real

Cross-checked every unchecked `FUTURE-TODO.md` item and every `deferred-work.md` bullet against the current code; all remain accurate. Additional gotchas found during this deep-dive that are **not yet written down anywhere**:

**Confirmed-still-real from `FUTURE-TODO.md` (unchecked items, spot-verified):**
- Budgets/Goals: list+create API exists, but **no Control UI CRUD** and **no DELETE route at all** for either resource (verified above) — "Budgets in Control" / "Goals in Control" are indeed still open.
- "Filtered export" — confirmed: `transactions/export/+server.ts` always dumps the whole account, ignoring every query param.
- "Multi-currency" — confirmed out of scope; see §4.
- "Shared household account" roles — the `owner`/`editor`/`viewer` enum and `canEdit` gate already exist end-to-end, but there is genuinely no UI/API to invite another user to an account (`finance_account_members` rows are only ever created inside `createAccount`).
- "Import history" / rollback-per-file — confirmed absent; there's no table or code tracking which import produced which rows, beyond the ephemeral `ImportResult`/report-CSV returned once per request.

**Confirmed-still-real from `deferred-work.md` (HDFC-focused, but the same patterns recur in ICICI too):**
- Silent row-skip with no partial-import warning surfaced to the user beyond the aggregate `rejected`/`skipped` counts (no per-row "PDF parse failed" issue type — only Zod-validation failures get an `ImportIssue`; PDF-regex non-matches are just `continue`d with **zero record** in `rows`).
- Type defaults to `"expense"` whenever balance-delta is null/zero, in **both** HDFC and ICICI parsers.
- `transfer` type is never assigned by any PDF/CSV bank parser — only reachable via manual edit or the generic-CSV importer's explicit `type` column.
- HDFC/ICICI: amounts `<= 0` are silently dropped with no reporting.

**New findings from this deep-dive (not previously documented anywhere in the repo):**

1. **Currency hardcoding bug** — `createTransaction()` in `finance.ts` hardcodes `currencyCode: "USD"`, ignoring the account's real currency. Only the import pipeline correctly threads the account's currency. Any manually-added transaction on an INR (or other non-USD) account is mistagged in the DB. (§4)
2. **"Default account" is alphabetical, not primary** — `getOrCreateDefaultAccount` = `listAccountsForUser(...)[0]`, and that list is `ORDER BY name ASC`. Combined with §5's finding that every Control action independently re-resolves this on every request, a user who creates or renames a second account to sort earlier alphabetically would find all of Control's mutations (including "Clear all transactions") silently start operating on the *other* account. High blast-radius if multi-account UI ships without first landing the `resolveActiveAccount` cookie helper the architecture doc proposes.
3. **`kotak-shared.ts` footer strippers hardcode a real person's name** ("MUKUL SINGH") in **both** the legacy *and* the newer monthly-PDF-format footer regexes. `IMPORT.md` issue #5 documents this only for the legacy stripper and calls it a known limitation; it was silently copy-pasted into the monthly-format code path too. Any Kotak statement from a different account holder will fail to strip footers and risks the exact "missing ~1 transaction per page" bug that issue #1 fixed for the original account holder.
4. **Kotak "monthly" PDF format is undocumented** — `IMPORT.md`'s Kotak PDF section only describes the legacy "Account Statement" chunking strategy. The actual code (`kotak-pdf.ts`, `kotak-shared.ts`) has a second, structurally different parser (`isKotakMonthlyPdf` / `parseKotakMonthlyPdf`) for a different statement layout (signed amounts, per-transaction timestamps, reverse-chronological row order requiring an explicit `.reverse()`), fully covered by 3 of the 6 test cases in `kotak-pdf.test.ts` but absent from the runbook.
5. **Dead code**: `src/lib/server/csv.ts`'s `parseCsv` export is never imported anywhere in the app (confirmed via grep) and uses a naive `split(",")` with no quote-awareness — a landmine if anyone wires it up later, since the actually-used parser (`csv-parse.ts`'s `parseCsvRows`) is RFC4180-aware.
6. **`import-report.ts` hardcodes `formatMoney(amountMinor, "INR")`** for the downloadable import-issue report — a non-INR account's import report would show amounts with a ₹ symbol regardless of the account's actual currency.
7. **Refund/split-return and "bill" categorization are both purely category-**name**-based** (string match against `"Refund"`/`"Split Return"`/`/\bbill\b/i`), not a schema flag. Renaming a category breaks refund-link validation and bill-widget grouping silently (no error, just quietly stops matching).
8. **`finance_categories.parent_category_id` has no DB-level foreign key**, unlike every other relationship in the schema, and no current app code path actually writes to it — it's schema-only, unused, and unconstrained today.
9. **Import loop is unbatched and untransacted** — `importTransactionRows`'s per-row `await db.insert(...)` inside a `for` loop means large statements take many sequential round-trips and a mid-import crash leaves a partial, uncommitted-as-a-unit import in the table (no wrapping `db.transaction()`).
10. **Amount-substring search false positives** — `transaction-search.ts`'s digit-substring fallback (`cast(amount_minor as text) ilike '%digits%'`) can match unrelated amounts whose minor-unit integer happens to contain the searched digits as a substring (e.g. searching `"500"` matches ₹1,500.50 = `150050`).
11. **Two independent, disagreeing default-currency sources**: DB column default `"USD"`, Zod schema default `"USD"`, auto-provisioning default `"INR"` — see §4.
12. **`svelte-adapter-bun` is used, but `@sveltejs/adapter-auto` is still listed as a devDependency** in `package.json` — harmless (unused), but dead weight / possible confusion for anyone reading the dependency list expecting it to be load-bearing.
13. **Leftover `/sample` redirect** in `hooks.server.ts` — looks like unremoved starter-template scaffolding (redirects any `/sample*` path to `/app`), not referenced anywhere else in the app.

---

## Part C — Contradictions with `_bmad-output/chhan-chhan/planning-artifacts/*`

Every planning-artifact doc under `_bmad-output/chhan-chhan/planning-artifacts/` (dated 2026-08-23) was cross-checked line-by-line against the current source. Findings:

1. **`api-contracts.md` incorrectly documents `budgets/[budgetId]` and `goals/[goalId]` as `PATCH/DELETE`.** Direct read of both route files (`src/routes/api/accounts/[accountId]/budgets/[budgetId]/+server.ts` and the `goals` equivalent) shows **only `PATCH` is exported**; a repo-wide grep for `export async function DELETE` under both directories returns zero matches. **This is a genuine documentation/code mismatch** — either the doc was aspirational (written before/alongside implementation and never reconciled) or a `DELETE` handler was planned and never shipped. Recommend either adding the `DELETE` routes (consistent with every other resource in the API, which does have delete/detach handlers) or correcting the doc.

2. **`IMPORT.md`'s Kotak PDF section is incomplete relative to the code.** It documents only the "legacy" Account-Statement chunking strategy (issues #1/#2/#5 are all framed around this format). The code has a second, fully-implemented and tested "monthly" PDF format (`isKotakMonthlyPdf`, `parseKotakMonthlyPdf`, `stripKotakMonthlyPdfChunkFooter`) that IMPORT.md never mentions. This isn't a factual error in what IMPORT.md says (everything it says about the legacy format is accurate), but it's a coverage gap for anyone using IMPORT.md as the sole source of truth for how Kotak imports work — they would not know a second format exists, nor that the "MUKUL SINGH" hardcoding limitation (documented for the legacy stripper) also applies to the monthly stripper.

3. **Everything else checked out as accurate, including several docs that *already* correctly flag things this deep-dive independently rediscovered:**
   - `project-context.md`'s "Multi-account (planned)" section already correctly states the MVP is in draft and unimplemented, and that "UI still uses `getOrCreateDefaultAccount()` (first membership by name)" — this deep-dive's §5 independently confirms this is exactly right, down to the alphabetical-ordering detail.
   - `architecture-multi-account.md` (draft) proposes the `resolveActiveAccount`/cookie fix specifically *because* the current `getOrCreateDefaultAccount`-everywhere pattern (which this deep-dive also flagged as gotcha #2) is fragile — the plan and the current-state critique are consistent, not contradictory.
   - `data-models.md`'s cascade description ("Deleting a transaction cascades tag, group, and refund-link rows") matches the schema exactly.
   - `component-inventory.md` / `source-tree-analysis.md` / `architecture.md`'s high-level pipeline diagrams, authz-helper table, and balance-model description all match the code exactly (verified against `authz.ts`, `import.ts`, `balance.ts`, `finance.ts`'s `getCurrentBalance`).
   - `FUTURE-TODO.md`'s checked (`[x]`) items are all genuinely implemented; every unchecked item spot-checked in this deep-dive is genuinely still absent.

---

## Part B — Routes / feature UI

# Chhan Chhan — Routes + Feature UI Deep Dive

**App:** `apps/chhan-chhan` (SvelteKit 2 / Svelte 5, port 3005, auth-backed)
**Scope:** every file under `src/routes/**/*.svelte`, `**/+page.server.ts`, `**/+layout*.{ts,svelte}`, and `src/lib/components/**` (excluding `ui/` — there is none in this app; see §7). API route handlers (`src/routes/api/**/+server.ts`) were read only enough to identify endpoints called from the UI; their internals are out of scope.
**Method:** every in-scope file was opened and read in full (line-numbered) before being cataloged below. Total in-scope LOC: **7,612** across **32 files** (19 route files + 13 feature components).

---

## 1. Route Map

| URL | Route source | Auth | Purpose |
|---|---|---|---|
| `/` | `routes/+page.svelte` + `+page.server.ts` | none (redirect) | Stub page; server `load` immediately `redirect(307, "/app")`. The rendered markup ("Redirecting…") is a no-op fallback for the instant before redirect fires. |
| `/login` | `routes/(auth)/login/+page.svelte` | public | Email or username + password sign-in via `better-auth` client. Handles "email not verified" (403) with inline resend action. |
| `/sign-up` | `routes/(auth)/sign-up/+page.svelte` | public | Registration form (name, email, username, password + confirm) with client-side strong-password regex. |
| `/forgot-password` | `routes/(auth)/forgot-password/+page.svelte` | public | Posts to `auth-service` `/forgot-password` REST endpoint directly (not via `authClient` helper). |
| `/reset-password?token=…` | `routes/(auth)/reset-password/+page.svelte` | public | Consumes a reset token from the query string; posts new password to `auth-service` `/reset-password`. Renders 3 mutually exclusive states: invalid/expired token, success, or the form. |
| `/check-email?type=&email=&reason=` | `routes/(auth)/check-email/+page.svelte` | public | Generic "check your inbox" interstitial reused by sign-up, resend, and forgot-password flows; branches copy on `type`/`reason` query params. |
| `/verify-email?error=` | `routes/(auth)/verify-email/+page.svelte` | public | Landing page for the email-verification link; shows success or a mapped error message (expired/invalid/used/etc.). |
| `/app` | `routes/(protected)/app/+page.svelte` + `+page.server.ts` | **protected** (redirects to `/login` in parent layout if no `locals.user`) | The **ledger / transaction table** — the largest and most interactive page in the app (2,446 LOC). Filtering, infinite scroll, inline edit of category/tags/notes/groups, smart categorize/tag bulk-apply, refund-link mode, calculate (sum) mode. |
| `/app/control` | `routes/(protected)/app/control/+page.svelte` + `+page.server.ts` | protected | **Control center**: statement import, currency + opening-balance settings, CSV export link, danger-zone "clear all transactions," and CRUD for categories / tags / groups. |
| `/app/dashboards` | `routes/(protected)/app/dashboards/+page.svelte` + `+page.server.ts` | protected | **Dashboards**: configurable widget grid (summary, spend-by-category/tag/merchant/group, monthly/category trend charts, income-vs-expense, budgets, goals, monthly/yearly bills). |
| `/api/accounts/[accountId]/...` | `routes/api/**/+server.ts` (18 endpoint files) | protected (server-side membership check) | REST-ish JSON/CSV API consumed by the client components above (transactions CRUD, tags, groups, refund-links, smart-categorize, smart-tag, import, import/stream (SSE), export, budgets, goals, categories, analytics). Not deep-dived (out of scope) but referenced throughout §2–4. |
| `/health` | `routes/health/+server.ts` | none | Trivial healthcheck endpoint (not a page). |

**Layout chain:** `+layout.svelte` (root, imports `app.css`, subscribes to the auth session) → either `(auth)/+layout.svelte` (centered two-pane auth card shell) **or** `(protected)/app/+layout.svelte` (the "forge" app chrome: beta banner + `<main class="content">`), gated by `(protected)/app/+layout.server.ts` which redirects unauthenticated users to `/login` and resolves the user's finance account via `getOrCreateDefaultAccount`.

---

## 2. File-by-File Catalog

### 2.1 Root & Top-Level Layout Routes

#### `src/routes/+page.svelte` — 1 LOC
- **Purpose:** Placeholder markup shown for the instant before the server redirect in the sibling `+page.server.ts` resolves.
- **Props/state:** none.
- **API calls:** none.
- **Patterns:** trivial static markup, no `<script>`.
- **Contributor note:** don't add logic here — this file never really "runs" client-side because SvelteKit's server `load` redirects before the page renders on first navigation; it only flashes on slow/JS-disabled loads.
- **Risks:** none.

#### `src/routes/+page.server.ts` — 7 LOC
- **Purpose:** Unconditional `redirect(307, "/app")`. Comment clarifies `/` is not a real page.
- **API calls:** none (pure SvelteKit `redirect`).
- **Patterns:** minimal `PageServerLoad`.
- **Contributor note:** if a public marketing/landing page is ever wanted at `/`, this is the file to change — currently there's no way to visit `/` without being bounced.
- **Risks:** none.

#### `src/routes/+layout.server.ts` — 13 LOC
- **Purpose:** Root layout data — projects `locals.user` (set by hooks, presumably from `@pocket-dimension/auth`) into `{ id, email, username } | null` for `+layout.svelte`/children.
- **API calls:** none (reads `locals` populated by server hooks, not shown here).
- **Patterns:** standard `LayoutServerLoad`.
- **Contributor note:** this is the *only* place `user` is exposed to the whole app via `PageData`/`LayoutData`; the `(protected)/app` layout does its own separate `locals.user` check rather than trusting this one, so auth is effectively double-checked (see risk below).
- **Risks:** low — redundant-but-harmless duplication of the "is logged in" check between this file and `(protected)/app/+layout.server.ts`.

#### `src/routes/+layout.svelte` — 17 LOC
- **Purpose:** True app root. Imports global `app.css`, and on mount subscribes to `authClient.useSession()` purely to keep the reactive Better Auth session store warm/ticking (the subscription callback is a no-op `() => {}`).
- **Props/state:** `children` (Svelte 5 snippet prop).
- **API calls:** `authClient.useSession()` (client-side, triggers Better Auth's session fetch/poll under the hood).
- **Patterns:** Svelte 5 `$props()` + `{@render children()}`; `onMount` cleanup pattern (`unsubSession()`).
- **Contributor note:** the empty subscriber looks like dead code but is intentional — it forces Better Auth's session store to start its `refetchInterval` polling (configured in `auth-client.ts`) app-wide, otherwise nothing else in the tree calls `useSession()` early enough.
- **Risks:** low. If this file is deleted/simplified, sliding-session refresh could stop firing until a component that calls `useSession()` mounts.

#### `src/routes/(auth)/+layout.svelte` — 18 LOC
- **Purpose:** Shared visual shell for all `(auth)` pages — centered card with a neubrutalist border/shadow and a decorative image panel (`icon.png`) on desktop.
- **Props/state:** `children`.
- **API calls:** none.
- **Patterns:** Svelte 5 snippet children; pure presentational layout, all styling via Tailwind utility classes (no `<style>` block).
- **Contributor note:** the two-column grid (`md:grid-cols-2`) means every `(auth)` child page's markup must tolerate being squeezed into the left half on desktop; check both auth-mobile and 2-col layouts when editing any auth page.
- **Risks:** none.

### 2.2 `(auth)` Route Group — Public Auth Pages

All six pages share a near-identical shape: local `$state` form fields, a `handleSubmit` that either calls `authClient.*` (better-auth svelte client) or hits `auth-service` REST endpoints directly via `fetch(`${PUBLIC_BASE_AUTH_URL}/...`)`, inline error rendering, and hand-rolled `<input>`/`<button>` markup (no shared form component, no `ui/` primitives — see §7). Each page defines its own scoped `<style>`-free Tailwind classes (styling is all utility classes, not global forge tokens).

#### `login/+page.svelte` — 202 LOC
- **Purpose:** Sign-in form with an email/username toggle.
- **Props/state:** `id` (`$props.id()` for unique label `for=` ids), `loginBy` (`"email"|"username"`), `email`, `username`, `password`, `error`, `loading`, `emailNotVerified`, `resendingVerification`.
- **API calls:** `authClient.signIn.email(...)` / `authClient.signIn.username(...)`; on unverified-email path, direct `fetch(PUBLIC_BASE_AUTH_URL + "/send-verification-email")`.
- **Patterns:** derived `redirectTo` from `page.url.searchParams.get("redirect")`; dynamic import of `$env/static/public` inside the resend handler (likely to avoid an eager import cost, though `forgot-password`/`reset-password` import it statically at module scope — inconsistent).
- **Contributor note:** the "email not verified" branch matches on `result.error.status === 403` **or** a case-insensitive substring check on the error message containing both "email" and "verif" — a fragile heuristic tied to Better Auth's current error copy. If Better Auth's message wording changes, this silently stops detecting unverified accounts.
- **Risks:** medium (message-substring auth-state detection); low security risk (client-side only, server still enforces verification).

#### `sign-up/+page.svelte` — 152 LOC
- **Purpose:** Registration form: name, email, username, password + confirm, with a client-side strong-password regex (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/`) duplicated verbatim in `reset-password/+page.svelte`.
- **Props/state:** `id`, `name`, `email`, `username`, `password`, `confirmPassword`, `error`, `loading`.
- **API calls:** `authClient.signUp.email({ email, password, name, username, callbackURL })`.
- **Patterns:** password-confirmation check before hitting the regex check before the network call (fail-fast ordering).
- **Contributor note:** the strong-password regex is copy-pasted between this file and `reset-password/+page.svelte`; a shared `$lib/validation` helper would prevent drift (the server-side `$lib/validation/finance.ts` schemas do not cover auth passwords — that validation lives entirely client-side plus whatever `better-auth`/`auth-service` enforces server-side).
- **Risks:** medium — duplicated regex is a maintenance hazard; no visible server-side mirror of this exact rule in this app (enforcement depends on `auth-service`).

#### `forgot-password/+page.svelte` — 80 LOC
- **Purpose:** Collects an email and POSTs directly to `${PUBLIC_BASE_AUTH_URL}/forgot-password` (bypassing the `authClient` SDK, unlike login/sign-up).
- **Props/state:** `id`, `email`, `error`, `loading`.
- **API calls:** raw `fetch(PUBLIC_BASE_AUTH_URL + "/forgot-password", { redirectTo: origin + "/reset-password" })`.
- **Patterns:** always redirects to `/check-email?type=forgot` even on some failures? No — only on `response.ok`; on failure it surfaces `data.message`.
- **Contributor note:** uses `import { PUBLIC_BASE_AUTH_URL } from "$env/static/public"` at module scope, whereas `login/+page.svelte`'s resend handler dynamically imports the same constant — pick one convention when touching either file.
- **Risks:** low.

#### `reset-password/+page.svelte` — 175 LOC
- **Purpose:** Consumes `?token=` and `?error=` from the URL (the latter presumably set by the `auth-service` redirect on token problems). Renders one of three states: invalid/expired-link message, success message (with a 3s `setTimeout` auto-redirect to `/login`), or the password form.
- **Props/state:** `id`, derived `token`/`errorParam`/`errorMessage`/`hasErrorFromParam`, `password`, `confirmPassword`, `error`, `loading`, `success`.
- **API calls:** raw `fetch(PUBLIC_BASE_AUTH_URL + "/reset-password", { newPassword, token })`.
- **Patterns:** local `getErrorMessage()` maps known error codes (`token_expired`, `token_invalid`, `token_already_used`, `unknown`) to copy — same code-to-copy mapping pattern reused (with a different code set) in `verify-email`.
- **Contributor note:** the strong-password regex is duplicated from `sign-up` (see above). The 3-second `setTimeout` redirect has no cleanup/cancel if the user navigates away manually in that window (harmless since `goto` is idempotent, but a stray timer fires regardless).
- **Risks:** low.

#### `check-email/+page.svelte` — 111 LOC
- **Purpose:** Shared "check your inbox" interstitial for three flows (`type=signup|resend|forgot`), plus a `reason=verify` override used when a protected action redirects here because the account isn't verified yet.
- **Props/state:** derived `type`/`email`/`reason` from query string; `resending`, `resendSuccess`, `resendError`.
- **API calls:** `fetch(PUBLIC_BASE_AUTH_URL + "/send-verification-email")` (same endpoint as the login page's resend path, called from a different UI).
- **Patterns:** two `$derived.by(...)` blocks (`title`, `description`) doing manual branching instead of a lookup table.
- **Contributor note:** this page's copy logic and the login page's resend logic are independent implementations of "resend verification email" — a bug fix in one will not propagate to the other.
- **Risks:** low.

#### `verify-email/+page.svelte` — 72 LOC
- **Purpose:** Landing page after clicking the emailed verification link. No token is read here (that's handled server-side by `auth-service` before redirecting here); this page only reacts to an `?error=` code.
- **Props/state:** derived `error`, `errorMessage`, `hasError`.
- **API calls:** none — pure client-side branching + `goto()` navigation buttons.
- **Patterns:** same `getErrorMessage()` code-to-copy mapping style as `reset-password`, with a different error-code vocabulary (`user_not_found`, `email_already_verified`, etc.) — a third independent copy of this pattern.
- **Contributor note:** three files (`reset-password`, `verify-email`, and implicitly `check-email`) each hand-roll their own error-code → copy map. A shared `$lib/auth-errors.ts` would remove duplication and the risk of divergent wording for the same underlying error codes.
- **Risks:** low.

### 2.3 `(protected)/app` Route Group — Ledger, Control, Dashboards

#### `+layout.server.ts` — 13 LOC
- **Purpose:** Guard + account resolution for **all** of `/app*`. If `locals.user?.id` is missing, `redirect(307, "/login")`. Otherwise calls `getOrCreateDefaultAccount(locals.user.id)` and returns `{ account }` for every child page's `parent()`.
- **API calls (via `$lib/server/finance`):** `getOrCreateDefaultAccount(userId)` — looks up `listAccountsForUser(userId)` (a join through `financeAccountMembers` → `financeAccounts`) and returns the first membership, or creates a new `"Personal"` / `INR` / `Asia/Kolkata` account if the user has none.
- **Patterns:** single source of truth for "which account is active" — every downstream page/action calls `parent()` to get `account` rather than re-resolving it (except the control-page *actions*, which re-derive it themselves — see risk below).
- **Contributor note / risk (important — "account switching"):** the DB schema (`financeAccountMembers`, `accountMemberRole` enum with `owner`/`editor`/`viewer`) is clearly built for **multi-account, multi-user shared accounts** — `getMembershipOrThrow` + `canEdit(role)` in `$lib/server/authz.ts` implement per-account role checks. **However, there is no account-switcher UI anywhere in the app.** `getOrCreateDefaultAccount` unconditionally takes `accounts[0]`; there is no route, component, or dropdown that lets a user pick among multiple accounts/households they may belong to. This is a real gap between backend capability and frontend UX — worth flagging before building any "shared household" or "invite a member" feature, since the UI currently assumes exactly one account per user.
- **Risks:** medium (see above — silent single-account assumption baked into every page).

#### `+layout.svelte` — 15 LOC
- **Purpose:** The actual "app chrome" wrapper: applies `.forge .forge-shell` classes (global design-system classes from `$lib/styles/forge.css`, imported once via `app.css`), renders `<BetaBanner />` unless `dev` is true, then `{@render children()}`.
- **Props/state:** `children`; imports `dev` from `$app/environment`.
- **API calls:** none.
- **Patterns:** global-class + component composition; the beta banner is suppressed only in local dev (`!dev`), so it always shows in preview/production builds regardless of actual release stage — there's no separate "beta" env flag.
- **Contributor note:** all of the shared "chrome" styling (topbar, stat cards, table, panels, meters — see §6 CSS token audit) lives in `forge.css` as **global**, unscoped classes (`.forge .topbar`, `.forge .stat`, etc.), while each page adds page-specific rules in its own **scoped** `<style>` block. Contributors must know both files exist and which one owns a given class before editing visual chrome.
- **Risks:** low.

#### `+page.server.ts` (ledger `/app`) — 133 LOC
- **Purpose:** Loads everything the transaction table needs: paginated transactions (first page, 50 rows), full category/tag/group lists (for filters and inline pickers), analytics (budget usage), transaction summary (income/expense/net for the selected period), current balance, and category-spend breakdown for the meter row.
- **Query params consumed:** `sort`, `summary`, `month`, `year`, `type`, `group`, `category` (multi via `parseMultiFilterParam`), `tag` (multi), `search`, `link` (refund-cluster filter).
- **API calls (server-side, via `$lib/server/finance`):** `listTransactionPeriods`, `listGroups`, `listCategories`, `listTags`, `getRefundLinkClusterIds` (only when `link` param present), `listTransactions` (paginated, filtered), `getAnalytics`, `getTransactionSummary`, `getCurrentBalance`, `getCategorySpend` — the last five run via `Promise.all` for parallelism.
- **Patterns:** validates every filter param against the DB-loaded option lists before using it (e.g., `selectedGroupId` only kept if `groups.some(g => g.id === groupParam)`) — defensive against stale/forged query strings; `meterRows` logic picks category-spend-vs-budget-usage as the meter-row source depending on whether any filter (search/category/tag) is active, so the top-of-page meters context-switch based on filter state.
- **Contributor note:** `budgetUsage`/`categorySpend` here compute their own ad-hoc percentage + hardcoded 5-color palette (`["#bd93f9","#50fa7b","#54dbee","#ee7c02","#ffb86c"]`) inline, duplicating the same array (`METER_COLORS`) that already exists as an exported constant in `$lib/finance/dashboard-widgets.ts` and is used by the dashboards loader via `toSpendMeters`/`toBudgetMeters`. This ledger page does **not** use those shared helpers, so any change to meter-color logic must be made in two places.
- **Risks:** medium — the color-array duplication is a real drift risk between `/app` and `/app/dashboards`.

#### `+page.svelte` (ledger `/app`) — 2,446 LOC — *largest file in the app*
- **Purpose:** The core transaction ledger: infinite-scrolling table with inline editing of category, tags, notes, and group membership; multi-dimension filtering (type, group, category, tag, free-text search, refund-link cluster); "smart categorize"/"smart tag" bulk-apply-to-similar-merchants flows; a keyboard-driven "calculate mode" (Ctrl/Cmd+X) for ad-hoc sum-of-selected-rows; and a "refund link mode" for manually pairing expense/refund transactions.
- **Props:** `data: PageData` (from the server load above).
- **State (Svelte 5 runes, ~25 top-level `$state`s):**
  - `rows` — client-side mutable copy of `data.transactions`, re-seeded by an `$effect` whenever `data` changes (i.e., on every `goto(...)`-triggered reload); this is what infinite scroll appends to and what optimistic edits mutate directly.
  - `pageIndex`, `loading`, `hasMore` — infinite-scroll pagination state.
  - `searchInput` + debounced `searchTimer` (300 ms) — decoupled from `data.searchQuery` so typing doesn't refetch on every keystroke.
  - Per-row popover/edit state tracked by **transaction id**, not a nested per-row store: `savingCategoryId`, `savingNotesId`, `savingTagTxId`, `openTagMenuTxId`, `savingGroupTxId`, `savingGroupHiddenId`, `openGroupTxId`, `openNoteTxId` + `noteDraft` (single shared draft buffer, only one note editor open at a time), `savingRefundLinkId`.
  - Modal/bulk-flow state: `smartCatOpen/Applying/Preview/Toggles/Context`, `smartTagOpen/Applying/Mode/Preview/Toggles/Context` (mirrored shapes for the two "smart" popups).
  - Mode state: `refundLinkModeAnchorId`, `calculateModeActive`, `calculateSelectionIds`.
- **API calls (all client-side `fetch` to `/api/accounts/{accountId}/...`):**
  - `GET .../transactions?...` (via `transactionQueryParams()` + `loadMore()`) — infinite scroll page fetch.
  - `PATCH .../transactions/{id}` — category and notes updates.
  - `GET .../transactions/smart-categorize?...` — fetch a categorization preview (exact/fuzzy merchant matches) before showing the bulk-apply popup.
  - `POST .../transactions/smart-categorize` — apply bulk categorization migrations.
  - `POST/DELETE .../transactions/{id}/tags[/{tagId}]` — add/remove a tag.
  - `GET .../transactions/smart-tag?...` / `POST .../transactions/smart-tag` — tag-equivalent of the smart-categorize flow, with an extra `append`/`replace` mode toggle.
  - `POST/DELETE .../transactions/{id}/groups[/{groupId}]` — set/clear group membership (implemented as delete-all-then-add-one, since a transaction can only show one primary group in this UI even though the API models it as a list).
  - `PATCH .../transactions/{id}/groups/{groupId}` — toggle a per-group "hidden" flag on a transaction.
  - `POST/DELETE .../transactions/{id}/refund-links[/{expenseTransactionId}]` — attach/detach a refund↔expense link.
- **Patterns:**
  - **Optimistic UI everywhere:** every mutation updates local `rows` immediately (`applyCategoryToRows`, `applyTagToRows`, direct `rows = rows.map(...)`) and only some paths (`toggleGroupHidden`) additionally call `invalidateAll()` to resync with the server; most do not, so `rows` can drift from server truth until the next filter change re-seeds it from `data`.
  - **URL-as-state-container:** filters, sort, and summary period are all encoded into the URL via a single `appUrl(updates)` builder and applied with `goto(url, { keepFocus, noScroll, invalidateAll: true })` — there is no separate client store for filter state; the server `load` is the single source of truth for "what's currently filtered," and the client only holds ephemeral UI state (open popovers, in-flight saves, the ledger row cache for infinite scroll).
  - **Manual "modal manager" via mutually-exclusive mode flags:** `enterCalculateMode()` explicitly tears down every other transient UI state (`exitRefundLinkMode()`, `openNoteTxId = null`, `openGroupTxId = null`, `openTagMenuTxId = null`, closes both smart popups) before activating; `enterRefundLinkMode()` does the mirrored teardown. This hand-rolled mutual exclusion (instead of a single `activePanel` discriminated union) is repeated logic that must be kept in sync any time a new transient mode is added.
  - Global `window` event listeners (`pointerdown`, `keydown`, `resize`, `scroll`) are added/removed inside `$effect`s keyed on the relevant open/mode flag — a recurring pattern also seen in `filter-multiselect.svelte`, `app-settings.svelte`, and `dashboard-widget-picker.svelte` (outside-click-to-close, Escape-to-close).
  - A single global `keydown` listener implements the `Ctrl/Cmd+X` calculate-mode shortcut, guarded by `event.target.closest("input, textarea, select")` to avoid hijacking form fields.
  - "Smart" categorize/tag flows follow an identical two-phase shape: (1) optimistically apply the single-row change and fire a `GET` to preview fuzzy/exact merchant matches; (2) if the preview has candidates, open a popup (`SmartCategorizePopup`/`SmartTagPopup`) letting the user select which similar transactions to bulk-migrate, then `POST` the migration and reconcile `rows` client-side by re-testing which rows match the applied migrations (`rowMatchesTagMigration`, inline merchant-normalization via `.trim().toLowerCase()` — note: **not** using the more robust `$lib/finance/merchant-match.ts` fuzzy/normalize helpers here, those live server-side).
- **Contributor note:** this file is a strong candidate for decomposition. It currently owns: URL/query building, infinite scroll, four independent "popover" subsystems (notes, group-link, tag-add, refund-link preview), two full bulk-edit modal flows, a calculate-mode overlay, and ~800 lines of scoped CSS for all of the above. Any of the "mode" or "popover" concerns could be extracted into their own component + a shared row-action composable, but currently everything shares one flat closure over `rows`/`data`, which is *why* it hasn't been split — extraction would require deciding on a state-sharing strategy (context, callbacks, or a small store) first.
- **Risks:**
  - **High complexity / low test coverage risk:** 2,446 LOC, no automated tests reference this file (per AGENTS.md, `chhan-chhan` tests live only under `src/lib/importers/`); any regression here is caught only by manual QA.
  - **Optimistic-update/server-truth drift:** many mutation paths update `rows` locally without `invalidateAll()`; if a mutation partially fails server-side (e.g., network blip after the `fetch` resolves `ok` but before a downstream cache invalidation elsewhere), the visible row can silently diverge from the DB until the next full reload.
  - **Merchant matching duplication:** the smart-cat/smart-tag client-side row-matching logic reimplements simple exact-match string comparison rather than reusing `$lib/finance/merchant-match.ts`'s fuzzy logic, meaning the *client's* idea of "which rows match this migration" can disagree with the *server's* idea (which does use the fuzzy matcher) in edge cases with slightly different merchant string casing/whitespace normalization.

#### `control/+page.server.ts` — 416 LOC
- **Purpose:** Server `load` (categories/tags/groups/transaction-count/first-transaction-date/opening-balance/currency list/importer list) plus **10 form actions**: `createCategory`, `updateCategory`, `deleteCategory`, `createTag`, `updateTag`, `deleteTag`, `createGroup`, `updateGroup`, `deleteGroup`, `updateCurrency`, `updateOpeningBalance`, `importStatement`, `clearAllTransactions` (13 actions total).
- **API calls:** all server-side calls into `$lib/server/finance` (CRUD for category/tag/group, `updateAccountCurrency`, `updateAccountOpeningBalance`), `$lib/server/import` (`importTransactionRows`, `resetAccountTransactions`), and `$lib/importers` (`getImporter(id)`, `listImporters()`).
- **Patterns:**
  - **Every single action re-derives the user/account/membership from scratch** (`requireUser(locals)` → `getOrCreateDefaultAccount(user.id)` → `getMembershipOrThrow(user.id, account.id)` → `canEdit(membership.role)` guard) rather than reading `locals`/`parent()` once — this is ~5 lines of boilerplate repeated 13 times. It does mean every action independently enforces the `owner`/`editor`-only edit guard (viewers get `fail(403)`), which is good defense-in-depth but very repetitive.
  - Zod schemas from `$lib/validation/finance.ts` validate every action's `FormData` before touching the DB; `safeParse` failures return `fail(400, { message: ... })` using the first Zod issue's message.
  - `updateOpeningBalance` action first tries a separate `clearAccountOpeningBalanceSchema` (a `{ clear: "1" }` shape) before falling back to the full balance-update schema — two schemas multiplexed over one action based on which fields are present in the submitted form.
  - `importStatement` reads a `File` from `FormData`, dispatches to the matching importer via `getImporter(importerId)`, and returns a rich result object (`accepted`/`skipped`/`rejected` counts + `reportCsv` + `metadata`) — this is the **non-streaming** import action; the ledger's control page actually uses the **streaming** variant (`/api/.../transactions/import/stream`, called from `$lib/import-stream.ts`) for its real submit handler, so this form action may be a fallback/no-JS path or dead code for the primary UI flow (see risk).
- **Contributor note:** because `control/+page.svelte`'s import form uses `onsubmit={submitImport}` with `event.preventDefault()` (i.e., it never actually submits the native form to trigger this `importStatement` action), this server action might only be reachable if JS is disabled — worth confirming with the team whether it's intentionally kept as a progressive-enhancement fallback or is now dead code that duplicates `$lib/server/import`'s logic without the SSE progress reporting.
- **Risks:** medium — the two parallel import code paths (streaming JS-only vs. this non-streaming form action) must both be kept correct if the no-JS path is meant to keep working; if it's actually unreachable, it's untested dead code.

#### `control/+page.svelte` — 946 LOC
- **Purpose:** Renders the Control Center UI: import form (bank picker + file input + client-driven SSE progress bar), account settings (currency select, opening-balance form + clear-balance confirm), CSV export link, danger-zone "clear all transactions" (with a `confirm()` dialog showing the live transaction count), and three near-identical CRUD list sections (Categories, Tags, Groups) each with inline add/edit/delete.
- **Props:** `data: PageData`, `form: ActionData` (SvelteKit's progressive-enhancement form action result).
- **State:** `importing`, `importProgress`, `importStatus`, `importMessage`, `importSuccess`, `importReportCsv` (import flow); `addingCategory`/`editingId`/`savingCategoryId`/`deletingCategoryId` and mirrored triplets for tags (`...TagId`) and groups (`...GroupId`); `savingCurrency`, `savingOpeningBalance`, `clearingOpeningBalance`, `clearingTransactions`.
- **API calls:** `importStatementWithProgress(accountId, formData, onEvent)` from `$lib/import-stream.ts`, which itself streams `POST /api/accounts/{id}/transactions/import/stream` and parses newline-delimited JSON progress events. All other mutations (`?/createCategory`, `?/updateCategory`, etc.) go through native SvelteKit `use:enhance` form actions hitting the server actions cataloged above — **no client-side `fetch` for CRUD**, unlike the ledger page.
- **Patterns:**
  - `use:enhance` is used consistently for every mutating form, each with a small custom callback that toggles a "saving" flag and (for edit forms) closes the inline-edit state only `if (result.type === "success")` — so failed edits leave the edit form open with the error surfaced via the shared `form?.message` flash banner.
  - Client-side SSE-progress import: `submitImport` manually builds `FormData`, calls the streaming helper, and updates `importProgress`/`importStatus` from `handleImportEvent` (percent/label derived by pure functions in `$lib/import-stream.ts`); on completion it calls `formEl.reset()` then `invalidateAll()` to refresh account/transaction-count/etc.
  - Destructive actions (`clearAllTransactions`, "clear opening balance") both wrap their `use:enhance` callback in `confirm(...)` and call `cancel()` if the user declines — a lightweight guard against accidental data loss, using the browser's native `confirm()` rather than a custom modal.
  - Categories/Tags/Groups sections are structurally identical (add form → list → per-row edit-in-place-or-show + delete) but are **not** extracted into a shared component; each is a hand-copied block with the same `editingXId`/`savingXId`/`deletingXId` triad, differing mainly in fields (categories have `kind` + color; tags have color only; groups have neither).
- **Contributor note:** the three CRUD sections (Categories/Tags/Groups) are the single most obvious refactor opportunity in this file — a generic `<CrudList>` component parameterized by field schema would cut ~250 LOC of near-duplicate markup/state and reduce the risk of one section's bug fix not being ported to the other two (e.g., escaping delete-confirmation copy, disabled-state handling).
- **Risks:** low-to-medium — mostly duplication/maintainability, not correctness; the CSV download (`downloadImportReport`) creates and revokes an object URL synchronously which is safe but tightly coupled to browser APIs (no SSR guard needed since it's only called from a click handler).

#### `dashboards/+page.server.ts` — 181 LOC
- **Purpose:** Loads data for every dashboard widget, but **conditionally** — it parses `enabledWidgets` from the `widgets` query param via `parseDashboardWidgets`, then only fires the DB queries needed for currently-enabled widgets (`needsCategorySpend`, `needsMonthlyTrend`, etc., each guarding a `Promise.all` slot with `... : Promise.resolve([])`/`Promise.resolve(null)`).
- **API calls (via `$lib/server/finance`):** `getAnalytics` (only if any summary/budget/goal widget enabled), `getTransactionSummary`, `getCurrentBalance` (always), `getCategorySpend`, `getTagSpend`, `getMerchantSpend`, `getGroupSpend`, `getMonthlyTrend(id, 12)`, `getCategoryTrend(id, 12)`, `getCategoryMerchantBills`, `getCategoryMerchantBillsForYear`, plus `listTransactionPeriods`.
- **Patterns:** this is the app's clearest example of **query-cost-aware conditional loading** — unlike the ledger loader (which always fetches everything it might need), the dashboards loader treats each widget as an independently toggleable data dependency, computed once via `isDashboardWidgetEnabled(enabledWidgets, id)` booleans, then fanned into one big `Promise.all`. It reuses the shared `$lib/finance/dashboard-widgets.ts` helpers (`toSpendMeters`, `toBudgetMeters`, `toGoalMeters`, `buildCategoryTrendChart`) that the ledger loader does **not** use (see the color-duplication risk noted under `/app`'s server load).
- **Contributor note:** if a new widget is added to `DASHBOARD_WIDGET_CATALOG` in `$lib/finance/dashboard-widgets.ts`, this file needs a matching `needsX` flag + `Promise.all` slot + return-object field, and `dashboards/+page.svelte` needs a matching `showXRow`/render block — three coordinated edits across two files with no shared registry enforcing completeness.
- **Risks:** low — well-structured, but the manual three-way sync (catalog → server load → client render) for adding a widget is easy to get partially wrong (e.g., forgetting to gate a heavy query behind its `needs*` flag, silently always fetching it).

#### `dashboards/+page.svelte` — 685 LOC
- **Purpose:** Renders the configurable dashboard grid: balance card, period-scoped summary stats (Net/In/Out/Saved, each also a link into the filtered ledger via `transactionsUrl()`), then five conditionally-rendered `.dash-grid` sections (Summary, Trends, Spending, Goals, Billing), each gated by a `show*Row` derived boolean and further gated per-widget by `isDashboardWidgetEnabled`.
- **Props:** `data: PageData`.
- **State:** none beyond derived values — this page has **no local mutable widget state**; widget selection lives in the URL (`data.enabledWidgets`) and is persisted to `localStorage` as a convenience default, not as the source of truth.
- **API calls:** none directly — purely a `data`-driven render; navigation-triggering functions (`setSummaryPeriod`, `setSummaryMonth`, `setSummaryYear`, `setEnabledWidgets`) all call `goto(dashboardUrl(...), { invalidateAll: true })` to force a fresh server `load`.
- **Patterns:**
  - **localStorage-as-default, URL-as-truth:** `onMount` checks whether the current URL has an explicit `widgets` param; if not, and a `DASHBOARD_WIDGETS_STORAGE_KEY` value exists in `localStorage` that differs from the server-resolved default, it does a `goto(..., { replaceState: true })` to apply the user's last-remembered widget selection — a one-time reconciliation on load, not a live two-way sync.
  - `DashboardWidgetPicker`'s `onchange` handler writes to `localStorage` **and** navigates, keeping both in lock-step going forward.
  - Every widget section is wrapped in its own `{#if isDashboardWidgetEnabled(...)}` plus an inner empty-state (`{:else if ...}<p class="dim dash-empty">`) — verbose but explicit; no generic "widget renderer" abstraction (each widget is bespoke markup even though the picker treats them uniformly via the catalog).
- **Contributor note:** `transactionsUrl()` and `dashboardUrl()` are independent URL-builders with overlapping logic (both encode `summary`/`month`/`year`) but are not shared with `/app`'s `appUrl()` builder — three near-identical query-string builders exist across `/app` and `/app/dashboards`; a shared `$lib/finance/url-params.ts` helper would remove the duplication (some of the logic already lives in `$lib/finance/summary.ts` as `buildSummarySelection`/`summarySelectionToDateRange`, but the URLSearchParams assembly itself is re-implemented per page).
- **Risks:** low — mostly duplication, not correctness; the widget system is otherwise clean and well-factored relative to the rest of the app.

### 2.4 Feature Components — `src/lib/components/*` (excluding `ui/`, which doesn't exist here — see §7)

All 13 files are flat `.svelte` files directly under `src/lib/components/` (no subfolders). None import from a `components/ui` directory; there is no `bits-ui`/`shadcn` dependency in this app at all (`package.json` has no `bits-ui`, `@lucide/svelte` is the only UI-adjacent dependency, used purely for icons).

| File | LOC | Used by |
|---|---|---|
| `app-nav.svelte` | 21 | `/app`, `/app/dashboards` topbars |
| `app-settings.svelte` | 49 | `/app`, `/app/control`, `/app/dashboards` topbars |
| `beta-banner.svelte` | 34 | `(protected)/app/+layout.svelte` |
| `billing-panel.svelte` | 182 | `/app/dashboards` (monthly + yearly bills widgets) |
| `calculate-widget.svelte` | 135 | `/app` (calculate-mode floating bar) |
| `category-trend-chart.svelte` | 144 | `/app/dashboards` (category-trend widget) |
| `dashboard-widget-picker.svelte` | 221 | `/app/dashboards` topbar |
| `filter-multiselect.svelte` | 256 | `/app` (Categories/Tags filter dropdowns) |
| `income-expense-bars.svelte` | 80 | `/app/dashboards` (income-vs-expense widget) |
| `meter-bar.svelte` | 32 | `/app` (budget meters), `/app/dashboards` (all meter-based widgets) |
| `monthly-trend-chart.svelte` | 130 | `/app/dashboards` (monthly-trend widget) |
| `smart-categorize-popup.svelte` | 277 | `/app` (bulk categorize modal) |
| `smart-tag-popup.svelte` | 368 | `/app` (bulk tag modal) |

#### `app-nav.svelte` — 21 LOC
- **Purpose:** Two-tab nav ("Transactions" / "Dashboards") rendered inside the shared topbar.
- **Props/state:** none (reads `page.url.pathname` from `$app/state` to compute active state).
- **Patterns:** `isActive(href)` special-cases `/app` (exact match) vs. other tabs (`startsWith`) so `/app` doesn't stay "active" while on `/app/dashboards`.
- **Contributor note:** hardcoded 2-tab array; if `/app/control` were ever meant to appear as a top-level tab (it's currently only reachable via the settings menu / "IMPORT" CTA), this is where it would go.
- **Risks:** none.

#### `app-settings.svelte` — 49 LOC
- **Purpose:** Settings gear dropdown (Control-center link + Sign out) shown in every protected page's topbar.
- **State:** `open`, `root` (bound div ref).
- **API calls:** `authClient.signOut()` then `goto("/login")`.
- **Patterns:** outside-pointerdown + Escape-to-close via a `$effect` that only attaches listeners while `open` — this exact idiom (bound root ref + pointerdown/keydown `$effect`) recurs in `filter-multiselect.svelte` and `dashboard-widget-picker.svelte`, but is not extracted into a shared action/hook (SvelteKit does have `$lib/actions/infinite-scroll.ts` as a precedent for extracting such logic into a Svelte `Action`, but this "click outside" pattern hasn't received the same treatment).
- **Contributor note:** a `useClickOutside`-style Svelte action would remove ~10 duplicated lines from each of 3+ components.
- **Risks:** none.

#### `beta-banner.svelte` — 34 LOC
- **Purpose:** Static "Beta — data and features may change" strip, shown app-wide except in `dev` mode.
- **Props/state:** none — pure static markup + scoped CSS.
- **Risks:** none.

#### `billing-panel.svelte` — 182 LOC
- **Purpose:** Renders bill-category spend grouped by category → merchant, with a `mode: "monthly" | "yearly"` prop switching between a simple "N payments" caption (monthly) and a per-month chip grid (yearly).
- **Props:** `categories: BillingCategoryGroup[]`, `currencyCode`, `mode`, `periodLabel`.
- **Patterns:** purely presentational; all data shaping happens server-side in `$lib/finance/billing.ts`'s `buildBillingByCategory`.
- **Contributor note:** `mode === "yearly"` iterates `merchant.months` to render chips but doesn't cap the count — a merchant billed in all 12 months renders 12 chips inline; fine at current scale, worth a `max-height`/scroll wrapper if merchant lists grow.
- **Risks:** none functionally; minor visual overflow risk for merchants with many months of data (no explicit wrap/scroll safeguard beyond `flex-wrap`).

#### `calculate-widget.svelte` — 135 LOC
- **Purpose:** Fixed-position floating bar shown while "calculate mode" is active on `/app`, displaying live `count`/`sum` of selected rows plus Clear/Close controls.
- **Props:** `count`, `sumMinor`, `currencyCode`, `onClear`, `onClose` (callback-prop pattern, no internal state).
- **Patterns:** pure controlled component — all state lives in the parent (`/app/+page.svelte`); `role="status" aria-live="polite"` for accessible live updates of the running total.
- **Risks:** none.

#### `category-trend-chart.svelte` / `monthly-trend-chart.svelte` — 144 / 130 LOC
- **Purpose:** Hand-built CSS bar charts (no charting library dependency) — `monthly-trend-chart` renders paired income/expense bars per month; `category-trend-chart` renders stacked segments (one per category, colored per `chart.categories[].color`) per month.
- **Props:** `rows`/`chart` (pre-shaped by server-side helpers in `$lib/finance/summary.ts`/`dashboard-widgets.ts`), `currencyCode`.
- **Patterns:** both compute bar/segment heights as percentages of a local `maxMinor`/`totalMinor` via `$derived`, with a `Math.max(4, ...)` (or `2` for segments) floor so tiny nonzero values remain visible as a sliver; `role="img" aria-label="..."` used for a11y since these are `<div>`-based charts, not `<svg>`/`<canvas>`.
- **Contributor note:** no charting library (`d3`, `chart.js`, `visx`, etc.) is used anywhere in this app — every chart (these two, `income-expense-bars`, the meter bars) is hand-rolled with flexbox/grid + inline `style="height:X%"`. This keeps the bundle small and the styling fully on-brand, but means any new chart type (e.g., a real time-series line chart, a pie chart) requires writing a new bespoke component from scratch rather than configuring a library.
- **Risks:** none functionally; scaling to a genuinely complex chart (multi-series line, zoomable time range) would likely justify introducing a charting library at that point.

#### `dashboard-widget-picker.svelte` — 221 LOC
- **Purpose:** Popover checklist for enabling/disabling dashboard widgets, grouped by `DashboardWidgetCategory` (Summary/Spending/Trends/Budgets & goals/Billing), with a "Reset" button restoring `DEFAULT_DASHBOARD_WIDGETS`.
- **Props:** `enabledWidgets: DashboardWidgetId[]`, `onchange: (widgets) => void`.
- **State:** `open`, `root` (outside-click ref) — same click-outside/Escape `$effect` pattern as `app-settings.svelte`.
- **Patterns:** `toggleWidget` guarantees at least one widget stays enabled (`next.length ? next : [...DEFAULT_DASHBOARD_WIDGETS]`), preventing an empty dashboard state.
- **Risks:** none.

#### `filter-multiselect.svelte` — 256 LOC
- **Purpose:** Generic multi-select dropdown used for both the Categories and Tags filters on `/app`; positions its panel with `position: fixed` computed manually from `getBoundingClientRect()` (`syncPanelPosition`) rather than relying on CSS anchoring, re-syncing on `resize`/`scroll` (capture phase, so it tracks scrolling in any ancestor container).
- **Props:** `label`, `options: {id,label}[]`, `selected: string[]`, `onchange`.
- **State:** `open`, `root`, `panelStyle` (computed inline style string).
- **Patterns:** manual viewport-clamping (`Math.max(8, Math.min(rect.left, window.innerWidth - 272))`) to keep the panel from overflowing off-screen — a hand-rolled version of what a floating-UI/popover library would otherwise provide. The listener-attach is deferred via `window.setTimeout(attachListeners, 0)` to avoid the same click that opened the panel immediately closing it via the outside-pointerdown handler.
- **Contributor note:** this is the most "reinvented" piece of UI plumbing in the app — positioning, viewport clamping, and open/close lifecycle are all manual. If a second differently-shaped popover with the same needs appears, extracting a shared "anchored popover" primitive (or adopting a lightweight floating-UI dependency) would pay off; currently it's a one-off, general enough to reuse for both filters, but hardcoded pixel constants (`272`, `8`) tie it to its current panel width.
- **Risks:** low — works correctly today but is fragile to future width/layout changes (the `272` magic number must match the panel's actual rendered width or clamping will be slightly wrong).

#### `income-expense-bars.svelte` — 80 LOC
- **Purpose:** Two-row horizontal bar comparison (In vs Out) for the dashboards "income vs expense" widget.
- **Props:** `incomeMinor`, `expenseMinor`, `currencyCode`.
- **Patterns:** `maxMinor = Math.max(incomeMinor, expenseMinor, 1)` avoids div-by-zero when both are 0.
- **Risks:** none.

#### `meter-bar.svelte` — 32 LOC
- **Purpose:** Generic labeled progress-bar row (name, formatted value, percentage fill, optional meta caption) — the single most reused component in the dashboard system (budgets, goals, category/tag/merchant/group spend all render through this).
- **Props:** `name`, `valueLabel`, `pct`, `color`, `meta?`.
- **Patterns:** fully generic/presentational; no internal logic beyond rendering `pct`.
- **Contributor note:** this is the app's best example of a small, well-factored, highly-reused primitive — contrast with the Categories/Tags/Groups CRUD duplication in `control/+page.svelte`.
- **Risks:** none.

#### `smart-categorize-popup.svelte` — 277 LOC
- **Purpose:** Modal shown when changing a transaction's category on a merchant that has other transactions with a different category — offers to bulk-migrate "exact" merchant matches and "fuzzy" (similar-name) merchant matches, each toggleable per category-group via checkboxes.
- **Props:** `open`, `preview: SmartCategorizationPreview | null` (server-shaped: `{ exact, fuzzy[] }`), `applying`, `toggles: SmartCategoryToggle[]`, `onToggle`, `onApplySelected`, `onThisOnly`, `onCancel`.
- **Patterns:** fully controlled component — all toggle state and the preview payload live in the parent (`/app/+page.svelte`); `toggleKey(merchant, categoryId)` builds a composite string key (`"merchant::categoryId"`) used both here and in the parent to correlate checkbox state with toggle entries, since there's no natural unique id for a "merchant + previous category" pairing.
- **Contributor note:** the `toggleKey` composite-string-key convention (also used, with a different serialization, in `smart-tag-popup.svelte`'s `tagProfileKey`) is a lightweight but stringly-typed correlation mechanism; a malformed merchant name containing `::` could theoretically collide with the separator (unlikely in practice given free-text merchant names rarely contain `::`, but not defended against).
- **Risks:** low.

#### `smart-tag-popup.svelte` — 368 LOC — *largest component file*
- **Purpose:** Tag-equivalent of `smart-categorize-popup`, with the added complexity of an `append`/`replace` mode selector (keep existing tags and add the new one, vs. wholesale replace the merchant's tag profile) and per-merchant "tag profiles" (a merchant's current tag *set*, not a single value) used as the correlation key.
- **Props:** `open`, `preview: SmartTaggingPreview | null`, `applying`, `mode: SmartTagApplyMode`, `toggles: SmartTagToggle[]`, `onModeChange`, `onToggle`, `onApplySelected`, `onThisOnly`, `onCancel`.
- **Patterns:** `toggleKey(merchant, fromTagIds)` serializes a *sorted, comma-joined* tag-id array (`fromTagIds?.join(",") ?? "none"`) as part of the correlation key — this must exactly match the sorting/joining done in the parent's `tagProfileKey()`, a second independent implementation of the same "profile key" concept living in two files.
- **Contributor note:** given `smart-categorize-popup.svelte` and `smart-tag-popup.svelte` share ~80% of their layout/CSS (backdrop, dialog shell, section/group/list structure, action footer) with only the per-item content differing, a shared `<SmartMigrationPopup>` layout component (slotting in category-specific vs. tag-specific list items) could cut a large fraction of this file's 368 LOC of near-duplicate styles.
- **Risks:** low-to-medium — the duplicated correlation-key logic (parent vs. popup, and vs. the categorize popup's simpler single-id version) is the main maintainability risk; a mismatch in how either side serializes `fromTagIds` would silently break toggle-state sync (checkboxes not reflecting the right migration group).

---

## 3. Feature Areas Synthesis

### Ledger (`/app`)
The transaction table is the app's center of gravity. It combines: (a) server-driven, URL-encoded filtering/pagination (type, period, group, category, tag, search, refund-link cluster), (b) client-side infinite scroll appending to a locally-mutable `rows` cache, and (c) a dense set of per-row inline editors (category select, tag chips + add-menu, notes popup, group-link popup, refund-link toggle, group-hidden toggle) each with independent open/saving state keyed by transaction id. Two "modes" (calculate, refund-link) temporarily change row click semantics and are mutually exclusive with each other and with any open popover. Two full modal flows (smart-categorize, smart-tag) layer a "did you mean to recategorize/retag every similar transaction?" bulk-edit UX on top of a simple single-row edit.

### Control Center (`/app/control`)
A settings/admin surface, structurally simple (mostly `use:enhance` forms hitting SvelteKit actions) but volume-heavy due to three repeated CRUD sections. It owns account-level configuration (currency, opening balance), the statement-import entry point (with a client-side SSE progress bar via `$lib/import-stream.ts`, backed by a separate streaming API route not covered here), CSV export (a plain `<a href>` link, not a fetch), and a destructive "clear all transactions" action gated by both a role check (`canEdit`) and a native `confirm()` dialog.

### Dashboards (`/app/dashboards`)
A configurable, widget-catalog-driven reporting surface. Widget selection is modeled as a first-class typed enum (`DashboardWidgetId`) with a single catalog (`DASHBOARD_WIDGET_CATALOG`) driving both the picker UI and (via `isDashboardWidgetEnabled` checks in the server loader) which queries actually run — the cleanest example of feature-flag-shaped data fetching in the app. No charting library; every visualization is a hand-built CSS bar/meter component.

### Import UI
Split across two entry points that both ultimately hit the same importer registry (`$lib/importers`, not deep-dived) but via different transport: `control/+page.svelte`'s `submitImport` uses the **streaming** `$lib/import-stream.ts` helper (SSE-style newline-delimited JSON progress events) for the primary JS-enabled UX with a live progress bar; the sibling `+page.server.ts` `importStatement` **form action** implements the same import via a single non-streaming request/response and appears to be unused by the current UI (the form's `onsubmit` calls `event.preventDefault()`), possibly a progressive-enhancement fallback.

### Auth Pages
Six near-identical pages (`login`, `sign-up`, `forgot-password`, `reset-password`, `check-email`, `verify-email`) implementing a full email/username + password flow against `auth-service` (Better Auth), split between using the `authClient` SDK (`login`, `sign-up`) and raw `fetch()` calls to `PUBLIC_BASE_AUTH_URL` REST endpoints (`forgot-password`, `reset-password`, the resend-verification calls in both `login` and `check-email`). Error-code-to-copy mapping is independently reimplemented in three files (`reset-password`, `verify-email`, implicitly `check-email`'s type/reason branching) rather than shared.

---

## 4. Client State / Account Context Patterns

- **No global client store for account/filters.** There is no Svelte store, context, or state-management library (no `svelte/store` usage found in routes/components other than the framework's own `page`/`app/state`). "Which account am I looking at" and "what filters are active" both live server-side, resolved fresh on every navigation via `+layout.server.ts` (`account`) and each page's `+page.server.ts` (filters parsed from `url.searchParams`). The client only ever *reads* `data`/`PageData` and builds new URLs to request different server-computed states.
- **URL is the filter/state container; `goto(..., { invalidateAll: true })` is the "dispatch."** Every filter/sort/period change across `/app` and `/app/dashboards` follows the same shape: build a `URLSearchParams` from current-state-plus-updates, `goto()` to it with `keepFocus`/`noScroll` (to avoid jarring focus/scroll resets on what is UX-wise a "filter," not a "navigation"), and `invalidateAll: true` to force the server `load` to rerun. Each page reimplements its own URL-builder (`appUrl`, `dashboardUrl`, plus a third partial one, `transactionsUrl`, cross-linking dashboards → ledger) rather than sharing one.
- **Local mutable caches for infinite/optimistic data.** `/app`'s `rows` is the one place client state meaningfully diverges from `data`: it's seeded from `data.transactions` on every reload (via `$effect`) but grows via `loadMore()` and is optimistically mutated in place by every inline edit, without a corresponding `data`/URL change. This is the app's only "client owns a copy of server data" pattern; everywhere else, `data` is treated as read-only and re-rendered directly.
- **No account-switching state.** As noted in §2.3 (`+layout.server.ts`), there's no concept of "current account id" that could vary — `account` is resolved once per request from `getOrCreateDefaultAccount` and threaded down via `parent()`. If multi-account support is ever added to the UI, it would need: (a) an account-id route param or a client-side "current account" selection mechanism, (b) a switcher component, and (c) every `$lib/server/finance` call site (currently keyed by a single implicit `account.id`) audited to ensure it takes the *selected* account rather than the *default* one.
- **Popover/modal state is always per-page, never lifted.** Every "is this popover open" flag (`openNoteTxId`, `openGroupTxId`, `openTagMenuTxId`, the `open` flags in `app-settings`/`dashboard-widget-picker`/`filter-multiselect`) is local `$state` in the component/page that owns the trigger, closed via bespoke pointerdown/Escape `$effect`s. There is no shared "popover manager" — this is consistent everywhere but means the same ~15-line pattern is copy-pasted 5+ times across the codebase.

---

## 5. Component Inventory (Feature Components Only)

| Component | Category | Reused across pages? | Notable dependency |
|---|---|---|---|
| `app-nav.svelte` | Navigation | Yes (`/app`, `/app/dashboards`) | `$app/state` |
| `app-settings.svelte` | Navigation / auth | Yes (all 3 protected pages) | `authClient` |
| `beta-banner.svelte` | Chrome | Yes (layout-level, all protected pages) | none |
| `meter-bar.svelte` | Chart primitive | Yes (ledger meters + 5 dashboard widgets) | `$lib/finance` types only |
| `income-expense-bars.svelte` | Chart | Dashboards only | `$lib/finance/money` |
| `monthly-trend-chart.svelte` | Chart | Dashboards only | `$lib/finance/{money,summary}` |
| `category-trend-chart.svelte` | Chart | Dashboards only | `$lib/finance/{money,dashboard-widgets,summary}` |
| `billing-panel.svelte` | Feature panel | Dashboards only (2 widgets: monthly+yearly bills) | `$lib/finance/{money,summary,billing}` |
| `dashboard-widget-picker.svelte` | Control widget | Dashboards only | `$lib/finance/dashboard-widgets` |
| `calculate-widget.svelte` | Feature widget | Ledger only | `$lib/finance/money` |
| `filter-multiselect.svelte` | Form control | Ledger only (Categories + Tags filters, 2 instances) | none (generic) |
| `smart-categorize-popup.svelte` | Modal / bulk-edit | Ledger only | `$lib/server/finance` types |
| `smart-tag-popup.svelte` | Modal / bulk-edit | Ledger only | `$lib/server/finance` types |

**Observation:** only `app-nav`, `app-settings`, `beta-banner`, and `meter-bar` are genuinely cross-page/cross-feature reusable; the remaining 9 are single-feature-area components (7 dashboards-only or ledger-only chart/widget components, 2 ledger-only modals). There is no generic form-input, button, or card primitive component anywhere in `src/lib/components` — every page hand-rolls its own `<input>`/`<button>`/`<select>` markup styled with either global `forge.css` classes or page-scoped `<style>` blocks.

---

## 6. Comparison Notes vs. `watchlist` (auth app pattern reference)

`watchlist` is another auth-backed SvelteKit app in this monorepo (port 3002) that shares the exact same Better Auth integration and, notably, an **almost line-for-line identical** `(auth)/login/+page.svelte` business-logic flow (same state shape, same `signIn.email`/`signIn.username` branching, same 403/"email"+"verif" heuristic for detecting unverified accounts, same resend-verification flow) — strong evidence both apps were bootstrapped from a shared auth-page template. The two apps diverge sharply in presentation layer and design-system maturity:

| Aspect | `chhan-chhan` | `watchlist` |
|---|---|---|
| UI primitives | None — raw `<input>`/`<button>`/`<select>` everywhere, styled via Tailwind utility classes (auth pages) or global `forge.css` classes + scoped `<style>` (protected pages) | Full `bits-ui`/shadcn-style `components/ui/` library: `button`, `input`, `field`, `label`, `select`, `checkbox`, `dialog`, `alert-dialog`, `dropdown-menu`, `data-table`, `table`, `card`, `badge`, `separator`, `sonner` (toast) |
| Design tokens | Custom neubrutalist "forge" theme (`--brand-*`, `--hi-purple/green/cyan`, hard drop-shadows, thick borders, monospace font, CRT-grid background) defined in `app.css`/`forge.css` | Standard shadcn semantic tokens (`bg-destructive`, `text-muted-foreground`, `border`) — conventional, less bespoke |
| Feedback UX | Inline `<p class="flash">` banners, native `confirm()` for destructive actions, no toast system | Has `sonner` (toast) primitive available in `ui/` — likely used for non-blocking notifications instead of (or alongside) inline banners |
| Data tables | Fully hand-rolled `<table>` with manual infinite scroll (`IntersectionObserver` action) and inline editors | Has a dedicated `ui/data-table` + `ui/table` primitive, suggesting a more structured (possibly TanStack-Table-backed) table pattern rather than hand-rolled infinite scroll |
| Component reuse across features | Low — most feature components are single-page-only (§5); no generic CRUD-list/panel primitives despite 3 near-identical CRUD sections in `control/+page.svelte` | Has a `components/dashboard/` folder (feature-grouped, similar to chhan-chhan's flat `components/`) plus the shared `ui/` layer for cross-cutting primitives, giving it a base layer chhan-chhan lacks entirely |
| Auth error-copy handling | Reimplemented independently per page (3 separate code-to-message maps) | Not inspected in depth, but same underlying `authClient`/`auth-service` contract applies — likely faces the same duplication risk unless it has centralized this |

**Takeaway:** `chhan-chhan` intentionally trades a shared component library for a fully bespoke, on-brand visual identity (the "forge" neubrutalist theme would be awkward to express through generic shadcn primitives without heavy customization). The cost is real duplication — both within the app (3 CRUD sections, 2 near-identical smart-popup modals, 3 URL-builder functions, 3 auth-error-copy maps) and relative to `watchlist`'s more conventional, primitive-driven approach. A contributor moving between the two apps should expect **very different component ergonomics** despite near-identical business logic in the auth flow specifically.

---

## 7. `ui/*` Primitive Groups

**`apps/chhan-chhan` has no `src/lib/components/ui/` directory at all** — confirmed via `find` (no matches) and via `package.json` (no `bits-ui` dependency; the only UI-adjacent dependency is `@lucide/svelte` for icons). Every interactive primitive (buttons, inputs, selects, checkboxes, dialogs) in this app is a hand-written native HTML element styled with Tailwind utility classes or the global `forge.css`/scoped-`<style>` system described in §2.3–2.4. This is a deliberate contrast with the rest of the monorepo's SvelteKit apps.

For reference, here is what a `ui/` folder looks like elsewhere in the monorepo (`apps/watchlist/src/lib/components/ui/`, listed by folder only, not read line-by-line per the task scope):

| Folder | Likely purpose (shadcn/bits-ui convention) |
|---|---|
| `alert-dialog/` | Confirmation/destructive-action modal primitive |
| `badge/` | Small status/label chip |
| `button/` | Base button primitive (variants: default/outline/link/etc.) |
| `card/` | Container/panel primitive |
| `checkbox/` | Form checkbox primitive |
| `data-table/` | Structured/sortable table wrapper (likely TanStack Table integration) |
| `dialog/` | Generic modal primitive |
| `dropdown-menu/` | Menu/popover primitive |
| `field/` | Form-field layout wrapper (label + control + description/error) |
| `input/` | Base text input primitive |
| `label/` | Form label primitive |
| `select/` | Dropdown/select primitive |
| `separator/` | Visual divider |
| `sonner/` | Toast notification system |
| `table/` | Base table primitive (likely composed by `data-table/`) |

No other app in the monorepo besides `heimdall` (`apps/heimdall/src/components/ui`, a separate Vite/React app, not SvelteKit) was found with a `ui/` folder during this scan of `apps/*`; `chhan-chhan` and `watchlist` represent the two ends of the "bespoke vs. component-library" spectrum for SvelteKit apps in this repo.

---

## 8. Cross-Cutting Risks & Contributor Notes (Summary)

1. **Account-switching gap (medium):** DB/authz layer supports multi-account membership with roles; UI hardcodes single default account per user with zero switcher affordance (`+layout.server.ts`, §2.3, §4).
2. **Ledger page size/complexity (high):** `app/+page.svelte` at 2,446 LOC is the single largest maintenance risk in this feature area — no automated test coverage, hand-rolled mutual-exclusion "mode" management, optimistic updates that can drift from server truth.
3. **Duplicated meter-color palette (medium):** ledger's `+page.server.ts` hardcodes the same 5-color array that `dashboard-widgets.ts` already exports as `METER_COLORS`, used only by the dashboards loader.
4. **Duplicated correlation-key serialization (low-medium):** smart-categorize/smart-tag popups and their parent each independently implement "merchant + prior-category/tags" composite keys; a mismatch would silently desync checkbox state.
5. **Duplicated URL-builders (low):** `appUrl` (ledger), `dashboardUrl` (dashboards), and `transactionsUrl` (dashboards→ledger cross-link) independently re-encode the same summary/period query params.
6. **Duplicated CRUD sections (low-medium):** Categories/Tags/Groups management in `control/+page.svelte` is copy-pasted three times with only field-shape differences.
7. **Duplicated auth error-copy maps (low):** `reset-password`, `verify-email`, and (implicitly) `check-email` each hand-roll their own error-code → user-facing-message dictionary.
8. **Two import code paths (medium):** a streaming client-driven import (`$lib/import-stream.ts`, actually used) and a non-streaming server form action (`control/+page.server.ts`'s `importStatement`, possibly unreachable given `event.preventDefault()` in the form's submit handler) both exist; worth confirming with the team which is authoritative.
9. **No shared "click outside to close" primitive (low):** the same pointerdown/Escape `$effect` pattern is duplicated across `app-settings`, `dashboard-widget-picker`, and `filter-multiselect` (and, for a subset of the same concern, several popover triggers inside `app/+page.svelte`).
10. **No UI component library (by design, not a bug):** contrasts sharply with `watchlist`'s full shadcn/`bits-ui` primitive set (§6, §7) — intentional trade-off for a bespoke visual identity, but means no cross-app UI-primitive reuse is possible without a larger design-system investment.
