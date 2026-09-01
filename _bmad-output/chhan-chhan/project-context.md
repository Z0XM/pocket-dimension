# chhan-chhan — Project Context (for AI agents)

**Package:** `@pocket-dimension/chhan-chhan`
**Monorepo path:** `apps/chhan-chhan`
**Dev port:** **3005**
**Framework:** SvelteKit 2 (Svelte 5, runes) + `svelte-adapter-bun`
**Auth/DB:** yes — needs PostgreSQL **and** `auth-service` running (see root [`AGENTS.md`](../../AGENTS.md))
**DB schema:** `chhanchhan` (PostgreSQL 18+)

## Before you touch anything

1. **Build shared packages first.** The app imports the built `dist/` of `@pocket-dimension/{auth,db,utils}`, not their source. Run `bun run build` (or `build:shared:*`) before `bun run dev:app:chhan-chhan`, `bun run check`, or any test run.
2. **Start PostgreSQL 18** (`sudo pg_ctlcluster 18 main start`) and run `bun run db:migrate` from repo root — every page under `(protected)/app` queries the `chhanchhan` schema. PG16 fails with `function uuidv7() does not exist`.
3. **Start `auth-service`** (`bun run dev:app:auth`, port 5001) — the entire `(protected)/app` tree requires a session; there is no public/unauthenticated surface in this app besides `/health` and the auth pages themselves.
4. Money is always **minor units** (paise); use `parseIndianAmount`/`formatMoney` from `src/lib/finance/money.ts` — never store or compare major-unit decimals.
5. Mutations follow the triad: `requireUser` → `getMembershipOrThrow` → `canEdit` (owner/editor). Neither `finance.ts` nor `import.ts` check authz themselves — the caller (API route or Control form action) is responsible.
6. BMAD artifacts for this app live only under `_bmad-output/chhan-chhan/` — never under `pocket-dimension/` or `zeo/`. See `_bmad-output/README.md`.

## Where things live (quick map)

- Route handlers for pages: `src/routes/(protected)/app/*`, `src/routes/(auth)/*` — see [source-tree-analysis.md](./source-tree-analysis.md).
- REST API: `src/routes/api/accounts/**/+server.ts` — see [api-contracts.md](./api-contracts.md) before adding/changing an endpoint.
- Auth/session wiring: `src/hooks.server.ts`, `src/app.d.ts`, `src/lib/auth-client.ts`, `src/lib/auth.ts` — see [architecture.md](./architecture.md).
- All finance CRUD + analytics: `src/lib/server/finance.ts` (1,844 LOC, the largest file in the app) — extend this rather than writing a parallel query path.
- Import engine: `src/lib/server/import.ts`; bank parsers: `src/lib/importers/{kotak,icici,hdfc}{,-pdf,-shared}.ts` + `index.ts` registry.
- Zod schemas for every API/action payload: `src/lib/validation/finance.ts`.

## Importers

Registry: `src/lib/importers/index.ts` (`BankImporter`).

| id | Formats |
|----|---------|
| `kotak` | CSV + PDF (2 sub-formats: legacy "Account Statement" and newer "monthly" layout) |
| `icici` | PDF |
| `hdfc` | PDF |
| `generic` | CSV (`ImportRow` columns, **minor units already converted** — unlike the bank importers) |

Operational detail: `apps/chhan-chhan/IMPORT.md`. Deferred PDF edge cases: `implementation-artifacts/deferred-work.md`.

When adding a bank: `{bank}.ts` + `{bank}-pdf.ts` + `{bank}-shared.ts` + tests + register in `index.ts` + IMPORT.md section.

## Control center

- Import (stream), currency, **first transaction date**, **opening balance** set/clear
- Export CSV (always the whole account — ignores filters), categories/tags/groups CRUD
- **Danger zone:** clear all transactions → `resetAccountTransactions` (nulls account balance; keeps category/tag/group definitions)
- **No budgets/goals UI at all** — those resources exist only via direct API calls (list/create/update); see the gotcha below.

## Balance

- Account snapshot: `finance_accounts.balance_minor` / `balance_as_of` (opening balance UI + import sync)
- Txn running balances: `finance_transactions.balance_minor`
- `getCurrentBalance` picks the newest snapshot among account + latest txn balance

## Product surfaces

| Route | Purpose |
|-------|---------|
| `/app` | Ledger + filters + smart cat/tag + refunds |
| `/app/dashboards` | Widgetized analytics (budgets/goals display; Control CRUD still backlog) |
| `/app/control` | Import/export/metadata/opening balance/clear-all |

## Multi-account (planned, not implemented)

MVP planning (PRD + UX + Architecture) is in draft — **not implemented yet**:

- PRD: `planning-artifacts/prds/prd-chhan-multi-account-2026-08-23/`
- UX: `planning-artifacts/ux-designs/ux-chhan-multi-account-2026-08-23/`
- Architecture: `planning-artifacts/architecture-multi-account.md`

