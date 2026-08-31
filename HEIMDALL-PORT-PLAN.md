# Heimdall port + BMAD refresh

Temporary plan — delete when the full port is done.

## Decisions (locked)

| Choice | Value |
| --- | --- |
| Location | `apps/heimdall` (first-class app — **not** `shared/`) |
| Package name | `@pocket-dimension/heimdall` |
| Package manager | Bun only |
| Role | Standalone War Room app that serves BMAD docs for this monorepo |
| Publish / host-embed | Not a shared library — private app; Fastify `registerHeimdall` host-embed is secondary/optional at most |
| BMAD | **Incremental** — pick which `_bmad-output` trees / SoR to land first; do **not** full-repo re-document in one pass |

Source (original port): `/home/work/compenly/packages/compenly-packages/heimdall`

## Part 1 — Code port — DONE (originally as `shared/heimdall`)

1. Copied sources into `shared/heimdall` (excluded node_modules, dist, pnpm lock/workspace, Azure .npmrc, version-up.bash)
2. Renamed to `@pocket-dimension/heimdall`; Bun scripts; `private: true`; dropped Azure publish; TS7 + fastify (dev) for typecheck; rewritten package docs
3. Root scripts + `heimdall.config.mjs` + AGENTS notes
4. Verified: typecheck, 235 tests, build, `bun run heimdall doctor`

Dogfood contract tests adapted from Compenly packages layout to Pocket Dimension (Soft-empty OK until BMAD SoR paths exist).

## Part 1b — Relocate to app — DONE

Moved the working tree from `shared/heimdall` → `apps/heimdall` and rewired monorepo DX so Heimdall is an app peer of `dashboard` / `pocket` / etc.

Checklist:

- [x] `git mv shared/heimdall apps/heimdall` (preserve history)
- [x] Update root scripts: `dev:app:heimdall` / `build:app:heimdall`; keep `heimdall` / `dev:heimdall`; drop `build:shared:heimdall`
- [x] Point `heimdall.config.mjs` + AGENTS / package README paths at `apps/heimdall`
- [x] Fix hard-coded `shared/heimdall` paths (dogfood tests, `testRoots`, docs, PUBLISH notes)
- [x] Re-verify: typecheck, tests (235), build, `bun run heimdall doctor`

## Part 1b status: DONE

Heimdall lives at `apps/heimdall`. Soft-empty MISSING BMAD paths remain until incremental Part 2.

## Part 2 — BMAD docs — INCREMENTAL (not full-repo)

Do **not** run a full `bmad-document-project` refresh of the entire monorepo in one go.

Layout contract: **Modules mode** — peer folders under `_bmad-output/` (monorepo + packages + apps). See `_bmad-output/README.md` and `apps/heimdall/docs/AUTHORING.md`.

### Part 2a — Base + monorepo + packages — DONE

1. Deleted disposable flat brownfield dumps under `pocket-dimension/` (kept real planning/implementation artifacts)
2. Rewrote monorepo module docs + deep brownfield for tools (`architecture-monorepo-tools.md`)
3. Full package brownfield: `shared-utils`, `shared-db`, `shared-auth` (overview, architecture, data models, development guides, source trees)
4. Wired modules in `heimdall.config.mjs` (omit FR keys until SoT exists)
5. Scan state: `_bmad-output/pocket-dimension/project-scan-report.json` (2026-08-31 deep, scoped)

### Part 2b — Apps (incremental)

- **watchlist** — DONE (2026-08-31): `_bmad-output/watchlist/` exhaustive deep-dive + full brownfield module docs; wired in `heimdall.config.mjs`

### Part 2c — Remaining (later)

1. Choose next app tree(s) / Heimdall product SoR
2. Land under `_bmad-output/<tree>/`
3. Wire `heimdall.config.mjs` as each tree becomes real
4. Repeat

Still open: `_bmad-output/heimdall/` product SoR, undocumented apps (rhymes, auth-service, …), optional FR files.

## Part 3 — Final sanity (after chosen BMAD slices + relocate)

Doctor/dev smoke against real BMAD paths; clean up temporary plan + stale Soft-empty expectations.

See also Cursor plan `heimdall_port_plan_1b55e1ff` for historical full-detail notes (superseded where this file conflicts).
