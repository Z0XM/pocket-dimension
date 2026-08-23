# Architecture — shared-utils

**Type:** library  
**Path:** `shared/utils`  
**Package:** `@pocket-dimension/utils`

## Executive Summary

Single-file Zod helper. Every other shared package and most apps call `validateEnv` so missing env fails at boot, not mid-request.

## Technology Stack

| Category | Technology |
| --- | --- |
| Language | TypeScript |
| Validation | Zod 4 |
| Build | `bun build` → `dist/index.js` |

## Architecture Pattern

Pure library. No I/O besides reading `Bun.env`.

## Public API

- `baseEnvSchema` — `NODE_ENV`
- `validateEnv(source, appEnvSchema, env)` — merge + parse

## Source Tree

```
shared/utils/src/index.ts
```

## Development / Deploy

Built before dependents (`bun run build:shared:utils`). No runtime deploy of its own.

## Testing

None.
