# Feature Registry — `chhan-chhan`

Brownfield capability inventory for `apps/chhan-chhan`. Classifier model: **Tags + Spaces** (categories/groups/refund-links removed). See [data-models.md](./data-models.md), [project-overview.md](./project-overview.md).

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Transaction ledger | `/app` | Product | Epic 1 | Live |
| F-2 | Smart tag | `/app` | Product | Epic 1 | Live |
| F-3 | Statement import | `/app/control` | Product | Epic 1 | Live |
| F-4 | Dashboard widgets | `/app/dashboards` | Product | Epic 1 | Live |
| F-5 | Budgets and goals | `/app/dashboards`, API | Product | Epic 1 | Live |
| F-6 | Spaces | `/app`, `/app/spaces/[id]`, Control | Product | Epic 1 | Live (settlement) |
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
  - Filters: type, period, tag, space, free-text/amount
  - Infinite scroll; inline edit of tags/notes/spaces
  - Keyboard-driven calculate mode for summing selected rows
- **Deferred:**
  - None currently.
- **See also:**
  - [architecture.md](./architecture.md), [component-inventory.md](./component-inventory.md)

### F-2 — Smart tag

- **Goal:** Bulk-apply tag changes to similar merchant transactions.
- **Area:** Ledger
- **Includes:**
  - Preview other transactions from the same merchant (exact + fuzzy name)
  - Offer bulk-apply on tag change (replace/append)
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
  - Summary stats; tag/merchant/space spend
  - Monthly/tag trends; bills breakdown
  - Hand-built CSS bar/meter charts (no charting library)
- **Deferred:**
  - None currently.
- **See also:**
  - [api-contracts.md](./api-contracts.md)

### F-5 — Budgets and goals

- **Goal:** Tag/period limits and savings targets surfaced as dashboard meters.
- **Area:** Planning
- **Includes:**
  - List + create via API; meters on dashboards; budgets scoped by `tagId`
- **Deferred:**
  - Control UI to manage budgets/goals
  - `DELETE` routes (absent; planning docs contradict — see project-context)
- **See also:**
  - [api-contracts.md](./api-contracts.md), [project-context.md](./project-context.md)

### F-6 — Spaces

- **Goal:** Relationship containers for shared money / linked transactions (replaces refund-links and group-based matching).
- **Area:** Ledger / Control / Space detail
- **Includes:**
  - Space CRUD in Control; attach/detach transactions on the ledger
  - M:N amount allocations (API + settlement UI at `/app/spaces/[spaceId]`); pairs must be income ↔ expense
  - Open remainder meters per transaction; suggested allocation amount
  - Space spend dashboard widget
- **Deferred:**
  - Full mode: named people members, planned items/shares (“who owes whom” people ledger)
- **See also:**
  - [data-models.md](./data-models.md), [api-contracts.md](./api-contracts.md)

### F-7 — Control center

- **Goal:** Account setup, taxonomy CRUD, import, export, and danger-zone clear.
- **Area:** Control
- **Includes:**
  - Statement import; currency; opening balance set/clear
  - CSV export (full account); CRUD for tags/spaces; seed default tags
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
