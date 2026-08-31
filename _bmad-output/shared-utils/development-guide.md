# Development Guide — `@pocket-dimension/utils`

```bash
bun run build:shared:utils
# or: cd shared/utils && bun run build

cd shared/utils
bun run typecheck   # tsgo --noEmit
bun run lint        # prettier --check .
```

## Adding env keys for an app

1. Define a Zod object in the app’s `env.ts`.
2. Call `validateEnv("my-app", schema)` (or wrap in Proxy like `shared/db`).
3. Do **not** add app-specific keys to this package.

## Conventions

- Throw-on-invalid is intentional — fail fast at boot or first access.
- Keep the package one-file unless there is a strong reason to split.
