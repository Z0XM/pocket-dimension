# Architecture — chhan-chhan

**Type:** web  
**Path:** `apps/chhan-chhan`  
**Port:** 3005

## Executive Summary

Personal finance ledger: Indian bank statement import, categorization, refunds, dashboards. Auth + schema `chhanchhan`. Multi-account is designed in DB/API but UI still uses a default account.

## Do not duplicate

This part already has a Deep brownfield pack:

**[`_bmad-output/chhan-chhan/planning-artifacts/index.md`](../chhan-chhan/planning-artifacts/index.md)**

| Doc | Path |
| --- | --- |
| Architecture | `../chhan-chhan/planning-artifacts/architecture.md` |
| API | `../chhan-chhan/planning-artifacts/api-contracts.md` |
| Data models | `../chhan-chhan/planning-artifacts/data-models.md` |
| Components | `../chhan-chhan/planning-artifacts/component-inventory.md` |
| Dev guide | `../chhan-chhan/planning-artifacts/development-guide.md` |
| Agent rules | `../chhan-chhan/project-context.md` |
| Import ops | `apps/chhan-chhan/IMPORT.md` |

## Technology / pattern (summary)

Bun, SvelteKit 2, Drizzle, Better Auth. Money in **paise**. Mutations: `requireUser` → `getMembershipOrThrow` → `canEdit`. Importers: kotak, icici, hdfc, generic.

## Testing

`bun test src/lib/importers/` inside the app.
