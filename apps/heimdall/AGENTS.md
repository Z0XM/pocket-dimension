# Heimdall Agent Guide

## Overview

- App: `@pocket-dimension/heimdall` (`apps/heimdall`)
- Purpose: BMAD / docs War Room (SPA + CLI) for this monorepo
- CLI: `bin/heimdall.cjs` → `dist/cli.cjs` (`init` · `dev` · `doctor` · `build`)
- UI: Vite/React under `src/` → `dist/ui/`
- API: `server/` (dashboard / docs / stories / optional Tests when `pages.tests`)
- Sample/Data: **host deep-link only** via `links.sample` — never Sample Mode inside this app

## Tooling

```bash
cd apps/heimdall
bun install          # from monorepo root preferred
bun run typecheck    # TypeScript 7 — tsc --noEmit
bun run test         # vitest (contract tests)
bun run build        # dist/host.cjs + dist/cli.cjs + dist/ui/
bun run check        # typecheck + test + build
```

Monorepo root:

```bash
bun run heimdall init|doctor|dev
bun run dev:app:heimdall
bun run build:app:heimdall
```

Production (after build):

```bash
cd apps/heimdall && bun run start   # PORT=3012, Fastify + dist/ui
```

Deploy artifacts: `Dockerfile`, `railpack.json`, `scripts/deploy-build.sh`, `DEPLOY.md`, `.env.example`.

CLI `dev` / `build` resolve the Vite binary with `src/lib/resolveViteBin.ts` (nested `node_modules` **or** Node resolution) so workspace installs work. Vite also pre-bundles markdown/`style-to-js` deps and allows consumer `node_modules` in `server.fs.allow` for the same layouts.

## Rules (do not violate)

- Product settings in repo-root `heimdall.config.ts` / `.mjs` — not Heimdall-specific env product APIs
- **No hardcoded host env names** (e.g. `APP_BASE_PATH`) in this app; effective base via `runtime.basePath`, `registerHeimdall({ basePath })`, or optional consumer-named `runtime.basePathFromEnv`
- Default mount segment `/heimdall`
- Optional Tests page when `pages.tests` (RunnerAdapter for runs)
- `pages.testLevels` gates which levels appear (omit = all; dogfood may use `["L1"]`)
- Standalone `heimdall dev` wires a Vitest-only **dogfood** `RunnerAdapter` (`server/dogfoodVitestRunner.ts`). Omitting runners → `available: false`. L5/UI stays unavailable in dogfood.
- No in-app Sample Data page, Prisma, or sample-mode reverse imports — use `links.sample` only
- Soft-empty when parsers/paths mismatch — never crash
- Built-in epic parsers: `numeric` (legacy numeric epics) and `bmad-output` (`_bmad-output` BMAD Method shapes)
- Feature areas come from Feature Registry `- **Area:**` only (no built-in product catalog)

## Pocket Dimension dogfood (repo root)

- Config: `heimdall.config.mjs` at monorepo root
- Root DX: `bun run heimdall doctor` / `bun run heimdall dev` → `apps/heimdall/bin/heimdall.cjs` (CLI walks up to root config)
- Alternate: `cd apps/heimdall && node ./bin/heimdall.cjs doctor` / `dev`
- Contract smoke: `server/packagesDogfood.contract.test.ts` (Soft-empty OK until Part 2 BMAD lands)

## Docs

- App authoring: `docs/AUTHORING.md`
- Planning SoR: `_bmad-output/heimdall/` (incremental Part 2)
