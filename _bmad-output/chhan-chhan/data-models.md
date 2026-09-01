# Data Models — `chhan-chhan`

Monorepo-wide schema reference: [`../shared-db/data-models.md`](../shared-db/data-models.md). This doc covers only the `chhanchhan` Postgres schema (`shared/db/src/schema/chhanchhan.ts`, `pgSchema("chhanchhan")`, 333 LOC) and which `apps/chhan-chhan` files touch each table/enum. All tables use the `id`/`timestamps`/`actionsByUser` helpers from `shared/db/src/schema/common.ts` (`uuidv7()` PK — **requires PostgreSQL 18+**, `createdAt`/`updatedAt`, `createdById`/`updatedById` → `auth.user`).

**Note on `actionsByUser` cascade behavior here:** `createdById` is `.notNull()`; `updatedById` is nullable, but **both** FKs use `onDelete: cascade` (not `set null`) — deleting the `auth.user` row that last touched a row **deletes that row too**, not just clears the field. This is a schema-wide convention, not specific to any one table below.

## Enums

| Enum | Values | Used by |
| --- | --- | --- |
| `account_member_role` | `owner`, `editor`, `viewer` | `finance_account_members.role`; `canEdit()` in `authz.ts` treats `owner`/`editor` as writable. |
| `transaction_type` | `expense`, `income`, `transfer` | `finance_transactions.type`, `finance_categories.kind`. `transfer` is never assigned by any bank PDF/CSV parser — only reachable via manual edit or the generic-CSV importer's explicit `type` column. |
| `budget_period` | `monthly`, `weekly`, `custom` | `finance_budgets.period`. |
| `goal_status` | `active`, `paused`, `completed`, `cancelled` | `finance_goals.status`. |

## Tables

### `finance_accounts`

| Column | Type | Notes |
| --- | --- | --- |
| `owner_user_id` | uuid → `auth.user.id`, `onDelete: cascade` | |
| `name` | text | Drives `getOrCreateDefaultAccount`'s `ORDER BY name ASC` "default account" resolution — see [architecture.md](./architecture.md#multi-account-model). |
| `currency_code` | text, default `"USD"` | One of **three disagreeing default-currency sources** in the codebase — see [project-context.md](./project-context.md). |
| `timezone` | text, default `"UTC"` | |
| `is_archived` | boolean | |
| `balance_minor` | bigint, nullable | Account-level balance snapshot. |
| `balance_as_of` | date, nullable | |

Index on `owner_user_id`. **Touched by:** `src/lib/server/finance.ts` (`createAccount`, `listAccountsForUser`, `getOrCreateDefaultAccount`, `updateAccountCurrency`, `updateAccountOpeningBalance`/`clearAccountOpeningBalance`, `getAccountCurrency`), `src/lib/server/import.ts` (`syncImportBalances`, `resetAccountTransactions` nulls the snapshot), `src/lib/server/balance.ts` (pure snapshot-comparison helpers).

### `finance_account_members`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `user_id` | uuid → `auth.user.id`, cascade | |
| `role` | `account_member_role`, default `"viewer"` | |

Unique `(account_id, user_id)`; index on `user_id`. **Touched by:** `getMembershipOrThrow` (the authz chokepoint — see [architecture.md](./architecture.md)), `createAccount` (inserts the creator as `owner`). No route currently creates a *second* member on an existing account (no `POST /api/accounts/[id]/members` route exists) — every account has exactly one member in practice today.

### `finance_categories`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `name` | text | Unique `(account_id, name)`. Free-text — refund/split-return and "bill" categorization both match against this by string, not a schema flag (see [project-context.md](./project-context.md)). |
| `kind` | `transaction_type`, default `"expense"` | |
| `color_hex` | text | |
| `parent_category_id` | uuid, **no `.references()`** | Declared as a bare `uuid()` column, unlike every other relationship in this file — no DB-level FK. The Drizzle `relations()` block declares an app-level `parentCategory` relation, but no current app code path actually writes to this column; it's schema-only and unused. An orphaned value is harmless (`billCategorySqlFilter()`'s `LEFT JOIN` just yields `NULL`), but integrity is entirely app-enforced (i.e. not enforced at all today). |

Index on `account_id`. **Touched by:** `finance.ts` (`listCategories`, `createCategory`/`updateCategory`/`deleteCategory`), `$lib/finance/refunds.ts` (name match against `"Refund"`/`"Split Return"`), `$lib/finance/bill-categories.ts` (name regex match `/\bbill\b/i`).

