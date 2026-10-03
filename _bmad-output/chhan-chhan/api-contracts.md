# API Contracts — `chhan-chhan`

Every HTTP endpoint under `apps/chhan-chhan/src/routes/api/accounts/**`, plus the top-level `/health` probe and the Control page's non-API form actions. All paths below are relative to `/api/accounts` unless noted. Handlers import `{ db, schema }` transitively via `$lib/server/finance.ts`/`$lib/server/import.ts` and call `{ db, schema }` from `@pocket-dimension/db`.

**Authz on every route (see [architecture.md](./architecture.md), Authorization chokepoint section):** `requireUser(locals)` (401 if unauthenticated) → `getMembershipOrThrow(user.id, accountId)` (403 if not a member of `accountId`) → for mutating routes, `canEdit(membership.role)` (403 unless `role ∈ {owner, editor}`). Read-only (`GET`) handlers stop after the membership check — viewers can read.

**Classifier model:** Tags (free-form labels) + Spaces (relationship containers with M:N allocations). Categories, groups, and refund-links APIs were removed.

---

## Accounts

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts` | session only | — | `listAccountsForUser` — every account the caller is a member of. |
| POST | `/api/accounts` | session only | `createAccountSchema` (`name`, `currencyCode` default `"USD"`, `timezone` default `"UTC"`) | Creates the account and inserts the caller as `owner` in one `db.transaction()`. **Not called from any UI** — reachable only via direct API call today (see [architecture.md](./architecture.md#multi-account-model)). |

## Analytics

| Method | Path | Authz | Notes |
| --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/analytics` | member | `getAnalytics` — monthly + all-time summary, this-month tag spend, active-budget usage, goals. |

## Tags

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/tags` | member | — | `listTags`. |
| POST | `/api/accounts/[accountId]/tags` | canEdit | `createTagSchema` (`name`, `colorHex?`, `kind?`) | 409-equivalent on duplicate name. |

Tag **update**/**delete** are primarily Control form actions (`updateTag`/`deleteTag`).

## Spaces

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/spaces` | member | — | `listSpaces`. |
| POST | `/api/accounts/[accountId]/spaces` | canEdit | `createSpaceSchema` (`name`, `colorHex?`, `notes?`) | 409 on duplicate name. |
| PATCH | `/api/accounts/[accountId]/spaces/[spaceId]` | canEdit | `updateSpaceSchema` | Space metadata. |
| DELETE | `/api/accounts/[accountId]/spaces/[spaceId]` | canEdit | — | Cascades membership + allocations. |
| POST | `/api/accounts/[accountId]/spaces/[spaceId]/allocations` | canEdit | `createSpaceAllocationSchema` | M:N amount edge inside the space. |
| DELETE | `/api/accounts/[accountId]/spaces/[spaceId]/allocations/[allocationId]` | canEdit | — | |

## Budgets

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/budgets` | member | — | `listBudgets`. |
| POST | `/api/accounts/[accountId]/budgets` | canEdit | `budgetUpsertSchema` (`tagId?` scopes the budget) | Create only. |
| PATCH | `/api/accounts/[accountId]/budgets/[budgetId]` | canEdit | `budgetUpsertSchema` | 404 if not found in this account. |

**There is no `DELETE` route for budgets.** No Control UI for budgets — dashboard meters only.

## Goals

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/goals` | member | — | `listGoals`. |
| POST | `/api/accounts/[accountId]/goals` | canEdit | `goalUpsertSchema` | Create only. |
| PATCH | `/api/accounts/[accountId]/goals/[goalId]` | canEdit | `goalUpsertSchema` | 404 if not found. |

**There is no `DELETE` route for goals either.** Same "no Control UI, read-only dashboard meters only" situation as budgets.

## Transactions

