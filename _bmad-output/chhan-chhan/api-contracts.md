# API Contracts — `chhan-chhan`

Every HTTP endpoint under `apps/chhan-chhan/src/routes/api/accounts/**`, plus the top-level `/health` probe and the Control page's non-API form actions. All paths below are relative to `/api/accounts` unless noted. Handlers import `{ db, schema }` transitively via `$lib/server/finance.ts`/`$lib/server/import.ts` and call `{ db, schema }` from `@pocket-dimension/db`.

**Authz on every route (see [architecture.md](./architecture.md), Authorization chokepoint section):** `requireUser(locals)` (401 if unauthenticated) → `getMembershipOrThrow(user.id, accountId)` (403 if not a member of `accountId`) → for mutating routes, `canEdit(membership.role)` (403 unless `role ∈ {owner, editor}`). Read-only (`GET`) handlers stop after the membership check — viewers can read.

---

## Accounts

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts` | session only | — | `listAccountsForUser` — every account the caller is a member of. |
| POST | `/api/accounts` | session only | `createAccountSchema` (`name`, `currencyCode` default `"USD"`, `timezone` default `"UTC"`) | Creates the account and inserts the caller as `owner` in one `db.transaction()`. **Not called from any UI** — reachable only via direct API call today (see [architecture.md](./architecture.md#multi-account-model)). |

## Analytics

| Method | Path | Authz | Notes |
| --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/analytics` | member | `getAnalytics` — monthly + all-time summary, this-month category spend, active-budget usage, goals. |

## Categories

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/categories` | member | — | `listCategories`. |
| POST | `/api/accounts/[accountId]/categories` | canEdit | `createCategorySchema` (`name`, `kind` default `"expense"`, `colorHex?`) | 409-equivalent behavior on duplicate name (unique constraint → `onConflictDoNothing` → null result). |

Category **update**/**delete** are **not** exposed under `/api` at all — they exist only as Control form actions (`updateCategory`/`deleteCategory`), always scoped to `getOrCreateDefaultAccount(user)`.

## Budgets

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/budgets` | member | — | `listBudgets`. |
| POST | `/api/accounts/[accountId]/budgets` | canEdit | `budgetUpsertSchema` | Create only. |
| PATCH | `/api/accounts/[accountId]/budgets/[budgetId]` | canEdit | `budgetUpsertSchema` | 404 if not found in this account. |

**There is no `DELETE /api/accounts/[accountId]/budgets/[budgetId]` route.** Direct read of `src/routes/api/accounts/[accountId]/budgets/[budgetId]/+server.ts` confirms only `PATCH` is exported; a repo-wide grep for `export async function DELETE` under `budgets/` returns zero matches. There is also **no Control UI** for budgets at all (no create/edit/delete form anywhere in `control/+page.svelte`) — budgets are only usable via direct API calls (`GET`/`POST`/`PATCH`), and their only UI surface is read-only, as dashboard meters.

## Goals

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/goals` | member | — | `listGoals`. |
| POST | `/api/accounts/[accountId]/goals` | canEdit | `goalUpsertSchema` | Create only. |
| PATCH | `/api/accounts/[accountId]/goals/[goalId]` | canEdit | `goalUpsertSchema` | 404 if not found. |

**There is no `DELETE /api/accounts/[accountId]/goals/[goalId]` route either** (same verification method as budgets above — zero matches for `export async function DELETE` under `goals/`). Same "no Control UI, read-only dashboard meters only" situation as budgets.

> **Note on prior documentation:** `planning-artifacts/api-contracts.md` lists budgets/goals `[id]` routes as `PATCH/DELETE`. That is **not accurate against the current code** — only `PATCH` exists for either resource. This file reflects the verified, code-accurate contract; see [project-context.md](./project-context.md) for the tracked discrepancy.

## Transactions

| Method | Path | Authz | Body / Query | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts/[accountId]/transactions` | member | `transactionsQuerySchema` (`pageIndex`, `pageSize` ≤200, `search`, `categoryIds`, `tagIds`, `type`, `dateFrom`/`dateTo`, `groupId`, `linkTransactionId`, `sortBy`, `sortDirection`) | Paginated; enriches each row with tags/groups/refundLinks/warnings (and `groupHidden` when `groupId` is set). |
| POST | `/api/accounts/[accountId]/transactions` | canEdit | `transactionUpsertSchema` | Manual "add transaction." **Hardcodes `currencyCode: "USD"` in `createTransaction()` regardless of the account's actual currency** — see [project-context.md](./project-context.md) known-gotchas #1. |
| PATCH | `/api/accounts/[accountId]/transactions/[transactionId]` | canEdit | `transactionUpsertSchema.partial()` | 404 if not found in this account. Every field is independently optional; only `categoryId` cleanly distinguishes "omitted" from "explicitly nulled" (`if ("categoryId" in payload)`) — other nullable-in-spirit fields (`merchant`/`notes`/`externalRef`) can't be cleared via `null` since the schema is `.optional()` without `.nullable()`. |
| DELETE | `/api/accounts/[accountId]/transactions/[transactionId]` | canEdit | — | Cascades tags/groups/refund-links (FK `onDelete: cascade`). |
| GET | `/api/accounts/[accountId]/transactions/export` | member | — | CSV of the **entire account's transaction history**, sorted by `occurredOn, id`. **Ignores every query-string filter** (`type`, `dateFrom`, `dateTo`, `search`, etc.) — "filtered export" is a tracked backlog item, not implemented. |
| GET | `/api/accounts/[accountId]/transactions/import` | member | — | Doubles as a "list available importers" endpoint: `{ importers: [{id, label}] }` — not import history/status (there is no import-history feature). |
| POST | `/api/accounts/[accountId]/transactions/import` | canEdit | multipart: `file`, `importer` (default `"kotak"`), `skipDuplicates` (default `true` unless the string `"false"`) | Synchronous JSON `ImportResult`. |
| POST | `/api/accounts/[accountId]/transactions/import/stream` | canEdit | same multipart shape | NDJSON streaming progress (`phase`/`progress`/`complete`/`error` events) — this is the UI's primary import path (`$lib/import-stream.ts`). |
| GET | `/api/accounts/[accountId]/transactions/smart-categorize` | member | `merchant`, `newCategoryId?`, `sourceTransactionId`, `type` (query) | Preview of exact + fuzzy-merchant category migrations. |
| POST | `/api/accounts/[accountId]/transactions/smart-categorize` | canEdit | `smartCategorizeApplySchema` | Applies category to the source transaction plus selected merchant migrations. |
| GET | `/api/accounts/[accountId]/transactions/smart-tag` | member | `merchant`, `newTagId`, `sourceTransactionId`, `type` (query) | Preview of exact + fuzzy-merchant tag-profile migrations. |
| POST | `/api/accounts/[accountId]/transactions/smart-tag` | canEdit | `smartTagApplySchema` (adds `mode: "replace" \| "append"`) | Applies tag to source transaction plus selected merchant migrations. |

