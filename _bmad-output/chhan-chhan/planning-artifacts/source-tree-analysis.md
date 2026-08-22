# chhan-chhan — Source Tree Analysis

**Date:** 2026-08-23

## Overview

SvelteKit app under `apps/chhan-chhan` with domain logic in `src/lib/{finance,importers,server,validation}` and UI in `src/routes` + `src/lib/components`. Shared DB schema lives outside the app package.

## Complete Directory Structure (app-focused)

```
apps/chhan-chhan/
  DEPLOY.md
  FUTURE-TODO.md
  IMPORT.md
  package.json
  scripts/
    clear-transaction-notes.ts
    dedupe-transactions.ts
    sync-from-excel.ts
  src/
    hooks.server.ts
    lib/
      auth.ts
      components/          # app chrome, filters, dashboard widgets, smart popups
      finance/             # money, summary, search, refunds, widgets
      importers/           # BankImporter registry + bank parsers
      import-stream.ts
      server/              # finance CRUD, import, authz, pdf-text, balance
      styles/forge.css
      validation/finance.ts
    routes/
      (auth)/              # login, sign-up, verify, password reset
      (protected)/app/     # ledger, dashboards, control
      api/accounts/…       # REST-ish account APIs
      health/
shared/db/src/schema/chhanchhan.ts
_bmad-output/chhan-chhan/
```

## Critical Directories

### `apps/chhan-chhan/src/lib/importers`

Bank statement parsers and registry (`kotak`, `icici`, `hdfc`, `generic`).

**Entry Points:** `index.ts` (`getImporter`, `listImporters`)

### `apps/chhan-chhan/src/lib/server`

Server-only finance operations, import pipeline, authz helpers, PDF text extraction.

**Entry Points:** `finance.ts`, `import.ts`, `authz.ts`, `pdf-text.ts`

### `apps/chhan-chhan/src/routes/(protected)/app`

Primary product UI: transactions (`+page`), dashboards, control center.

### `apps/chhan-chhan/src/routes/api/accounts/[accountId]`

HTTP APIs for transactions, import/stream/export, categories, budgets, goals, analytics, tags/groups/refund-links.

### `shared/db/src/schema/chhanchhan.ts`

Drizzle tables for accounts, members, transactions, categories, tags, groups, budgets, goals, junction/refund tables.

## Entry Points

- **Main UI:** `/app` (protected layout loads default finance account)
- **Control:** `/app/control`
- **Dashboards:** `/app/dashboards`
- **Health:** `/health`

## File Organization Patterns

- Bank parsers: `{bank}.ts` (BankImporter) + `{bank}-pdf.ts` + `{bank}-shared.ts` + tests
- Mutations: prefer SvelteKit form actions on Control; ledger uses fetch to `/api/...`
- Money always as integer minor units in DB and API

## Configuration Files

- `apps/chhan-chhan/.env.example` — app env
- `apps/chhan-chhan/vite.config.ts`, `svelte.config.js`
- `apps/chhan-chhan/Dockerfile`, `railpack.json`

## Notes for Development

Build shared packages before starting the app. Local session cookies may not stick over plain HTTP (`secure: true` / `sameSite: none` in shared auth). Deploy from repo root — see `DEPLOY.md`.

---

_Generated using BMAD Method `document-project` workflow_
