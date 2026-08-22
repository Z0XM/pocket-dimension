# chhan-chhan — Component Inventory

**Date:** 2026-08-23

## Routes (UI)

| Route | Role |
|-------|------|
| `/app` | Transaction ledger + filters + balance card |
| `/app/dashboards` | Widget dashboard + period controls |
| `/app/control` | Import, account/opening balance, export, danger zone, metadata CRUD |
| `(auth)/*` | Login, sign-up, verify, forgot/reset password |

## Shared UI components (`src/lib/components`)

| Component | Role |
|-----------|------|
| `app-nav.svelte` | Primary nav |
| `app-settings.svelte` | Settings menu (links to Control) |
| `filter-multiselect.svelte` | Multi-select filters |
| `dashboard-widget-picker.svelte` | Enable/disable dashboard widgets |
| `income-expense-bars.svelte` / `category-trend-chart.svelte` | Charts |
| `billing-panel.svelte` | Bills-related panel |
| `calculate-widget.svelte` | Sum selected rows |
| `smart-categorize-popup.svelte` / smart-tag | Bulk suggestion UX |

## Domain libraries

| Area | Path | Notes |
|------|------|-------|
| Importers | `src/lib/importers/` | Registry + Kotak/ICICI/HDFC/Generic |
| Finance helpers | `src/lib/finance/` | Money, summary, search, refunds, widgets |
| Server | `src/lib/server/` | CRUD, import, authz, PDF, balance |
| Validation | `src/lib/validation/finance.ts` | Zod |

## Styles

Forge theme: `src/lib/styles/forge.css` (chrome lines, accent buttons, danger styles). Prefer existing `.panel`, `.add`, `.field` patterns on Control.

---

_Generated using BMAD Method `document-project` workflow_
