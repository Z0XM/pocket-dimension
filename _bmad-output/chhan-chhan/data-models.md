# Data Models — `chhan-chhan`

Monorepo-wide schema reference: [`../shared-db/data-models.md`](../shared-db/data-models.md). This doc covers only the `chhanchhan` Postgres schema (`shared/db/src/schema/chhanchhan.ts`, `pgSchema("chhanchhan")`) and which `apps/chhan-chhan` files touch each table/enum. All tables use the `id`/`timestamps`/`actionsByUser` helpers from `shared/db/src/schema/common.ts` (`uuidv7()` PK — **requires PostgreSQL 18+**, `createdAt`/`updatedAt`, `createdById`/`updatedById` → `auth.user`).

**Note on `actionsByUser` cascade behavior here:** `createdById` is `.notNull()`; `updatedById` is nullable, but **both** FKs use `onDelete: cascade` (not `set null`) — deleting the `auth.user` row that last touched a row **deletes that row too**, not just clears the field. This is a schema-wide convention, not specific to any one table below.

## Classifier model (Tags + Spaces)

Two orthogonal classifiers — categories, groups, and refund-links were removed (migration `0039_tags_and_spaces`):

| Concept | Role |
| --- | --- |
| **Tags** | Sole free-form label on transactions (M:N). Optional `kind` helps filter income vs expense tags. |
| **Spaces** | Relationship container: membership of transactions + M:N amount allocations inside the space (refunds / splits / shared pots). |

## Enums

| Enum | Values | Used by |
| --- | --- | --- |
| `account_member_role` | `owner`, `editor`, `viewer` | `finance_account_members.role`; `canEdit()` in `authz.ts` treats `owner`/`editor` as writable. |
| `transaction_type` | `expense`, `income`, `transfer` | `finance_transactions.type`, optional `finance_tags.kind`. `transfer` is never assigned by any bank PDF/CSV parser — only reachable via manual edit or the generic-CSV importer's explicit `type` column. |
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
| `color_hex`, `bank_importer_id` | text, nullable | Account chrome / preferred importer. |

Index on `owner_user_id`. **Touched by:** `src/lib/server/finance.ts`, `src/lib/server/import.ts`, `src/lib/server/balance.ts`.

### `finance_account_members`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `user_id` | uuid → `auth.user.id`, cascade | |
| `role` | `account_member_role`, default `"viewer"` | |

Unique `(account_id, user_id)`; index on `user_id`. **Touched by:** `getMembershipOrThrow`, `createAccount` (inserts the creator as `owner`).

### `finance_tags` / `finance_transaction_tags`

`finance_tags`: `account_id` (cascade), `name` (unique per account), `color_hex`, optional `kind` (`transaction_type`). `finance_transaction_tags` (junction, no own `id`): `transaction_id`/`tag_id`, both cascade, composite PK, index on `tag_id`.

**Touched by:** `finance.ts` (tag CRUD, attach/detach, tag spend/trend analytics), smart-tag preview/apply, `$lib/finance/default-taxonomy.ts` (seed tags including `"Refund"` / `"Split Return"`), `$lib/finance/bill-categories.ts` (bill widgets match tag names with `/\bbill\b/i`).

### `finance_transactions`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `occurred_on` | date | |
| `amount_minor` | bigint, **always positive** | Sign implied entirely by `type`. |
| `currency_code` | text, default `"USD"` | See [project-context.md](./project-context.md) for the `createTransaction()` USD-hardcode bug. |
| `type` | `transaction_type` | |
| `merchant`, `notes`, `external_ref` | text, nullable | |
| `balance_minor` | bigint, nullable | Per-transaction running balance from the statement, when the bank format provides one. |
| `sort_order` | int, default 0 | |

Composite indexes: `(account_id, occurred_on)`, `(account_id, sort_order)`. **No `category_id`** — labeling is tags-only. **Touched by:** almost every function in `finance.ts`, `import.ts`, `$lib/finance/transaction-search.ts`.

### `finance_spaces` / `finance_space_transactions` / `finance_space_allocations`

- `finance_spaces`: `account_id`, `name` (unique per account), `color_hex`, `notes`.
- `finance_space_transactions`: membership junction (`space_id`, `transaction_id`), cascade both sides.
- `finance_space_allocations`: M:N amount graph inside a space — `left_transaction_id` / `right_transaction_id` / `amount_minor` (any txn portion can allocate against any other).

**Touched by:** `finance.ts` (space CRUD, attach/detach, allocations, space-spend analytics), ledger space-link UI, Control spaces CRUD.

### `finance_budgets`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `tag_id` | uuid → `finance_tags.id`, **cascade**, nullable | Budget scoped to a tag (replaces former category scope). |
| `name`, `period`, `start_date`, `end_date` (nullable), `limit_minor`, `is_active` | | |

Index on `account_id`. **Touched by:** `finance.ts` (`listBudgets`, create/update via `budgetUpsertSchema`), `getAnalytics`. **No delete path** — no `DELETE` API route, no Control UI.

### `finance_goals`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid → `finance_accounts.id`, cascade | |
| `name`, `target_minor`, `current_minor` (default 0), `target_date` (nullable), `status` | | |

Index on `account_id`. **Touched by:** `finance.ts` (`listGoals`, create/update via `goalUpsertSchema`), `getAnalytics`. Same "no delete path" situation as budgets.

## Cascades summary

- Deleting a `finance_account` cascades **everything** scoped to it (members, transactions, budgets, goals, tags, spaces).
- Deleting a `finance_transaction` cascades its tag links, space membership, and space allocations that reference it.
- Deleting a `finance_tag` cascades transaction-tag links and any budgets scoped to that tag.
- Deleting a `finance_space` cascades membership and allocations.
- Deleting the `auth.user` who last touched a row cascades and **deletes that row** (both `createdById` and `updatedById` use `onDelete: cascade`).
- `resetAccountTransactions` deletes all transactions for an account (cascading tag/space links) and nulls the account's balance snapshot — tag/space *definitions* themselves are untouched.

## Relations

`shared/db/src/schema/chhanchhan.ts` defines a full `relations()` graph for tags, spaces, and allocations (named relations for left/right allocation sides). As with `watchlist`, no app code uses Drizzle's relational query API (`db.query.financeTransactions.findMany({ with: ... })`) — every read is a query-builder call or a raw `sql\`...\`` template.

## Money storage

Every monetary column is `bigint` (Drizzle `mode: "number"`), storing **integer minor units** (paise for INR). Never store major-unit decimals. See [architecture.md](./architecture.md#money--minor-units-conventions) and [project-context.md](./project-context.md).

## Migrations

Repo-wide: `bun run db:migrate`, requires PostgreSQL **18+** (the `uuidv7()` default function). Tables live in the `chhanchhan` named schema, not `public`. Classifier revamp: `0039_tags_and_spaces.sql` (drops categories/groups/refund-links; recreates tags + spaces + tag-scoped budgets).
