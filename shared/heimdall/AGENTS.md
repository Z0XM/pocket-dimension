# Heimdall Agent Guide

## Overview

- Package: `@pocket-dimension/heimdall` (private workspace — `shared/heimdall`)
- Purpose: BMAD / docs War Room (SPA + CLI), repo-agnostic
- Host embed: `registerHeimdall` from `@pocket-dimension/heimdall` / `@pocket-dimension/heimdall/host`
- CLI: `bin/heimdall.cjs` → `dist/cli.cjs` (`init` · `dev` · `doctor` · `build`)
- UI: Vite/React under `src/` → `dist/ui/`
- API: `server/` (dashboard / docs / stories / optional Tests when `pages.tests`)
- Sample/Data: **host deep-link only** via `links.sample` — never Sample Mode inside this package

## Tooling

```bash
cd shared/heimdall
bun install          # from monorepo root preferred
bun run typecheck    # TypeScript 7 — tsc --noEmit
bun run test         # vitest (contract tests)
bun run build        # dist/host.cjs + dist/cli.cjs + dist/ui/
bun run check        # typecheck + test + build
```

Consumer (monorepo root):

```bash
bun run heimdall init|doctor|dev
```

CLI `dev` / `build` resolve the Vite binary with `src/lib/resolveViteBin.ts` (nested `node_modules` **or** Node resolution) so workspace/`file:` installs work. Vite also pre-bundles markdown/`style-to-js` deps and allows consumer `node_modules` in `server.fs.allow` for the same layouts.

## Rules (do not violate)

- Product settings in consumer `heimdall.config.ts` / `.mjs` — not Heimdall-specific env product APIs
- **No hardcoded host env names** (e.g. `APP_BASE_PATH`) in this package; host supplies effective base via `runtime.basePath`, `registerHeimdall({ basePath })`, or optional consumer-named `runtime.basePathFromEnv`
- Default mount segment `/heimdall`
- Optional Tests page when `pages.tests` (host RunnerAdapter for runs)
- `pages.testLevels` gates which levels appear (omit = all; dogfood may use `["L1"]`)
- Standalone `heimdall dev` wires a Vitest-only **dogfood** `RunnerAdapter` (`server/dogfoodVitestRunner.ts`). Host embeds still inject via `registerHeimdall({ runners })` (AD-14); omitting runners → `available: false`. L5/UI stays unavailable in dogfood.
- No in-app Sample Data page, Prisma, or sample-mode reverse imports — use `links.sample` for host Sample UI only
- Soft-empty when parsers/paths mismatch — never crash
- Built-in epic parsers: `numeric` (legacy numeric epics) and `bmad-output` (`_bmad-output` BMAD Method shapes)
- Feature areas come from Feature Registry `- **Area:**` only (no built-in product catalog)

## Host embed notes

A product host may:

- Depend on `@pocket-dimension/heimdall` via workspace
- Register via a Fastify plugin → `/heimdall`
- Keep a separate Sample/Studio package and deep-link with `links.sample`
- Set `basePathFromEnv` to a **host-owned** env name (Heimdall never invents one)

## Pocket Dimension dogfood (repo root)

- Config: `heimdall.config.mjs` at monorepo root
- Root DX: `bun run heimdall doctor` / `bun run heimdall dev` → `shared/heimdall/bin/heimdall.cjs` (CLI walks up to root config)
- Alternate: `cd shared/heimdall && node ./bin/heimdall.cjs doctor` / `dev`
- Contract smoke: `server/packagesDogfood.contract.test.ts` (may still reference historical Compenly fixtures — Soft-empty OK until Part 2 BMAD lands)

## Docs

- Package authoring: `docs/AUTHORING.md`
- Planning SoR: `_bmad-output/heimdall/` (after Part 2)
