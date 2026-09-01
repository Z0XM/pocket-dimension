# Pocket Dimension — Monorepo module

**Heimdall module id:** `pocket-dimension` (label: Monorepo)  
**Scan:** Deep full rescan, 2026-08-31 — scope: monorepo, tools, shared packages  
**Code:** repository root (`apps/**`, `shared/**`, `scripts/**`)

Cross-cutting SoR for the Bun + Turbo monorepo. Package knowledge lives in peer `_bmad-output/shared-*` folders. App SoRs stay in their own trees. Layout contract: [`../README.md`](../README.md).

## Start here

| Doc | Use |
| --- | --- |
| [project-context.md](./project-context.md) | Agent rules for monorepo-wide work |
| [project-overview.md](./project-overview.md) | What the repo is and how parts fit |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated tree |
| [architecture-monorepo-tools.md](./architecture-monorepo-tools.md) | Turbo, scripts, TS, lint, Changesets, deploy, Heimdall CLI |
| [integration-architecture.md](./integration-architecture.md) | Auth, DB, and cross-app edges |
| [development-guide.md](./development-guide.md) | Local setup and day-to-day commands |
| [deployment-guide.md](./deployment-guide.md) | Root-context deploy / PG18 / Railpack |
| [contribution-guide.md](./contribution-guide.md) | Husky, Changesets, BMAD placement |
| [data-models.md](./data-models.md) | Named schemas map (detail in `shared-db`) |
| [project-parts.json](./project-parts.json) | Machine-readable part list |
| [project-scan-report.json](./project-scan-report.json) | Scan state |
| [FEATURE-REGISTRY.md](./FEATURE-REGISTRY.md) | Features SoT (monorepo tooling) |

## Peer modules

| Module folder | Scope |
| --- | --- |
| [`../shared-utils/`](../shared-utils/) | `@pocket-dimension/utils` — full library brownfield |
| [`../shared-db/`](../shared-db/) | `@pocket-dimension/db` — schemas, migrations, client |
| [`../shared-auth/`](../shared-auth/) | `@pocket-dimension/auth` — Better Auth config |
| [`../watchlist/`](../watchlist/) | `apps/watchlist` — exhaustive deep-dive + brownfield (2026-08-31) |
| [`../chhan-chhan/`](../chhan-chhan/) | `apps/chhan-chhan` — exhaustive deep-dive + module-root brownfield (2026-09-01) |

## Existing app trees

| Module | Notes |
| --- | --- |
| [`../zeo/`](../zeo/) | Product SoR kept |
| [`../heimdall/`](../heimdall/) | Product SoR incremental / Soft-empty |

## Deep-Dive Documentation

Detailed exhaustive analysis of specific areas:

- [watchlist Deep-Dive](../watchlist/deep-dive-watchlist.md) — `apps/watchlist` — Generated 2026-08-31
- [chhan-chhan Deep-Dive](../chhan-chhan/deep-dive-chhan-chhan.md) — `apps/chhan-chhan` — Generated 2026-09-01

## Planning & delivery in this tree

- [planning-artifacts/](./planning-artifacts/) — epics, architecture, PRDs, UX (rhymes / dashboard tracks)
- [implementation-artifacts/](./implementation-artifacts/) — stories, sprint status

Feature Registry: [FEATURE-REGISTRY.md](./FEATURE-REGISTRY.md) (wired as `featureRegistry` in `heimdall.config.mjs`).