| Method | Path | Authz | Body / Query | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/transactions` | member | `transactionsQuerySchema` (`pageIndex`, `pageSize` ≤200, `search`, `tagIds`, `spaceId`, `type`, `dateFrom`/`dateTo`, `sortBy`, `sortDirection`) | Paginated; enriches each row with tags and spaces. |
| POST | `/api/accounts/[accountId]/transactions` | canEdit | `transactionUpsertSchema` | Manual "add transaction." **Hardcodes `currencyCode: "USD"` in `createTransaction()`** — see [project-context.md](./project-context.md) known-gotchas #1. |
| PATCH | `/api/accounts/[accountId]/transactions/[transactionId]` | canEdit | `transactionUpsertSchema.partial()` | 404 if not found in this account. |
| DELETE | `/api/accounts/[accountId]/transactions/[transactionId]` | canEdit | — | Cascades tag links, space membership, allocations. |
| GET | `/api/accounts/[accountId]/transactions/export` | member | — | CSV of the **entire account**, sorted by `occurredOn, id`. Ignores filters. |
| GET | `/api/accounts/[accountId]/transactions/import` | member | — | `{ importers: [{id, label}] }`. |
| POST | `/api/accounts/[accountId]/transactions/import` | canEdit | multipart: `file`, `importer`, `skipDuplicates` | Synchronous JSON `ImportResult`. |
| POST | `/api/accounts/[accountId]/transactions/import/stream` | canEdit | same multipart shape | NDJSON streaming progress — primary UI import path. |
| GET | `/api/accounts/[accountId]/transactions/smart-tag` | member | `merchant`, `newTagId`, `sourceTransactionId`, `type` (query) | Preview of exact + fuzzy-merchant tag-profile migrations. |
| POST | `/api/accounts/[accountId]/transactions/smart-tag` | canEdit | `smartTagApplySchema` (`mode: "replace" \| "append"`) | Applies tag to source + selected merchant migrations. |

### Tags / spaces (per transaction)

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `.../transactions/[transactionId]/tags` | canEdit | `attachTransactionTagSchema` (`tagId`) | 404 if transaction or tag not found. |
| DELETE | `.../transactions/[transactionId]/tags/[tagId]` | canEdit | — | 404 if link not found. |
| POST | `.../transactions/[transactionId]/spaces` | canEdit | `attachTransactionSpaceSchema` (`spaceId`) | Adds txn to space membership. |
| DELETE | `.../transactions/[transactionId]/spaces/[spaceId]` | canEdit | — | Removes membership (allocations involving the txn may need cleanup separately). |

## Health

| Method | Path | Authz | Notes |
| --- | --- | --- | --- |
| GET | `/health` (top-level, **not** under `/api/accounts`) | none | Liveness probe: `SELECT 1`; `{status:"ok"}`/200 on success, `{status:"error", db:false}`/503 on any thrown error. |

---

## Not exposed via `/api` — Control form actions

`(protected)/app/control/+page.server.ts` form actions each re-derive `user` → `account = getOrCreateDefaultAccount(user.id)` → `membership` → `canEdit` before mutating. Because of `getOrCreateDefaultAccount`, **every one of these is always scoped to the alphabetically-first account**:

| Action | Purpose |
| --- | --- |
| `createTag` / `updateTag` / `deleteTag` | Tag CRUD. |
| `createSpace` / `updateSpace` / `deleteSpace` | Space CRUD. |
| `seedDefaultTaxonomy` | Inserts default tag seeds from `$lib/finance/default-taxonomy.ts`. |
| `updateCurrency` | Sets `finance_accounts.currency_code`. |
| `updateOpeningBalance` | Sets or clears the account's opening balance/date. |
| `importStatement` | Legacy non-streaming form-based import (UI uses streaming fetch). |
| `clearAllTransactions` | Danger-zone: `resetAccountTransactions` — deletes all transactions and nulls balance; cascades tag/space links. |

## Response/error conventions

- Mutating routes return `error(403, "You only have read access")`-style SvelteKit errors for role failures, `error(404, ...)` for not-found, and `error(400, ...)` for Zod validation failures (`readJsonBody`/`parseSearch` in `src/lib/server/http.ts`).
- The streaming import endpoint (`import/stream`) returns NDJSON progress events, consumed by `importStatementWithProgress()` in `src/lib/import-stream.ts`.
- Zod schemas live in `src/lib/validation/finance.ts`.

See [data-models.md](./data-models.md) for the underlying `chhanchhan` schema and [project-context.md](./project-context.md) for verified gotchas.
