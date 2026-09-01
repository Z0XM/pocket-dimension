# watchlist — BMAD module

**App:** `@pocket-dimension/watchlist`
**Code:** `apps/watchlist`
**Port:** 3002 (dev and prod)
**Heimdall module id:** `watchlist`
**Scan:** Deep brownfield, 2026-08-31

Personal movie/series/shorts watchlist with per-user ratings, tags, saved views, a dashboard, and a leaderboard — built on the shared `@pocket-dimension/{auth,db}` stack. See [project-overview.md](./project-overview.md) for the full product summary.

| Doc | Use |
| --- | --- |
| [project-context.md](./project-context.md) | Agent rules — build order, env, permission model, verified gotchas |
| [project-overview.md](./project-overview.md) | Product purpose, features, roles, stack, ports |
| [architecture.md](./architecture.md) | Route structure, auth flow, server libs, data table architecture, role permissions, PWA, `@pocket-dimension/{auth,db}` integration |
| [api-contracts.md](./api-contracts.md) | Every `/api/**` endpoint — method, auth, params, response, errors |
| [data-models.md](./data-models.md) | `watchlist` Postgres schema usage, table-by-table, which app code touches each |
| [development-guide.md](./development-guide.md) | Local setup, env vars, `dev`/`check`/`build`/`start`, common pitfalls |
| [deployment-guide.md](./deployment-guide.md) | Dockerfile/Railpack deploy from the monorepo root, troubleshooting |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated file tree (`src/routes`, `src/lib`) |
| [component-inventory.md](./component-inventory.md) | Feature components, `data-table-helpers/*`, `ui/*` primitive groups |
| [deep-dive-watchlist.md](./deep-dive-watchlist.md) | Exhaustive file-by-file review (every route, every `data-table-helpers/*` file, every feature component) — the source for most findings summarized in the docs above |
| [FEATURE-REGISTRY.md](./FEATURE-REGISTRY.md) | Features SoT (brownfield capability inventory) |

Monorepo map: [`../pocket-dimension/index.md`](../pocket-dimension/index.md). Shared package docs: [`../shared-db/`](../shared-db/) (schema/client), [`../shared-auth/`](../shared-auth/) (Better Auth config).

## Fast facts for a new agent

- Build `@pocket-dimension/{utils,db,auth}` **before** running/checking/building this app — see [development-guide.md](./development-guide.md).
- The only mutation path for the watchlist table is `POST /api/watchlist/bulk-update` — see [api-contracts.md](./api-contracts.md).
- Role gating (`user`/`contributor`/`admin`/synthetic `mobile`) is defined once in `edit-mode.svelte.ts` and re-enforced server-side in `bulk-update`; don't add a third copy — see [architecture.md](./architecture.md#role-permissions).
- Five verified, currently-live issues (a bulk-edit-panel crash, two orphaned components, a dead route, and a missing `src/lib/auth.ts` masked by `skipLibCheck`) are catalogued in [project-context.md](./project-context.md#known-gotchas-verified-against-source-2026-08-31) — check that list before assuming unfamiliar behavior is a new bug.

No planning/implementation artifacts exist yet for this module — `planning-artifacts/` and `implementation-artifacts/` subfolders are intentionally omitted until real PRD/story content exists (see `_bmad-output/README.md`'s layout contract). Feature Registry is authored at [FEATURE-REGISTRY.md](./FEATURE-REGISTRY.md) and wired in `heimdall.config.mjs`.
