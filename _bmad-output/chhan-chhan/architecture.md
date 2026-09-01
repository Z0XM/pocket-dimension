# Architecture — `chhan-chhan`

## System context

```
Browser ──▶ chhan-chhan (SvelteKit, :3005) ──▶ PostgreSQL (schema `chhanchhan`, + FKs into `auth`)
                    │
                    ├──▶ @pocket-dimension/auth  (session read/verify, via `auth-service` :5001)
                    └──▶ @pocket-dimension/db    (Drizzle schema/client)
```

`auth-service` (Elysia, port 5001) owns all auth mutation endpoints (sign-up, sign-in, verify, reset). `chhan-chhan` never calls `auth.api.*` mutation methods directly — it only reads sessions (`auth.api.getSession`) in `hooks.server.ts` and forwards Better Auth's own routes via `svelteKitHandler`.

## SvelteKit route structure

| Group | Guard (enforced in `hooks.server.ts`) | Routes |
| --- | --- | --- |
| `(auth)/` | If a **verified** session exists, redirect to `/app` (except `verify-email`/`check-email`, which stay reachable while unverified). | `login`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`, `check-email` — plus a shared `(auth)/+layout.svelte` (centered two-pane card). |
| `(protected)/app` | Requires a session (→ `/login?redirect=…` if absent) **and** a verified email (→ `/check-email?reason=verify` if not). Re-checked defense-in-depth in `+layout.server.ts` and `control/+page.server.ts`. | `/app` (ledger), `/app/control` (settings/import/CRUD), `/app/dashboards` (analytics). |
| `api/accounts/` | Per-endpoint: every route requires `requireUser` + `getMembershipOrThrow`; mutating routes additionally require `canEdit`. | 19 route files — see [api-contracts.md](./api-contracts.md). |
| root | No gate. | `/` (redirects to `/app`), `/health` (DB liveness probe, no auth). |

Route-group naming is organizational, not itself the security boundary — the actual authz chokepoints are `hooks.server.ts` (session/verification) and `src/lib/server/authz.ts` (membership/role), described below.

## Auth flow (`src/hooks.server.ts`)

1. **Session read** — `auth.api.getSession({ headers })` runs on every request; if a valid session cookie exists, `event.locals.session`/`event.locals.user` are populated. This is the only place session state enters `locals`.
2. **Legacy redirect** — any `/sample*` path redirects to `/app`. This looks like leftover starter-template scaffolding, not referenced anywhere else in the app; low-risk dead code, flagged for cleanup rather than removed here.
3. **Route-group gating** — `(auth)/*`: verified+logged-in → redirect to `/app`. `(protected)/*`: no session → `/login?redirect=<path>`; session but unverified email → `/check-email?reason=verify`.
4. **Delegate to Better Auth** — `svelteKitHandler({ event, resolve, auth, building })` runs last, handling Better Auth's own internal route surface before `resolve(event)`.
5. **Per-page defense in depth** — `(protected)/app/+layout.server.ts` and `control/+page.server.ts`'s `load` both independently re-check `if (!locals.user?.id) redirect(307, "/login")`, even though `hooks.server.ts` already guarantees this — belt-and-suspenders, not a functional gap.

Client-side, `src/lib/auth-client.ts` creates a `better-auth/svelte` client (`authClient`) with the `usernameClient()` plugin and a 5-minute session refetch interval + refetch-on-focus. `forgot-password`/`reset-password` and the resend-verification actions in `login`/`check-email` bypass the SDK and hit `auth-service`'s REST endpoints with raw `fetch(`${PUBLIC_BASE_AUTH_URL}/...`)` calls instead.

**Cookie caveat:** Better Auth cookies are `secure: true`/`sameSite: "none"`; over plain `http://localhost` the browser may not persist the session, so local manual testing of the login flow can appear to "not stick" even though the underlying signup/verification logic is correct.

## Authorization chokepoint (`src/lib/server/authz.ts`, 25 LOC)

Every mutating API route and every Control form action follows the identical pattern:

```
requireUser(locals)              // 401 if no locals.user.id
  → getMembershipOrThrow(userId, accountId)   // 403 if no financeAccountMembers row
    → canEdit(membership.role)                // true only for "owner" | "editor"
      → validate body (Zod) → mutate
```

- `requireUser` — throws 401 if `locals.user?.id` is missing.
- `getMembershipOrThrow` — queries `financeAccountMembers` for `(accountId, userId)`; throws 403 if no row exists. This is the single chokepoint for account-scoped access; every route and Control action calls it before touching finance data.
- `canEdit(role)` — `role === "owner" || role === "editor"`. `viewer` (and any future role not covered) is implicitly read-only by omission, not an explicit deny-list — safe today since the enum only has three values, but a new role added later would silently become read-only unless this function is updated too.
- **Neither `src/lib/server/finance.ts` nor `src/lib/server/import.ts` check authz themselves** — every one of `finance.ts`'s ~45 exported functions and `import.ts`'s `importTransactionRows`/`resetAccountTransactions` trusts the caller to have already run the triad above.
- **Ownership at creation** — `createAccount(userId, payload)` wraps account creation and the creator's `owner` membership row in a single `db.transaction()`, so an account is never created without an owning member.

## Server-side libs (`src/lib/server/*`)

| File | LOC | Responsibility |
| --- | --- | --- |
| `authz.ts` | 25 | `requireUser`, `getMembershipOrThrow`, `canEdit` — see above. |
| `balance.ts` | 33 | Pure helpers for picking the "latest" balance snapshot from import rows vs. the stored account snapshot (`latestBalanceFromRows`, `isBalanceSnapshotNewer`). |
| `csv-parse.ts` | 59 | RFC4180-aware CSV tokenizer (`parseCsvRows`, `rowsToObjects`) — the parser actually used for **importing** CSVs. |
| `csv.ts` | 35 | A second, simpler CSV module: `toCsv`/`escapeCsv` (used for **exporting**) plus a naive `parseCsv` that is dead code — see [project-context.md](./project-context.md). |
| `http.ts` | 26 | `readJsonBody`/`parseSearch` — Zod-validated request/query parsing, called after authz in every route. |
| `pdf-text.ts` | 7 | `extractPdfText(bytes)` via `unpdf` — merges pages, collapses all whitespace to single spaces. This whitespace-collapsing is load-bearing for every PDF importer's regexes. |
| `import.ts` | 301 | The import engine — see [Importer pipeline](#importer-pipeline) below. |
| `finance.ts` | 1,844 | The single largest file in the app — all CRUD + analytics for accounts, categories, tags, groups, transactions, budgets, goals, refund-links, smart-categorize/smart-tag, and every dashboard aggregate query. ~45 exported functions. |

## Importer pipeline

```
StatementInput { fileName, mimeType, bytes }
  → getImporter(id)                         (src/lib/importers/index.ts registry)
    → BankImporter.parse(input)
        CSV path (Kotak, generic)  |  PDF path (Kotak, ICICI, HDFC)
                                        → extractPdfText(bytes)               [unpdf; merged pages, collapsed whitespace]
                                        → {bank}-shared.ts helpers            [date/merchant/ref parsing, footer stripping, metadata]
                                        → {bank}-pdf.ts                       [regex-chunk by serial+date, strip footers, match trailing amount/balance, derive type]
      → { rows: ImportRow[], metadata }
  → importTransactionRows(userId, accountId, rows, { skipDuplicates, currencyCode, onProgress })   (src/lib/server/import.ts)
      1. Load existing dedup keys for the account (if skipDuplicates)
      2. Per row: Zod-validate (csvImportRowSchema) → dedup-check → insert — sequential, one `await db.insert()` per row, no batching or wrapping db.transaction()
      3. syncImportBalances() — per-row balance backfill + advance the account-level balance snapshot if this file's latest row is newer
  → ImportResult { totalRows, accepted, rejected, skipped, rejectionReasons, issues, reportCsv? }
```

**Per-bank format matrix:**

| Bank | Formats | Type inference | Merchant extractor | External-ref pattern |
| --- | --- | --- | --- | --- |
| Kotak | CSV, PDF (2 sub-formats: legacy "Account Statement" and newer "monthly" layout, dispatched by `isKotakMonthlyPdf`) | CSV: explicit CR/DR column; PDF legacy: balance-delta sign; PDF monthly: explicit `+`/`-` sign | `merchantFromDescription` (`kotak-shared.ts`) — also reused by ICICI | `UPI-`/`IMPS-`/`NEFTINW-`/`ONBF-`/bare 10–15 digits |
| ICICI | PDF only | Balance-delta sign (0/null → `expense`) | Same `merchantFromDescription` as Kotak | 12–15-digit path segment, or `PYTM.../YJP...` tokens |
| HDFC | PDF only | Balance-delta sign vs. opening-balance-seeded running total (0/null → `expense`) | `merchantFromHdfcDescription` (hyphen-delimited UPI/ACH parsing) | 10+ digit Chq./Ref.No. only |
| Generic | CSV only | Explicit `type` column | Explicit `merchant` column (optional) | Explicit `externalRef` column (optional) — amounts are expected **pre-converted to minor units**, unlike the bank importers which convert major→minor via `parseIndianAmount` |

Dedup is bank-agnostic (`src/lib/importers/transaction-dedup.ts` + `import.ts`): prefer `externalRef|date|amount|type`, fall back to `date|amount|merchant|type` when no ref is present. Amount+type stay in the key even when a ref is present because Kotak reuses refs across related legs (deposit + fee, auth + reversal).

**Reset:** `resetAccountTransactions(accountId)` deletes all transactions for an account and nulls the account's balance snapshot — cascades tags/groups/refund-links per FK `onDelete: cascade`, no soft-delete/undo. Wired to Control's "clear all transactions" danger-zone action and the `--reset` flag on `scripts/dedupe-transactions.ts`.

Full operational detail (per-bank strategy, known issues #1–#7, debugging playbook): `apps/chhan-chhan/IMPORT.md`. See [project-context.md](./project-context.md) for gaps found between `IMPORT.md`/code and the real importer behavior.

**Extending with a new bank:** implement `BankImporter` (`id`, `label`, `accept`, `parse`), register in `importers/index.ts`'s `importers` map, and — per the established convention — add `{bank}.ts` + `{bank}-pdf.ts` + `{bank}-shared.ts` + a `.test.ts` file, then document the strategy in `IMPORT.md` (see `implementation-artifacts/spec-hdfc-bank-importer.md` for how this was done for HDFC).

## Money / minor-units conventions

- All monetary amounts (`amount_minor`, `balance_minor`, `limit_minor`, `target_minor`, `current_minor`) are `bigint` columns storing **integer minor units** — never floats or major-unit decimals.
- Canonical helpers live in `src/lib/finance/money.ts`: `parseIndianAmount(raw)` converts an Indian-grouped decimal string (`"2,18,198.00"`) to minor units; `formatMoney(minor, currency)` special-cases `"INR"` with `en-IN` grouping and falls back to `Intl.NumberFormat`'s currency formatter for everything else; `parseSqlMinor` normalizes raw SQL `bigint`/`number`/`string` results to a safe `number`.
- **Sign convention:** `amount_minor` is always stored **positive**; direction is carried entirely by the `type` enum (`expense`/`income`/`transfer`). Aggregate SQL uses `CASE WHEN type = 'income' THEN amount_minor ELSE 0 END`-style conditional sums.
- **Currency-per-transaction is nominally per-row** (`finance_transactions.currency_code`, default `"USD"`) but only the import pipeline threads the account's real currency correctly. See [project-context.md](./project-context.md) for the verified `createTransaction()` USD-hardcode gotcha and the three disagreeing default-currency sources.
- No FX/multi-currency math anywhere — `currencyCode` exists purely for **display formatting**; all dashboard sums add `amount_minor` regardless of currency (safe only because every account is effectively single-currency in practice).

## Multi-account model

The **data model and API already fully support** multiple accounts per user and multiple users per account (`finance_accounts` ↔ `finance_account_members`, many-to-many, role-gated) — every `/api/accounts/[accountId]/...` route is genuinely account-scoped and membership-checked.

**The UI layer is single-account only**, confirmed by reading every load function and form action:

- `(protected)/app/+layout.server.ts` calls `getOrCreateDefaultAccount(locals.user.id)` — the **only** account-resolution call for the entire `/app`, `/app/dashboards`, and `/app/control` page tree. There is no `accountId` route param, cookie, or account switcher.
- `getOrCreateDefaultAccount` → if the user has zero accounts, creates one named `"Personal"` (`currencyCode: "INR"`, `timezone: "Asia/Kolkata"`), making the user its `owner`; if the user already has ≥1 account, it returns `listAccountsForUser(userId)[0]` — a list ordered `ASC(name)`. **"Default account" means "alphabetically first account name," not "first created" or "primary."**
- `control/+page.server.ts`'s 13 form actions **each independently re-call `getOrCreateDefaultAccount(user.id)`** rather than trusting the parent layout's already-resolved `account` — so every Control mutation (including "Clear all transactions") is re-resolved against the alphabetically-first account at the moment the action runs.
- `POST /api/accounts` (create) and `GET /api/accounts` (list) are fully functional but **no UI calls them** — multi-account creation is only reachable via direct API calls today.

This is a **known, already-tracked gap**: `planning-artifacts/architecture-multi-account.md` (status: draft) proposes a `chhan_active_account_id` cookie, a `resolveActiveAccount(userId, cookies)` helper to replace `getOrCreateDefaultAccount` everywhere, and an account-switcher UI. None of that is implemented yet (verified: zero matches for `resolveActiveAccount`/`chhan_active_account_id`/`setActiveAccount` in `src/`). See [project-context.md](./project-context.md) ("Multi-account (planned, not implemented)" section) for the current status.

## Balance model

- **Account snapshot** — `finance_accounts.balance_minor`/`balance_as_of` (nullable), set via Control's opening-balance UI, or advanced by import when a newer balance is found in the imported rows (`syncImportBalances`).
- **Transaction running balance** — `finance_transactions.balance_minor` (nullable), populated from the statement's own running-balance column where the bank format provides one.
- **Current balance** — `getCurrentBalance` picks the newest of the account snapshot vs. the latest transaction's `balance_minor`.

## Dashboard query architecture

`(protected)/app/dashboards/+page.server.ts` is the app's clearest example of query-cost-aware conditional loading: it parses `enabledWidgets` from the `widgets` query param (`parseDashboardWidgets`), then only fires the DB queries a currently-enabled widget needs (`needsCategorySpend ? getCategorySpend(...) : Promise.resolve([])`, etc.), fanned into one `Promise.all`. It reuses `$lib/finance/dashboard-widgets.ts`'s shared helpers (`toSpendMeters`, `toBudgetMeters`, `toGoalMeters`, `buildCategoryTrendChart`, `METER_COLORS`) — the ledger's own server load does **not** reuse these and hardcodes a duplicate 5-color palette (see [project-context.md](./project-context.md)).

Twelve of `finance.ts`'s analytics functions (`getTransactionSummary`, `getCategorySpend`, `getTagSpend`, `getMerchantSpend`, `getGroupSpend`, `getCategoryMerchantBills(ForYear)`, `getMonthlyTrend`, `getCategoryTrend`, `getAnalytics`, `listTransactionPeriods`, `listDistinctMerchantsForType`, `getMerchantCategoryBreakdown`) use raw `sql\`...\`` templates against the **literal schema-qualified table name** (`chhanchhan.finance_transactions`, etc.) rather than the Drizzle schema objects — safe (all values parameterized), but a schema rename would require touching all twelve individually.

## Cross-cutting constraints

- PostgreSQL **18+** required — `id` columns default to `uuidv7()` (`shared/db/src/schema/common.ts`), which only exists in PG18+.
- Apps import the **built** `dist/` of `@pocket-dimension/{auth,db,utils}` — run `bun run build` (or `build:shared:*`) before `dev`/`check`/`build`/tests.
- `vite-kysely-compat.ts` must stay in `apps/chhan-chhan/` (not shared) — it's a Vite plugin shim so `kysely@0.28` still exports symbols `@better-auth/kysely-adapter` expects; the Dockerfile has a fail-fast guard checking `vite.config.ts` still references it.
- `BODY_SIZE_LIMIT` must be raised (e.g. `10M`) for large multi-year PDF statement uploads — the default adapter limit (512K) is too small.
