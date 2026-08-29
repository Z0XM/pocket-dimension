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

Instead:

1. Choose which module(s) / trees to document first (e.g. Heimdall SoR only, or one app like dashboard / zeo)
2. Land that slice under the right `_bmad-output/<tree>/`
3. Wire / Soft-empty via `heimdall.config.mjs` modules as each tree becomes real
4. Repeat for the next chosen tree when ready

Candidate trees (decide order later): `_bmad-output/heimdall/` (Heimdall product SoR), existing `pocket-dimension` / `zeo` / `chhan-chhan`, plus any not-yet-documented apps.

## Part 3 — Final sanity (after chosen BMAD slices + relocate)

Doctor/dev smoke against real BMAD paths; clean up temporary plan + stale Soft-empty expectations.

See also Cursor plan `heimdall_port_plan_1b55e1ff` for historical full-detail notes (superseded where this file conflicts).
