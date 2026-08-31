# shared-utils — Project Context

**Package:** `@pocket-dimension/utils`  
**Path:** `shared/utils`

## Rules

- Keep this package tiny — env validation only unless there is a clear cross-app need.
- Depend on Zod; do not pull DB/auth into utils.
- Consumers import from `@pocket-dimension/utils` after `bun run build` (or `build:shared:utils`).
- Prefer extending `validateEnv` usage in app `env.ts` files over forking env parsing.

## When not to change this package

App-specific constants, UI helpers, or auth/DB logic belong in the app or in `shared-auth` / `shared-db`.
