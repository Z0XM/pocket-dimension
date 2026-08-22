# chhan-chhan — Data Models

**Date:** 2026-08-23  
**Schema:** `chhanchhan` (Drizzle: `shared/db/src/schema/chhanchhan.ts`)

## Core tables

| Table | Purpose |
|-------|---------|
| `finance_accounts` | Ledger account; `currency_code`, `timezone`, optional `balance_minor` / `balance_as_of` |
| `finance_account_members` | `owner` / `editor` / `viewer` |
| `finance_transactions` | Rows: `occurred_on`, `amount_minor`, `type`, merchant/notes/ref, optional `balance_minor`, `sort_order`, `category_id` |
| `finance_categories` | Expense/income/transfer kinds + color |
| `finance_tags` / `finance_transaction_tags` | Tags (M:N) |
| `finance_groups` / `finance_transaction_groups` | Groups (M:N) |
| `finance_transaction_refund_links` | Links refund income ↔ expense |
| `finance_budgets` | Limits by period/category |
| `finance_goals` | Savings targets |

Enums: `account_member_role`, `transaction_type`, `budget_period`, `goal_status`.

## Cascades

Deleting a transaction cascades tag, group, and refund-link rows.  
`resetAccountTransactions` deletes all transactions for an account and nulls account balance fields.

## Money

Stored as `bigint` minor units (`mode: "number"` in Drizzle). Never store major units in DB.

## Auth linkage

`finance_accounts.owner_user_id` and member `user_id` reference `auth.users`. Auth tables are outside `chhanchhan`.

## Migrations

Repo-wide: `bun run db:migrate` with PG18+. Tables are not in `public`.

---

_Generated using BMAD Method `document-project` workflow_
