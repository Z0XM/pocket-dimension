# Addendum — prd-chhan-multi-account-2026-08-23

Mechanism and brownfield notes for Architecture / implementation. Not product requirements.

## Existing capabilities (do not rebuild)

- Schema: `finance_accounts`, `finance_account_members`, all children keyed by `account_id` — `shared/db/src/schema/chhanchhan.ts`.
- API: `GET/POST /api/accounts`, full tree under `/api/accounts/[accountId]/…` with `getMembershipOrThrow`.
- Server: `createAccount`, `listAccountsForUser`, `getOrCreateDefaultAccount` (returns first by name).

## UI gap

- `(protected)/app/+layout.server.ts` always loads default account only.
- Control actions call `getOrCreateDefaultAccount` again, ignoring any future selection.

## Rejected for MVP

- URL path `/app/accounts/[id]/…` as primary selection (heavier rewrite; cookie + layout sufficient).
- Required “bank brand” field on Finance Account (importer remains per import).
- Automatic statement→account matching by account number in PDF metadata (nice-to-have later).
