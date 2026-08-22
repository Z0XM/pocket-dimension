# Chhan Chhan — Future TODO Plan

Living backlog of feature ideas. Not committed scope — reorder and cut as needed.

---

## Finish what’s already started

Backend or UI scaffolding exists; these are mostly wiring and polish.

- [x] **Clear all transactions** — Control Danger zone; uses `resetAccountTransactions` (balance cleared; categories/tags/groups kept).
- [x] **First transaction date + opening balance** — Control Account panel; opening balance writes `finance_accounts.balance_minor` / `balance_as_of`.
- [ ] **Budgets in Control** — Create, edit, delete budgets (category-linked or overall caps, date range). Dashboard already shows usage.
- [ ] **Goals in Control** — Create, edit, delete savings goals; manual or rule-based progress updates. Dashboard already lists goals.
- [ ] **Group-aware dashboards** — Net/spend by group; compare groups side-by-side. Builds on transaction group filter.
- [ ] **Bulk actions on the table** — Multi-select rows to set category, tag, or group in one shot (especially after import).

---

## Smarter transaction workflow

- [ ] **Rules / auto-categorization** — If merchant contains X → category Y + tags. Reduces manual cleanup after Kotak import.
- [ ] **Split transactions** — One payment → multiple categories (e.g. rent + utilities from one transfer).
- [ ] **Transfers between accounts** — Mark transfer pairs so they don’t inflate income/expense when multiple accounts exist.
- [ ] **Recurring detection** — Flag subscriptions and rent; optional “expected this month” reminders.
- [ ] **Duplicate review queue** — After import, surface likely duplicates before they stay in the ledger.

---

## Search and navigation

- [ ] **Richer table filters** — Amount range, has-note, and other combinators beyond today’s category / tag / search / group / period / type filters.
- [ ] **Saved views** — e.g. “Uncategorized this month”, “Trip group”, pinned as quick links.
- [ ] **Merchant normalization** — Merge variants (“AMZN*123”, “Amazon Pay”) into one merchant for cleaner reports.

---

## Reporting (Dashboards++)

- [ ] **Month-over-month / year-over-year** — Trend arrows on summary stats.
- [ ] **Cashflow timeline** — Daily or weekly net balance chart for the selected period.
- [ ] **Top merchants & category drill-down** — Click a category bar → filtered transaction list.
- [x] **Account CSV export** — Control “Export CSV” for the whole account (`/api/accounts/.../transactions/export`).
- [ ] **Filtered export** — CSV/Excel for the current transaction-table filter (outbound mirror of Excel sync).

---

## Import and data hygiene

- [ ] **Scheduled Excel sync** — Background job or “Sync now” in Control using existing conservative merge logic.
- [x] **HDFC Bank PDF importer** — NetBanking account statement PDFs (Withdrawal/Deposit columns).
- [ ] **More bank importers** — Same pipeline as Kotak for additional banks.
- [ ] **Import history** — Which file, when, how many rows added/skipped; optional rollback of last import.

---

## Quality of life

- [ ] **Keyboard shortcuts** — `/` search, note/group actions on focused row.
- [ ] **Mobile-friendly table** — Card layout on narrow screens.
- [ ] **Multi-currency** — Account currency exists; FX or separate ledgers if needed.
- [ ] **Shared household account** — Expose viewer vs editor roles in Settings (membership already in auth).

---

## Higher effort, high value

- [ ] **Reconciliation mode** — Match statement balance to running balance line-by-line.
- [ ] **Forecast** — “At current burn rate, you’ll hit X by month-end” from recurring + averages.
- [ ] **Notifications** — Budget threshold, large transaction, stale balance.

---

## Suggested next three

If picking a short roadmap:

1. Budgets + goals in Control (backend largely exists).
2. Auto-categorization rules (biggest daily time-saver after import).
3. Group/category dashboards with drill-down (makes metadata feel purposeful).

---

## Notes

- Pain-point drivers: import cleanup → rules + duplicates + bulk edit; planning → budgets + goals + forecast; reporting → dashboards drill-down + export; sharing → household roles.
- Update this file as items ship or priorities change.
