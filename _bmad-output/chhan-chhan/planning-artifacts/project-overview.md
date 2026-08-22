# chhan-chhan — Project Overview

**Date:** 2026-08-23  
**Type:** Brownfield web application (personal finance)  
**Architecture:** SvelteKit full-stack + shared monorepo packages

## Executive Summary

**Chhan Chhan** is a personal finance ledger in the Pocket Dimension monorepo. Authenticated users import Indian bank statements (Kotak, ICICI, HDFC, Generic CSV), categorize and tag transactions, link refunds, and view widgetized dashboards. Control center handles import/export, metadata CRUD, opening balance, and danger-zone clear-all.

## Project Classification

- **Repository Type:** Multi-app Bun + Turbo monorepo (this doc scopes to `apps/chhan-chhan`)
- **Project Type(s):** SvelteKit SPA/SSR finance app
- **Primary Language(s):** TypeScript, Svelte 5
- **Architecture Pattern:** SvelteKit routes + form actions + REST-ish account APIs; Drizzle ORM on PostgreSQL schema `chhanchhan`

## Technology Stack Summary

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Framework | SvelteKit 2 + Svelte 5 |
| Adapter | `svelte-adapter-bun` |
| Styling | Tailwind 4 + forge chrome theme (`src/lib/styles/forge.css`) |
| Auth | `@pocket-dimension/auth` + `auth-service` (Better Auth) |
| DB | PostgreSQL 18+, Drizzle (`@pocket-dimension/db`), schema `chhanchhan` |
| PDF text | `unpdf` via `extractPdfText` |
| Validation | Zod |
| Dev port | **3005** |

## Key Features

- Transaction ledger with period / type / category / tag / group / search filters
- Smart categorize & smart tag helpers
- Refund linking between income/expense rows
- Statement import (streaming progress) with dedup + import report CSV
- Control: currency, opening balance, export CSV, clear all transactions, categories/tags/groups
- Dashboards with localStorage widget picker (budgets/goals meters; Control CRUD still backlog)
- Account membership roles (`owner` / `editor` / `viewer`) — edit gated by `canEdit`

## Architecture Highlights

- **Importer registry:** `BankImporter` interface; register in `src/lib/importers/index.ts`
- **Money:** minor units (paise); `parseIndianAmount` / `formatMoney`
- **Balance:** account snapshot (`balance_minor` / `balance_as_of`) + latest txn with `balanceMinor`; imports may advance snapshot
- **Authz:** every mutation uses `requireUser` → membership → `canEdit`

## Development Overview

### Prerequisites

- Bun, PostgreSQL 18+, built `@pocket-dimension/{auth,db,utils}`
- `auth-service` on 5001; matching `BETTER_AUTH_SECRET`; non-empty `RESEND_API_KEY` for auth-service boot

### Getting Started

```bash
# repo root
bun install
bun run build   # or build:shared:*
sudo pg_ctlcluster 18 main start
bun run db:migrate
bun run dev:app:auth
bun run dev:app:chhan-chhan
```

### Key Commands

- **Install:** `bun install` (repo root)
- **Dev:** `bun run dev:app:chhan-chhan` (port 3005)
- **Build:** `cd apps/chhan-chhan && bun run build`
- **Check:** `cd apps/chhan-chhan && bun run check`
- **Importer tests:** `cd apps/chhan-chhan && bun test src/lib/importers/`

## Repository Structure

App code under `apps/chhan-chhan/`. Shared schema in `shared/db/src/schema/chhanchhan.ts`. BMAD artifacts under `_bmad-output/chhan-chhan/`.

## Documentation Map

- [index.md](./index.md) — Master documentation index
- [architecture.md](./architecture.md) — Technical architecture
- [source-tree-analysis.md](./source-tree-analysis.md) — Directory structure
- [development-guide.md](./development-guide.md) — Local setup
- [api-contracts.md](./api-contracts.md) — API surface
- [data-models.md](./data-models.md) — Schema overview
- [component-inventory.md](./component-inventory.md) — UI / lib components
- In-app: `apps/chhan-chhan/IMPORT.md`, `FUTURE-TODO.md`, `DEPLOY.md`
- AI: `../project-context.md`

---

_Generated using BMAD Method `document-project` workflow (scoped to chhan-chhan)_
