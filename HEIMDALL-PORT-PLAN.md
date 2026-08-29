# Heimdall port + BMAD refresh

Temporary plan — delete when the full port (Parts 1–3) is done.

## Decisions (locked)

| Choice | Value |
| --- | --- |
| Location | `shared/heimdall` |
| Package name | `@pocket-dimension/heimdall` |
| Package manager | Bun only |
| Publish | Drop Azure — private workspace package |
| BMAD | Full monorepo re-document + copy Heimdall SoR (Part 2 — not started yet) |

Source: `/home/work/compenly/packages/compenly-packages/heimdall`

## Part 1 — Code port — DONE

1. Copied sources into `shared/heimdall` (excluded node_modules, dist, pnpm lock/workspace, Azure .npmrc, version-up.bash)
2. Renamed to `@pocket-dimension/heimdall`; Bun scripts; `private: true`; dropped Azure publish; TS7 + fastify (dev) for typecheck; rewritten package docs
3. Root scripts (`heimdall`, `dev:heimdall`, `build:shared:heimdall`) + `heimdall.config.mjs` + AGENTS notes
4. Verified: typecheck, 235 tests, build, `bun run heimdall doctor`

Dogfood contract tests adapted from Compenly packages layout to Pocket Dimension (Soft-empty OK until Part 2 BMAD).

## Part 2 — BMAD docs (deferred)

- Copy Heimdall SoR → `_bmad-output/heimdall/`
- Full `bmad-document-project` refresh including dashboard + heimdall

## Part 3 — Final sanity (deferred after Part 2)

See Cursor plan `heimdall_port_plan_1b55e1ff` for full detail.
