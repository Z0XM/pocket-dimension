# chhan-chhan — BMAD module

**App:** `@pocket-dimension/chhan-chhan`
**Code:** `apps/chhan-chhan`
**Port:** 3005 (dev and prod)
**Scan:** Deep brownfield, 2026-09-01 (core/server/API/auth/importers + routes/UI)

Personal finance ledger — Indian bank-statement import (Kotak, ICICI, HDFC, generic CSV), transaction categorization/tagging/refund-linking, budgets/goals, and widgetized dashboards — built on the shared `@pocket-dimension/{auth,db}` stack. See [project-overview.md](./project-overview.md) for the full product summary.

| Doc | Use |
| --- | --- |
| [project-context.md](./project-context.md) | Agent rules — build order, env, permission model, verified gotchas |
| [project-overview.md](./project-overview.md) | Product purpose, features, roles, stack, ports |
| [architecture.md](./architecture.md) | Route structure, auth flow, authz chokepoint, importer pipeline, money conventions, multi-account model, balance model |
| [api-contracts.md](./api-contracts.md) | Every `/api/accounts/**` endpoint plus Control's form actions — method, auth, params, response, gaps |
| [data-models.md](./data-models.md) | `chhanchhan` Postgres schema usage, table-by-table, which app code touches each |
| [development-guide.md](./development-guide.md) | Local setup, env vars, `dev`/`check`/`build`/tests, common pitfalls |
| [deployment-guide.md](./deployment-guide.md) | Dockerfile/Railpack deploy from the monorepo root, troubleshooting |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated file tree (`src/routes`, `src/lib`) |
| [component-inventory.md](./component-inventory.md) | Feature components, importers, server libs, finance helpers, `ui/*` primitive gap |
| [deep-dive-chhan-chhan.md](./deep-dive-chhan-chhan.md) | Exhaustive file-by-file review (every core/server/API/importer file plus every route and feature component) — the source for most findings summarized in the docs above |

Monorepo map: [`../pocket-dimension/index.md`](../pocket-dimension/index.md). Shared package docs: [`../shared-db/`](../shared-db/) (schema/client), [`../shared-auth/`](../shared-auth/) (Better Auth config).

## Existing product SoR (do not delete)

This module already has a planning/implementation record predating this scan — it remains the product source of record and is cross-linked, not replaced, by the root docs above:

- [planning-artifacts/index.md](./planning-artifacts/index.md) — the original `document-project` output (project overview, architecture, API/data-model docs, source tree, component inventory) plus the **draft, unimplemented** multi-account MVP planning pack (PRD, UX designs, `architecture-multi-account.md`).
- [implementation-artifacts/](./implementation-artifacts/) — `spec-hdfc-bank-importer.md` (the HDFC importer's original feature spec) and `deferred-work.md` (known PDF-import edge cases deferred at the time).

Where this scan's root docs and `planning-artifacts/` disagree (verified against current code, not assumption), the root docs call it out explicitly and `planning-artifacts/` is treated as the historical/aspirational version — see [project-context.md](./project-context.md#known-gotchas-verified-against-source-2026-09-01) gotchas #6 and #7 for the two confirmed contradictions (budgets/goals `DELETE` routes that don't exist; the undocumented Kotak "monthly" PDF format).

## Fast facts for a new agent

- Build `@pocket-dimension/{utils,db,auth}` **before** running/checking/building this app — see [development-guide.md](./development-guide.md).
- Every mutation follows `requireUser` → `getMembershipOrThrow` → `canEdit` (owner/editor); neither `finance.ts` nor `import.ts` enforce this themselves — see [architecture.md](./architecture.md) (Authorization chokepoint section).
- The UI is single-account only (`getOrCreateDefaultAccount`, alphabetically-first-by-name), even though the DB/API are fully multi-account — a draft fix exists in `planning-artifacts/architecture-multi-account.md` but is unimplemented. See [project-context.md](./project-context.md#known-gotchas-verified-against-source-2026-09-01) gotchas #2 and #5.
- Money is always integer minor units; `createTransaction()` (manual add) has a verified currency-hardcode bug — see [project-context.md](./project-context.md) gotcha #1 before touching transaction-creation code.
- Thirteen verified, currently-live gotchas (currency hardcode, alphabetical default account, a hardcoded personal name in both Kotak PDF footer strippers, dead CSV parser code, the multi-account UI gap, two planning-doc contradictions, and more) are catalogued in [project-context.md](./project-context.md#known-gotchas-verified-against-source-2026-09-01) — check that list before assuming unfamiliar behavior is a new bug.
