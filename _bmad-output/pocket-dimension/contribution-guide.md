# Contribution Guide — Pocket Dimension

## Defaults

- Match neighboring app patterns (SvelteKit hooks, env validation, named DB schemas).
- Build shared packages before running or testing apps.
- Prefer small, focused changes; do not invent parallel auth/DB stacks.

## BMAD placement

| Change type | Artifact location |
| --- | --- |
| Monorepo-wide / rhymes–dashboard tracks already here | `_bmad-output/pocket-dimension/` |
| Shared package | `_bmad-output/shared-{utils,db,auth}/` |
| App-only | `_bmad-output/<app>/` |
| Heimdall product | `_bmad-output/heimdall/` |

Do not add competing Feature Registries under durable docs. Configure FR paths in `heimdall.config.mjs` only when real SoT files exist.

## Versioning

Changesets live in `.changeset/` for workspace package versioning when publishing matters.

## Quality

- `bun run typecheck` where defined
- App tests: e.g. `apps/zeo` (`bun test src`), `apps/heimdall` (`bun run test`), chhan-chhan importers
- Heimdall: Soft-empty missing BMAD paths — do not treat `heimdall doctor` MISSING warnings as ship-blockers
