# Pocket Dimension — Monorepo module

**Heimdall module id:** `pocket-dimension` (label: Monorepo)  
**Code:** repository root (`apps/**`, `shared/**`, `scripts/**`)  
**Last refreshed:** 2026-08-31

Cross-cutting SoR for the Bun + Turbo monorepo. App- and package-specific knowledge lives in peer folders under `_bmad-output/` — see [`../README.md`](../README.md).

## Start here

| Doc | Use |
| --- | --- |
| [project-context.md](./project-context.md) | Agent rules for monorepo-wide work |
| [project-overview.md](./project-overview.md) | What the repo is and how parts fit |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated tree |
| [integration-architecture.md](./integration-architecture.md) | Auth, DB, and cross-app edges |
| [development-guide.md](./development-guide.md) | Local setup and day-to-day commands |
| [deployment-guide.md](./deployment-guide.md) | Root-context deploy / PG18 / Railpack |
| [contribution-guide.md](./contribution-guide.md) | Conventions and BMAD placement |
| [data-models.md](./data-models.md) | Named schemas map (detail in `shared-db`) |
| [project-parts.json](./project-parts.json) | Machine-readable part list |

## Peer modules (packages + apps)

| Module folder | Scope |
| --- | --- |
| [`../shared-utils/`](../shared-utils/) | `@pocket-dimension/utils` |
| [`../shared-db/`](../shared-db/) | `@pocket-dimension/db` |
| [`../shared-auth/`](../shared-auth/) | `@pocket-dimension/auth` |
| [`../zeo/`](../zeo/) | `apps/zeo` |
| [`../chhan-chhan/`](../chhan-chhan/) | `apps/chhan-chhan` |
| [`../heimdall/`](../heimdall/) | `apps/heimdall` (SoR incremental) |

Undocumented apps (watchlist, rhymes, howwasyourday, me-via-you, markitdown, pocket, dashboard, auth-service, zeo-music-worker) get their own `_bmad-output/<id>/` trees when documented — do not dump their architecture into this folder.

## Planning & delivery in this tree

Existing monorepo / rhymes / dashboard planning stays here:

- [planning-artifacts/](./planning-artifacts/) — epics, architecture, PRDs, UX
- [implementation-artifacts/](./implementation-artifacts/) — stories, sprint status

Feature Registry for this module is not authored yet; Heimdall Soft-empties Features until `FEATURE-REGISTRY.md` exists at the configured path.