Until shipped, **every** page load and **every** Control form action independently calls `getOrCreateDefaultAccount(userId)` — there is no `accountId` in the URL, no cookie, no account switcher anywhere in the UI. DB/API already fully support multiple accounts and multiple members with roles (`GET`/`POST /api/accounts` work today) but nothing in the UI calls them. See the "alphabetical default account" gotcha below for the concrete blast radius of this gap.

## Known gotchas (verified against source, 2026-09-01)

These are real, currently-present issues in `apps/chhan-chhan` — check before assuming otherwise, and update this list if fixed. Full detail and file/line context: [deep-dive-chhan-chhan.md](./deep-dive-chhan-chhan.md) Part B §4, §5, §7.

1. **Currency hardcode: manually-added transactions are always tagged USD.** `createTransaction()` in `src/lib/server/finance.ts` hardcodes `currencyCode: "USD"` unconditionally — it does **not** read the account's actual `currencyCode` the way `importTransactionRows` correctly does (via `getAccountCurrency(accountId)`). On the default auto-provisioned account (`"INR"`), every manually-typed transaction is silently mistagged as USD in the DB. The UI never displays a raw per-transaction currency (it always formats using the *account's* currency), so this is a latent data-integrity bug rather than a visibly broken UI today. There are **three independent, disagreeing default-currency sources** in the codebase: the DB column default (`"USD"`), the Zod `createAccountSchema.currencyCode` default (`"USD"`), and `getOrCreateDefaultAccount`'s auto-provisioning default (`"INR"`).
2. **"Default account" is alphabetically-first-by-name, not primary or first-created.** `getOrCreateDefaultAccount` = `listAccountsForUser(userId)[0]`, and that list is `ORDER BY name ASC`. Every page load (`(protected)/app/+layout.server.ts`) and every one of Control's 13 form actions independently re-resolves this on every request — there is no caching of "which account this session is using." A user who creates or renames a second account to sort earlier alphabetically would find **all** of Control's mutations, including "Clear all transactions," silently start operating on the other account. This is high blast-radius if multi-account UI ever ships without first landing the `resolveActiveAccount` cookie helper the draft architecture doc proposes (`planning-artifacts/architecture-multi-account.md`).
3. **Kotak footer-stripping regexes hardcode a real person's name ("MUKUL SINGH") — in both PDF sub-formats.** `src/lib/importers/kotak-shared.ts`'s two footer strippers (`stripKotakPdfChunkFooter` for the legacy format, `stripKotakMonthlyPdfChunkFooter` for the newer "monthly" format) both match `/\sMUKUL SINGH Account (No\.|Statement)/i`. `IMPORT.md` issue #5 documents this limitation only for the legacy stripper — it was silently copy-pasted into the newer monthly-format code path too, unfixed. Any Kotak statement from a different account holder will fail footer-stripping on **both** formats and risks silently dropping/corrupting the last transaction on every PDF page.
4. **Dead code: `src/lib/server/csv.ts`'s `parseCsv` export is never imported anywhere in the app** (verified via repo-wide grep). It's a naive `split(",")` parser with no quote-awareness, sitting alongside the actually-used, RFC4180-aware `parseCsvRows` in `csv-parse.ts`. If anyone wires `parseCsv` up for a future import path, it will silently corrupt any field containing a comma or newline. Two competing CSV parsers in the same folder is itself a latent confusion risk even before considering the dead one's correctness.
5. **Multi-account UI gap: the data model is fully multi-account/multi-user, the UI is not.** `finance_accounts` ↔ `finance_account_members` (many-to-many, role-gated) and every `/api/accounts/[accountId]/...` route are genuinely account-scoped. But `(protected)/app/+layout.server.ts` is the **only** account-resolution point for the entire `/app`, `/app/dashboards`, and `/app/control` tree, and it always calls `getOrCreateDefaultAccount` — no `accountId` route param, cookie, or switcher exists. `POST /api/accounts` (create) and `GET /api/accounts` (list) are fully functional but are called by **zero** `.svelte` files (verified via grep) — multi-account creation is reachable only via direct API calls today, not through any button in the product. This is the known, already-tracked subject of the draft `architecture-multi-account.md` plan — not a surprise finding, but real until that plan ships.
6. **Planning-doc contradiction: `planning-artifacts/api-contracts.md` incorrectly lists `PATCH/DELETE` for budgets/goals `[id]` routes.** Direct read of `src/routes/api/accounts/[accountId]/budgets/[budgetId]/+server.ts` and the `goals` equivalent, plus a repo-wide grep for `export async function DELETE` under both directories, confirms **only `PATCH` is exported for either resource — there is no `DELETE` route for budgets or goals.** This doc set's [api-contracts.md](./api-contracts.md) reflects the verified, code-accurate contract; treat `planning-artifacts/api-contracts.md`'s DELETE claim as stale/aspirational until a real route ships.
7. **`IMPORT.md`'s Kotak PDF section is incomplete relative to the code (not wrong, just missing coverage).** It documents only the legacy "Account Statement" chunking strategy. The code has a second, fully-implemented and tested "monthly" PDF format (`isKotakMonthlyPdf`/`parseKotakMonthlyPdf`/`stripKotakMonthlyPdfChunkFooter`, signed amounts, per-transaction timestamps, reverse-chronological row order requiring an explicit `.reverse()`) that `IMPORT.md` never mentions — including that the "MUKUL SINGH" hardcode limitation (gotcha #3 above) also applies to it.
8. **Import loop is unbatched and untransacted.** `importTransactionRows`'s per-row `await db.insert(...)` runs inside a plain `for...of` loop with no wrapping `db.transaction()` — a large statement means many sequential DB round-trips, and a mid-import crash leaves a partial import with no rollback.
9. **`import-report.ts` hardcodes `formatMoney(amountMinor, "INR")`** for the downloadable import-issue report — a non-INR account's report shows amounts with a ₹ symbol regardless of the account's actual currency.
10. **Refund/split-return and "bill" categorization are both purely category-name string matches**, not a schema flag (`$lib/finance/refunds.ts`, `$lib/finance/bill-categories.ts`). Renaming a category silently breaks refund-link validation or bill-widget grouping — no error, just quietly stops matching.
11. **`finance_categories.parent_category_id` has no DB-level foreign key** (unlike every other relationship in the schema) and no current app code path writes to it — schema-only, unused, unconstrained.
12. **HDFC/ICICI PDF parsers silently drop rows with `amountMinor <= 0`** with zero reporting beyond the aggregate `rejected`/`skipped` counts — no per-row "PDF parse failed" issue type exists for these regex-non-match cases (only Zod-validation failures get an `ImportIssue`).
13. **Local browser session stickiness.** Better Auth cookies use `secure: true`/`sameSite: "none"` (shared by every app via `@pocket-dimension/auth`). Over plain `http://localhost:3005` the browser may refuse to persist the session, so a logged-in session may not stick across reloads locally. Signup/API calls still succeed; flip `email_verified` directly in the `auth.user` table to test verified-only flows.

