# Project Overview — `chhan-chhan`

## Purpose

`chhan-chhan` is a personal finance ledger: authenticated users import Indian bank statements (Kotak, ICICI, HDFC PDF/CSV, or a generic CSV format), the app dedupes and categorizes the resulting transactions, and a set of widgetized dashboards summarize spend by category/tag/merchant/group over time. It also supports manual transaction entry, budgets, savings goals, refund-linking (pairing a refund/split-return credit against the original expense), and CSV export. The product is explicitly a personal/household tool — `noindex, nofollow` is set in `app.html`, and the UI is a dark, "forge" neubrutalist theme (thick borders, hard drop-shadows, monospace font) rather than a conventional SaaS look.

## Core features

- **Ledger** (`/app`) — filterable/sortable transaction table (type, period, category, tag, group, free-text/amount search, refund-link cluster), infinite scroll, inline edit of category/tags/notes/group, a keyboard-driven "calculate mode" for summing selected rows, and a "refund link mode" for manually pairing expense/refund transactions.
- **Smart categorize / smart tag** — when a transaction's category or tags change, previews other transactions from the same merchant (exact + fuzzy-name match) and offers to bulk-apply the same change.
- **Statement import** (`/app/control`) — upload a bank statement (Kotak CSV/PDF, ICICI PDF, HDFC PDF, or generic CSV), with a client-driven streaming (NDJSON) progress bar, per-row dedup, and a downloadable "skipped/rejected rows" report.
- **Dashboards** (`/app/dashboards`) — a configurable, catalog-driven widget grid (summary stats, category/tag/merchant/group spend, monthly/category trend charts, income-vs-expense, budget/goal meters, monthly/yearly "bills" breakdown). No charting library — every chart is a hand-built CSS bar/meter component.
- **Budgets and goals** — limits by category/period and savings targets, surfaced as meters on the dashboard; list + create are exposed via the API, but there is **no Control UI to manage them and no `DELETE` route** for either (see [api-contracts.md](./api-contracts.md)).
- **Refund linking** — pairs a "Refund"/"Split Return"-categorized credit transaction against one or more expense transactions, with cross-transaction mismatch warnings computed via connected-components graph analysis.
- **Control center** (`/app/control`) — statement import, account currency, opening balance set/clear, CSV export (full account, unfiltered), and CRUD for categories/tags/groups, plus a danger-zone "clear all transactions" action.
- **Multi-account, multi-user data model** — the schema and API fully support multiple finance accounts per user and multiple members per account with `owner`/`editor`/`viewer` roles, but **the UI is single-account only** today (see [architecture.md](./architecture.md#multi-account-model) and [project-context.md](./project-context.md)); a fix is drafted but unimplemented under `planning-artifacts/architecture-multi-account.md`.
- **Auth pages** — login (email or username), sign-up, forgot/reset password, email verification — the same Better Auth flow shared across the monorepo's auth-backed apps.

## Roles

Three account-membership roles, defined by the `account_member_role` enum and enforced by `canEdit()` (`src/lib/server/authz.ts`): `owner` and `editor` can write; `viewer` is read-only everywhere. There is currently no UI to invite a member to an account or change their role — membership rows are only ever created by `createAccount` (as `owner`), so in practice every account has exactly one member today.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | SvelteKit 2 (Svelte 5, runes), TypeScript |
| Server adapter | `svelte-adapter-bun` |
| Styling | Tailwind CSS v4 + `@tailwindcss/forms`/`typography` + `tw-animate-css`, plus a bespoke "forge" theme (`src/lib/styles/forge.css`) — no UI component library (`bits-ui`/shadcn); every input/button/select is hand-rolled |
| Icons | `@lucide/svelte` |
| PDF text extraction | `unpdf` (`extractPdfText`, whitespace-collapsed, page-merged) |
| Validation | Zod 4 (`src/lib/validation/finance.ts`) |
| Auth | `better-auth` client (`better-auth/svelte`) + `@pocket-dimension/auth` (server, via `auth-service`) |
| Database | `@pocket-dimension/db` (Drizzle ORM over PostgreSQL 18+, schema `chhanchhan`); many dashboard/analytics queries are raw `sql\`...\`` templates rather than the Drizzle query builder |
| Build tool | Vite 7 |
| Runtime | Bun |
| Dev port | **3005** |

## Ports and topology

| App | Port | Depends on |
| --- | --- | --- |
| `chhan-chhan` (this app) | **3005** (dev and prod) | PostgreSQL (`chhanchhan` schema, plus FKs into `auth.user`), `auth-service` on port 5001 |

`chhan-chhan` has no server-rendered dependency on `auth-service` beyond Better Auth's shared session/cookie contract — see [architecture.md](./architecture.md). It shares one PostgreSQL instance with every other auth-backed app in the monorepo, scoped to the `chhanchhan` Postgres schema (plus foreign keys into `auth.user`).

## Money conventions

All monetary amounts are stored as **integer minor units** (e.g. paise for INR) in `bigint` columns — never floats, never major-unit decimals. `amount_minor` is always stored **positive**; sign/direction is carried by the separate `type` enum (`expense`/`income`/`transfer`). Canonical conversion helpers live in `src/lib/finance/money.ts` (`parseIndianAmount`, `formatMoney`, `parseSqlMinor`) — see [project-context.md](./project-context.md) for verified currency-handling gotchas.

## Related docs

- [architecture.md](./architecture.md) — route/auth structure, server libs, importer pipeline, multi-account model, money conventions
- [api-contracts.md](./api-contracts.md) — every `/api/accounts/**` endpoint plus Control's form actions
- [data-models.md](./data-models.md) — `chhanchhan` Postgres schema usage
- [source-tree-analysis.md](./source-tree-analysis.md) — annotated file tree
- [component-inventory.md](./component-inventory.md) — feature component / importer / server-lib catalog
- [development-guide.md](./development-guide.md) / [deployment-guide.md](./deployment-guide.md)
- [project-context.md](./project-context.md) — agent rules and verified gotchas
- [deep-dive-chhan-chhan.md](./deep-dive-chhan-chhan.md) — exhaustive core/server/API/importer file-by-file review (source of most findings in this module)
- [planning-artifacts/index.md](./planning-artifacts/index.md) — existing product SoR (project overview, architecture, API/data docs, and the draft multi-account MVP planning pack)
