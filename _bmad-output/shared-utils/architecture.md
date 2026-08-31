# Architecture — `@pocket-dimension/utils`

## Purpose

Shared Zod-based environment validation.

## Public API (`src/index.ts`)

### `baseEnvSchema`

```ts
z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});
```

### `validateEnv(source, appEnvSchema, env?)`

| Arg | Role |
| --- | --- |
| `source` | Log label (`Validating environment variables from ${source}`) |
| `appEnvSchema` | Consumer `z.object({...})` |
| `env` | Defaults to `Bun.env` |

Behavior:

1. Logs unconditionally to stdout.
2. Merges `baseEnvSchema.extend(appEnvSchema.shape)` — consumer always gets `NODE_ENV` (default `development`). Consumer `NODE_ENV` key silently overrides base.
3. `schema.parse(env)` — **throws** on failure (no Result type).
4. Returns typed parsed object. No internal cache.

## Failure modes

- Missing/invalid required vars → process crash at call site.
- Typo in `NODE_ENV` fails enum even if consumer did not declare it.
- Bun-typed (`typeof Bun.env`); logic works with any string-map if passed explicitly.
- No coercion beyond consumer Zod transforms.

## Package shape

| Field | Value |
| --- | --- |
| `main` | `./dist/index.js` |
| `types` | `./src/index.ts` (source types, not emitted `.d.ts`) |
| `exports["."]` | types → src, default → dist |
| Scripts | `build`, `clean`, `lint` (prettier), `typecheck` (`tsgo --noEmit`) |
| Tests | none |

## Patterns for consumers

| Pattern | Example |
| --- | --- |
| Lazy Proxy + memoized `validateEnv` | `shared/db/src/lib/env.ts` |
| Eager top-level `validateEnv` | `shared/auth/src/lib/env.ts` |
| App local `env.ts` | auth-service, zeo, pocket, markitdown |
