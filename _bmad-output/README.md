# BMAD output (Heimdall Modules layout)

Heimdall runs in **Modules mode**. Each durable scope is a **peer folder** under `_bmad-output/` — not a flat dump of `architecture-*.md` files in one tree.

```
_bmad-output/
  README.md                 # this file — layout contract
  pocket-dimension/         # Monorepo module (cross-cutting + tools)
  shared-utils/             # @pocket-dimension/utils (brownfield complete)
  shared-db/                # @pocket-dimension/db (brownfield complete)
  shared-auth/              # @pocket-dimension/auth (brownfield complete)
  watchlist/                # apps/watchlist (brownfield + deep-dive complete)
  zeo/                      # apps/zeo product SoR
  chhan-chhan/              # apps/chhan-chhan product SoR
  heimdall/                 # apps/heimdall product SoR (incremental)
```

**Last deep scan (monorepo + tools + packages):** 2026-08-31 — see `pocket-dimension/project-scan-report.json`.

Wire new scopes in root `heimdall.config.mjs` (`modules[].id` + `basePath`). Docs are indexed via `paths.docsRoot` + `docs.extraRoots: ["_bmad-output"]`.

## Per-module folder shape

```
_bmad-output/<module-id>/
  index.md                  # AI/human entry
  project-context.md        # agent rules for this scope
  # optional brownfield / ops docs (architecture, guides, …)
  planning-artifacts/       # PRDs, architecture, UX, epics
  implementation-artifacts/ # stories, sprint-status
  FEATURE-REGISTRY.md       # only when Features SoT exists — never empty placeholders
```

**Do not** create empty `FEATURE-REGISTRY.md`, intake, or deferred indexes just to satisfy config. Omit those keys in `heimdall.config.mjs` until real content exists (Soft-empty is expected).

**Do not** write BMAD artifacts to a repo-root `docs/` folder.

## What belongs where

| Work | Put it in |
| --- | --- |
| Monorepo-wide / rhymes–dashboard planning already here | `pocket-dimension/` |
| Shared package behavior or contracts | `shared-utils/` · `shared-db/` · `shared-auth/` |
| App-only product work | `_bmad-output/<app>/` (e.g. `zeo/`, `chhan-chhan/`) |
| Heimdall War Room product SoR | `heimdall/` (Part 2 incremental) |

Default BMAD config (`_bmad/bmm/config.yaml` + `_bmad/custom/config.toml`) points at **pocket-dimension**. For an app-only workflow, temporarily retarget `planning_artifacts` / `implementation_artifacts` / `project_knowledge`, then restore the default.

## Heimdall

```bash
bun run heimdall doctor   # path OK / MISSING (informational Soft-empty)
bun run heimdall dev      # War Room http://127.0.0.1:5174/
```

Authoring contract: `apps/heimdall/docs/AUTHORING.md`.
