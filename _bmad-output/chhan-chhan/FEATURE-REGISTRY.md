# Feature Registry — `chhan-chhan`

Brownfield capability inventory for `apps/chhan-chhan`. Derived from deep brownfield + deep-dive 2026-09-01 — see [project-overview.md](./project-overview.md), [architecture.md](./architecture.md).

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Transaction ledger | `/app` | Product | Epic 1 | Live |
| F-2 | Smart categorize / smart tag | `/app` | Product | Epic 1 | Live |
| F-3 | Statement import | `/app/control` | Product | Epic 1 | Live |
| F-4 | Dashboard widgets | `/app/dashboards` | Product | Epic 1 | Live |
| F-5 | Budgets and goals | `/app/dashboards`, API | Product | Epic 1 | Live |
| F-6 | Refund linking | `/app` | Product | Epic 1 | Live |
| F-7 | Control center | `/app/control` | Product | Epic 1 | Live |
| F-8 | Money minor-units model | n/a | Product | Epic 1 | Live |
| F-9 | Account membership authz | n/a | Product | Epic 1 | Live |
| F-10 | Multi-account data model | API / DB | Product | Epic 1 | Partial |
| F-11 | Auth pages | `/login`, `/sign-up`, … | Product | Epic 1 | Live |

## Feature details

### F-1 — Transaction ledger

- **Goal:** Filterable/sortable transaction table as the primary finance surface.
- **Area:** Ledger
- **Includes:**
  - Filters: type, period, category, tag, group, free-text/amount, refund-link cluster
  - Infinite scroll; inline edit of category/tags/notes/group
  - Keyboard-driven calculate mode for summing selected rows
- **Deferred:**
  - None currently.
- **See also:**
  - [architecture.md](./architecture.md), [component-inventory.md](./component-inventory.md)

### F-2 — Smart categorize / smart tag

- **Goal:** Bulk-apply category/tag changes to similar merchant transactions.
- **Area:** Ledger
- **Includes:**
  - Preview other transactions from the same merchant (exact + fuzzy name)
  - Offer bulk-apply on category or tag change
- **Deferred:**
  - None currently.
- **See also:**
  - [project-overview.md](./project-overview.md#core-features)

### F-3 — Statement import

- **Goal:** Import Indian bank statements with dedupe and progress feedback.
- **Area:** Import
- **Includes:**
  - Kotak CSV/PDF, ICICI PDF, HDFC PDF, generic CSV
  - Client-driven NDJSON streaming progress; per-row dedup
  - Downloadable skipped/rejected rows report
- **Deferred:**
  - PDF edge cases catalogued in `implementation-artifacts/deferred-work.md`
  - Documented Kotak “monthly” PDF format contradiction (see project-context gotchas)
- **See also:**
  - [architecture.md](./architecture.md) (importer pipeline), [deep-dive-chhan-chhan.md](./deep-dive-chhan-chhan.md)

### F-4 — Dashboard widgets

- **Goal:** Configurable catalog-driven widget grid for spend summaries and trends.
- **Area:** Analytics
- **Includes:**
  - Summary stats; category/tag/merchant/group spend
  - Monthly/category trends; income-vs-expense; bills breakdown
  - Hand-built CSS bar/meter charts (no charting library)
- **Deferred:**
  - None currently.
- **See also:**
  - [api-contracts.md](./api-contracts.md)

### F-5 — Budgets and goals

- **Goal:** Category/period limits and savings targets surfaced as dashboard meters.
- **Area:** Planning
- **Includes:**
  - List + create via API; meters on dashboards
- **Deferred:**
  - Control UI to manage budgets/goals
  - `DELETE` routes (absent; planning docs contradict — see project-context)
- **See also:**
  - [api-contracts.md](./api-contracts.md), [project-context.md](./project-context.md)

### F-6 — Refund linking

- **Goal:** Pair refund/split-return credits against original expenses.
- **Area:** Ledger
- **Includes:**
  - Refund link mode in the ledger UI
  - Cross-transaction mismatch warnings via connected-components analysis
- **Deferred:**
  - None currently.
- **See also:**
  - [data-models.md](./data-models.md)

### F-7 — Control center

- **Goal:** Account setup, taxonomy CRUD, import, export, and danger-zone clear.
- **Area:** Control
- **Includes:**
  - Statement import; currency; opening balance set/clear
  - CSV export (full account); CRUD for categories/tags/groups
  - Clear-all-transactions danger zone
- **Deferred:**
  - Budgets/goals management UI (see F-5)
- **See also:**
  - [api-contracts.md](./api-contracts.md)

### F-8 — Money minor-units model

- **Goal:** Store all money as integer minor units with explicit transaction type for direction.
- **Area:** Money
- **Includes:**
  - `amount_minor` always positive; type enum expense/income/transfer
  - Helpers in `src/lib/finance/money.ts`
- **Deferred:**
  - Fix verified currency hardcode in `createTransaction()` (project-context gotcha #1)
- **See also:**
  - [project-overview.md](./project-overview.md#money-conventions)

### F-9 — Account membership authz

- **Goal:** Enforce owner/editor write vs viewer read at a single chokepoint.
- **Area:** Permissions
- **Includes:**
  - `requireUser` → `getMembershipOrThrow` → `canEdit` on mutations
  - Roles: `owner` / `editor` / `viewer`
- **Deferred:**
  - UI to invite members or change roles (membership only created as owner today)
- **See also:**
  - [architecture.md](./architecture.md)

### F-10 — Multi-account data model

- **Goal:** Support multiple finance accounts and members in DB/API.
- **Area:** Accounts
- **Includes:**
  - Schema + API fully multi-account with membership roles
- **Deferred:**
  - UI remains single-account (`getOrCreateDefaultAccount`); draft fix in `planning-artifacts/architecture-multi-account.md`
- **See also:**
  - [planning-artifacts/index.md](./planning-artifacts/index.md), [project-context.md](./project-context.md)

### F-11 — Auth pages

- **Goal:** Login, sign-up, password reset, and email verification via shared Better Auth.
- **Area:** Auth
- **Includes:**
  - Email or username login; shared session contract with auth-service
- **Deferred:**
  - Local `http://localhost` session stickiness (shared auth cookie caveat)
- **See also:**
  - `_bmad-output/shared-auth/FEATURE-REGISTRY.md`
