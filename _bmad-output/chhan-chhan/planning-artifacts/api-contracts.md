# chhan-chhan — API Contracts

**Date:** 2026-08-23  
**Base:** `/api/accounts` (authenticated; membership required)

Mutating routes require `canEdit` (owner/editor).

## Accounts

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/accounts` | List / create accounts |

## Transactions

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/accounts/[accountId]/transactions` | Paginated list + filters |
| POST | `/api/accounts/[accountId]/transactions` | Create |
| PATCH | `/api/accounts/[accountId]/transactions/[transactionId]` | Update |
| DELETE | `/api/accounts/[accountId]/transactions/[transactionId]` | Delete one |
| GET | `/api/accounts/[accountId]/transactions/export` | CSV export (Control) |
| POST | `/api/accounts/[accountId]/transactions/import` | Multipart import (JSON result) |
| POST | `/api/accounts/[accountId]/transactions/import/stream` | NDJSON progress stream (UI primary) |
| POST | `/api/accounts/[accountId]/transactions/smart-categorize` | Suggest categories |
| POST | `/api/accounts/[accountId]/transactions/smart-tag` | Suggest tags |

### Tags / groups / refunds (per transaction)

| Method | Path |
|--------|------|
| POST/DELETE | `.../transactions/[transactionId]/tags` and `.../tags/[tagId]` |
| POST/DELETE | `.../transactions/[transactionId]/groups` and `.../groups/[groupId]` |
| POST/DELETE | `.../transactions/[transactionId]/refund-links` and nested expense id |

## Metadata & planning

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/accounts/[accountId]/categories` | |
| GET/POST | `/api/accounts/[accountId]/budgets` | Dashboard uses; Control CRUD UI backlog |
| PATCH/DELETE | `/api/accounts/[accountId]/budgets/[budgetId]` | |
| GET/POST | `/api/accounts/[accountId]/goals` | Same |
| PATCH/DELETE | `/api/accounts/[accountId]/goals/[goalId]` | |
| GET | `/api/accounts/[accountId]/analytics` | Dashboard aggregates |

## Control form actions (not under `/api`)

On `/app/control` (`+page.server.ts`):

- Category / tag / group CRUD
- `updateCurrency`
- `updateOpeningBalance` (set or `clear=1`)
- `clearAllTransactions`
- `importStatement` (legacy; UI prefers stream API)

## Health

| Method | Path |
|--------|------|
| GET | `/health` |

Schemas: `apps/chhan-chhan/src/lib/validation/finance.ts`.

---

_Generated using BMAD Method `document-project` workflow_
