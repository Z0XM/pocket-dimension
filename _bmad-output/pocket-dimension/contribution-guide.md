# Contribution Guide — Pocket Dimension

## Defaults

- Match neighboring app patterns (SvelteKit hooks, env validation, named DB schemas).
- Build shared packages before running or testing apps.
- Prefer small, focused changes; do not invent parallel auth/DB stacks.
- Format with **Prettier** (root README Biome/`check` references are stale).

## Pre-commit (local gate — no CI)

1. `lint-staged` → Prettier write on staged files  
2. `turbo typecheck --filter='[HEAD^1]'`  
3. `turbo build --filter='[HEAD^1]'` (unless `SKIP_PRE_COMMIT_BUILD=1`; skips `@pocket-dimension/scripts`)

## Changesets

For versionable workspace changes: `bun run changeset` → `bun run version` → `bun run release`. Config: `.changeset/` (`access: restricted`, `baseBranch: main`). No automated publish CI today.

## BMAD placement

| Change type | Artifact location |
| --- | --- |
| Monorepo / tools | `_bmad-output/pocket-dimension/` |
| Shared package | `_bmad-output/shared-{utils,db,auth}/` |
| App-only | `_bmad-output/<app>/` |
| Heimdall product | `_bmad-output/heimdall/` |

Do not create empty Feature Registries. Configure FR paths in `heimdall.config.mjs` only when real SoT exists.

## Quality commands

```bash
bun run typecheck
bun run test
bun run format:check
bun run heimdall doctor   # Soft-empty MISSING is informational
```