### `finance_transactions`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `category_id` | uuid → `finance_categories.id`, **`set null`** on delete | Differs from `finance_budgets.category_id` (cascade) — see below. |
| `occurred_on` | date | |
| `amount_minor` | bigint, **always positive** | Sign implied entirely by `type`. |
| `currency_code` | text, default `"USD"` | See [project-context.md](./project-context.md) for the `createTransaction()` USD-hardcode bug. |
| `type` | `transaction_type` | |
| `merchant`, `notes`, `external_ref` | text, nullable | |
| `balance_minor` | bigint, nullable | Per-transaction running balance from the statement, when the bank format provides one. |
| `sort_order` | int, default 0 | Ties in same-date balance comparisons favor the newer candidate (`>=` in `isBalanceSnapshotNewer`) — relied on by import re-runs. |

Composite indexes: `(account_id, occurred_on)`, `(account_id, category_id)`, `(account_id, sort_order)`. **Touched by:** almost every function in `finance.ts` (CRUD, all analytics), `import.ts` (insert/dedup/balance-sync), `$lib/finance/transaction-search.ts` (search predicates), `$lib/finance/transaction-warnings.ts` (refund-link mismatch detection).

### `finance_budgets`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `category_id` | uuid → `finance_categories.id`, **cascade** | Deleting a category deletes any budget scoped to it — differs from `finance_transactions.category_id`'s `set null`. |
| `name`, `period`, `start_date`, `end_date` (nullable), `limit_minor`, `is_active` | | |

Index on `account_id`. **Touched by:** `finance.ts` (`listBudgets`, create/update via `budgetUpsertSchema`), `getAnalytics` (active-budget usage meters). **No delete path exists at all** — no `DELETE` API route, no Control UI. See [api-contracts.md](./api-contracts.md).

### `finance_goals`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `name`, `target_minor`, `current_minor` (default 0), `target_date` (nullable), `status` | | |

Index on `account_id`. **Touched by:** `finance.ts` (`listGoals`, create/update via `goalUpsertSchema`), `getAnalytics` (goal meters). Same "no delete path" situation as budgets.

### `finance_tags` / `finance_transaction_tags`

`finance_tags`: `account_id` (cascade), `name` (unique per account), `color_hex`. `finance_transaction_tags` (junction, no own `id`): `transaction_id`/`tag_id`, both cascade, composite PK `(transaction_id, tag_id)`, index on `tag_id`. **Touched by:** `finance.ts` (tag CRUD, attach/detach), smart-tag preview/apply flow.

### `finance_groups` / `finance_transaction_groups`

`finance_groups`: `account_id` (cascade), `name` (unique per account), `color_hex`. `finance_transaction_groups` (junction): `transaction_id`/`group_id`, both cascade, `is_hidden` (default `false`, per-transaction "hide from group total" flag), composite PK `(transaction_id, group_id)`, index on `group_id`. **Touched by:** `finance.ts` (group CRUD, attach/detach, `setGroupHidden`), dashboard's Groups spend widget.

### `finance_transaction_refund_links`

Junction: `credit_transaction_id`/`expense_transaction_id`, both → `finance_transactions.id` cascade, composite PK `(credit_transaction_id, expense_transaction_id)`, index on `expense_transaction_id`. **Touched by:** `finance.ts` (`attachRefundLink`/detach, `getRefundLinkClusterIds`, `loadRefundLinkRowsForTransactions` — BFS over the link graph, no depth limit), `$lib/finance/transaction-warnings.ts` (connected-components mismatch detection).

## Cascades summary

- Deleting a `finance_account` cascades **everything** scoped to it (members, categories, transactions, budgets, goals, tags, groups).
- Deleting a `finance_transaction` cascades its tag links, group links, and refund links.
- Deleting a `finance_category` sets `finance_transactions.category_id` to `null` but **cascades** (deletes) any `finance_budgets` row scoped to that category.
- Deleting the `auth.user` who last touched a row cascades and **deletes that row** (both `createdById` and `updatedById` use `onDelete: cascade`, not `set null` — see the note at the top of this doc).
- `resetAccountTransactions` (Control's "clear all transactions") deletes all transactions for an account (cascading tags/groups/refund-links) and nulls the account's `balance_minor`/`balance_as_of` — category/tag/group *definitions* themselves are untouched.

## Relations

`shared/db/src/schema/chhanchhan.ts` defines a full `relations()` graph, including refund-link disambiguation (two named relations for `credit`/`expense` sides of the same junction table, since both FKs point at `finance_transactions`). As with `watchlist`, no app code uses Drizzle's relational query API (`db.query.financeTransactions.findMany({ with: ... })`) — every read is a query-builder call or a raw `sql\`...\`` template.

## Money storage

Every monetary column is `bigint` (Drizzle `mode: "number"`), storing **integer minor units** (paise for INR). Never store major-unit decimals. See [architecture.md](./architecture.md#money--minor-units-conventions) and [project-context.md](./project-context.md) for the currency-handling gotchas that interact with this schema.

## Migrations

Repo-wide: `bun run db:migrate`, requires PostgreSQL **18+** (the `uuidv7()` default function). Tables live in the `chhanchhan` named schema, not `public`.
