# Architecture — `@pocket-dimension/utils`

## Purpose

Shared Zod-based environment validation for apps and sibling packages.

## Stack

| Item | Value |
| --- | --- |
| Language | TypeScript |
| Runtime build target | Bun (`bun build` → `dist/`) |
| Dependency | `zod` ^4 |

## Public API

Source: `shared/utils/src/index.ts`.

| Export | Role |
| --- | --- |
| `baseEnvSchema` | `{ NODE_ENV: development \| production \| test }` (default `development`) |
| `validateEnv(source, appEnvSchema, env?)` | Merges `baseEnvSchema` with app schema, parses env (default `Bun.env`), logs `source` |

## Build

```bash
bun run build:shared:utils
# package: bun build ./src/index.ts --outdir ./dist --format esm --target bun --external zod
```

`package.json`: `main` → `./dist/index.js`, `types` → `./src/index.ts`.

## Consumers

Direct: auth-service, watchlist, howwasyourday, zeo, pocket, markitdown (local `env.ts`).  
Transitive: `shared/db`, `shared/auth`.

```ts
import { validateEnv } from "@pocket-dimension/utils";
```

## Tests

No dedicated test suite in this package today.