## Anti-patterns / things not to repeat

- Don't bypass `requireUser` → `getMembershipOrThrow` → `canEdit` for any new mutation — this triad is re-implemented per-call-site (not centralized in `finance.ts`/`import.ts`), so a new route must include all three explicitly.
- Don't add a second CSV parser — `csv-parse.ts`'s `parseCsvRows` (import) and `csv.ts`'s `toCsv` (export) already cover both directions; `csv.ts`'s `parseCsv` is dead and should not be wired up (see gotcha #4).
- Don't hardcode a currency code in a new write path — read it from `getAccountCurrency(accountId)` the way `importTransactionRows` does; don't repeat `createTransaction()`'s USD-hardcode mistake (gotcha #1).
- Don't call `getOrCreateDefaultAccount` from a *new* code path if you're implementing multi-account UI — wait for (or build) `resolveActiveAccount` per `planning-artifacts/architecture-multi-account.md`; adding more `getOrCreateDefaultAccount` call sites increases the alphabetical-default blast radius (gotcha #2).
- Don't duplicate `METER_COLORS` — it's exported from `$lib/finance/dashboard-widgets.ts`; the ledger's own server load currently hardcodes a copy and should be migrated to the shared constant if touched.
- Don't add refund/bill classification logic anywhere except `$lib/finance/refunds.ts`/`$lib/finance/bill-categories.ts` — both are already fragile (name-string matching); a third independent copy would triple the fragility.

## Where NOT to write docs

Per `_bmad-output/README.md`, app-specific brownfield/product docs for `chhan-chhan` belong in this folder (`_bmad-output/chhan-chhan/`), not a repo-root `docs/` folder. The existing `planning-artifacts/` (product SoR: PRD/architecture/UX for the multi-account MVP, plus the original `document-project` output) and `implementation-artifacts/` (deferred-work notes, feature specs) subfolders are the product's source of record and should not be deleted or restructured — this file and its sibling root docs ([index.md](./index.md), [architecture.md](./architecture.md), [api-contracts.md](./api-contracts.md), [data-models.md](./data-models.md), [development-guide.md](./development-guide.md), [deployment-guide.md](./deployment-guide.md), [source-tree-analysis.md](./source-tree-analysis.md), [component-inventory.md](./component-inventory.md), [project-overview.md](./project-overview.md)) are a code-verified refresh layered alongside them, cross-linking rather than replacing.

## Out of scope for agents unless asked

- Full PRD/epic planning beyond what already exists in `planning-artifacts/`.
- Changing default `_bmad/bmm/config.yaml` away from pocket-dimension without an explicit switch.