### Tags / groups / refund-links (per transaction)

| Method | Path | Authz | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `.../transactions/[transactionId]/tags` | canEdit | `attachTransactionTagSchema` (`tagId`) | 404 if transaction or tag not found in account. |
| DELETE | `.../transactions/[transactionId]/tags/[tagId]` | canEdit | — | 404 if link not found. |
| POST | `.../transactions/[transactionId]/groups` | canEdit | `attachTransactionGroupSchema` (`groupId`) | 404 if transaction or group not found. |
| PATCH | `.../transactions/[transactionId]/groups/[groupId]` | canEdit | `setGroupHiddenSchema` (`hidden: boolean`) | Per-transaction group visibility ("hide from group total" without removing the group tag). |
| DELETE | `.../transactions/[transactionId]/groups/[groupId]` | canEdit | — | 404 if link not found. |
| POST | `.../transactions/[transactionId]/refund-links` | canEdit | `attachRefundLinkSchema` (`expenseTransactionId`) | `transactionId` must be a "Refund"/"Split Return"-categorized credit; the expense must be `type: "expense"` in the same account. |
| DELETE | `.../transactions/[transactionId]/refund-links/[expenseTransactionId]` | canEdit | — | 404 if link not found. |

## Health

| Method | Path | Authz | Notes |
| --- | --- | --- | --- |
| GET | `/health` (top-level, **not** under `/api/accounts`) | none | Liveness probe: `SELECT 1`; `{status:"ok"}`/200 on success, `{status:"error", db:false}`/503 on any thrown error. |

---

## Not exposed via `/api` — Control form actions

`(protected)/app/control/+page.server.ts` implements 13 form actions, each independently re-deriving `user` → `account = getOrCreateDefaultAccount(user.id)` → `membership = getMembershipOrThrow(...)` → `canEdit` before mutating (~5 lines of boilerplate repeated per action — deliberate defense-in-depth, not an oversight). Because of `getOrCreateDefaultAccount`, **every one of these is always scoped to the alphabetically-first account**, never a URL/form-supplied `accountId` (see [architecture.md](./architecture.md#multi-account-model)):

| Action | Purpose |
| --- | --- |
| `createCategory` / `updateCategory` / `deleteCategory` | Category CRUD (no `/api` equivalent for update/delete). |
| `createTag` / `updateTag` / `deleteTag` | Tag CRUD (no `/api` equivalent at all). |
| `createGroup` / `updateGroup` / `deleteGroup` | Group CRUD (no `/api` equivalent at all). |
| `updateCurrency` | Sets `finance_accounts.currency_code` (`updateAccountCurrencySchema` — uppercases the input). |
| `updateOpeningBalance` | Sets or clears (`clear=1` sentinel, `clearAccountOpeningBalanceSchema`) the account's opening balance/date. |
| `importStatement` | Legacy **non-streaming** form-based import. The client-side form calls `event.preventDefault()` on submit and never actually triggers this action via native submission — the real UI import path is the streaming `POST .../import/stream` fetch call from `$lib/import-stream.ts`. This action may be unreachable dead code, or an intentional no-JS progressive-enhancement fallback; unconfirmed with the team. |
| `clearAllTransactions` | Danger-zone: calls `resetAccountTransactions` — deletes all transactions and nulls the account balance snapshot; cascades tags/groups/refund-links. Client-side gated by a native `confirm()` dialog. |

Categories/tags/groups create (`POST .../categories` for categories only) is the one CRUD operation that also has an `/api` route; update/delete for all three, and create for tags/groups, exist **only** as these form actions.

## Response/error conventions

- Mutating routes return `error(403, "You only have read access")`-style SvelteKit errors for role failures, `error(404, ...)` for not-found, and `error(400, ...)` for Zod validation failures (`readJsonBody`/`parseSearch` in `src/lib/server/http.ts`).
- The streaming import endpoint (`import/stream`) is the one route in the app that doesn't return a single JSON body — it's an NDJSON stream of `{ phase, progress?, message?, ... }` events terminated by a `complete` or `error` event, consumed by `importStatementWithProgress()` in `src/lib/import-stream.ts`.
- Zod schemas for every payload/query param live in `src/lib/validation/finance.ts` — check there before adding a new field to any endpoint.

See [data-models.md](./data-models.md) for the underlying `chhanchhan` schema and [project-context.md](./project-context.md) for verified gotchas that affect API behavior (currency hardcoding, default-account resolution, etc.).
