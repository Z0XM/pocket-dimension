# chhan-chhan — Project Context (for AI agents)

**Product:** Personal finance ledger (statement import, categorization, dashboards)  
**Monorepo path:** `apps/chhan-chhan`  
**Auth:** `@pocket-dimension/auth` + `auth-service` (Better Auth)  
**DB schema:** `chhanchhan` (PostgreSQL 18+)

## URLs / ports

- Dev app: **http://localhost:3005** (`bun run dev:app:chhan-chhan`)
- Auth service: **http://localhost:5001** (`PUBLIC_BASE_AUTH_URL`)
- Deploy: see `apps/chhan-chhan/DEPLOY.md` (Dokploy from **repo root**, port 3005)

## Non-negotiables

- Build `@pocket-dimension/{auth,db,utils}` **before** running the app (`dist/` imports).
- PostgreSQL **18+** required (`uuidv7`).
- Money is always **minor units** (paise); use `parseIndianAmount` / `formatMoney`.
- Mutations: `requireUser` → `getMembershipOrThrow` → `canEdit` (owner/editor).
- BMAD artifacts for this app live only under `_bmad-output/chhan-chhan/` — never under `pocket-dimension/` or `zeo/`. See `_bmad-output/README.md`.

## Auth / session caveat

Better Auth cookies use `secure: true` / `sameSite: "none"`. Over plain `http://localhost`, the browser may not persist the session. Signup can work; verifying email often needs a DB flip of `email_verified`.

## Importers

Registry: `src/lib/importers/index.ts` (`BankImporter`).

| id | Formats |
|----|---------|
| `kotak` | CSV + PDF |
| `icici` | PDF |
| `hdfc` | PDF |
| `generic` | CSV (`ImportRow` columns) |

Operational detail: `apps/chhan-chhan/IMPORT.md`. Deferred PDF edge cases: `implementation-artifacts/deferred-work.md`.

When adding a bank: `{bank}.ts` + `{bank}-pdf.ts` + `{bank}-shared.ts` + tests + register + IMPORT section.

## Control center

- Import (stream), currency, **first transaction date**, **opening balance** set/clear
- Export CSV, categories/tags/groups CRUD
- **Danger zone:** clear all transactions → `resetAccountTransactions` (nulls account balance; keeps category/tag/group definitions)

## Balance

- Account snapshot: `finance_accounts.balance_minor` / `balance_as_of` (opening balance UI + import sync)
- Txn running balances: `finance_transactions.balance_minor`
- `getCurrentBalance` picks the newest snapshot among account + latest txn balance

## Product surfaces

| Route | Purpose |
|-------|---------|
| `/app` | Ledger + filters + smart cat/tag + refunds |
| `/app/dashboards` | Widgetized analytics (budgets/goals display; Control CRUD still backlog) |
| `/app/control` | Import/export/metadata/opening balance/clear-all |

## Multi-account (planned)

MVP planning (PRD + UX + Architecture) is in draft — **not implemented yet**:

- PRD: `planning-artifacts/prds/prd-chhan-multi-account-2026-08-23/`
- UX: `planning-artifacts/ux-designs/ux-chhan-multi-account-2026-08-23/`
- Architecture: `planning-artifacts/architecture-multi-account.md`

Until shipped, UI still uses `getOrCreateDefaultAccount()` (first membership by name). DB/API already support multiple accounts.

## Living docs

- Backlog: `apps/chhan-chhan/FUTURE-TODO.md`
- Import: `apps/chhan-chhan/IMPORT.md`
- Brownfield pack: `_bmad-output/chhan-chhan/planning-artifacts/`

## Out of scope for agents unless asked

- Full PRD/epic planning (not started for this app)
- Changing default `_bmad/bmm/config.yaml` away from pocket-dimension without an explicit switch
