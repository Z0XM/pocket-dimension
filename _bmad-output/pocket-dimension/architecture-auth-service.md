# Architecture — auth-service

**Type:** backend  
**Path:** `apps/auth-service`  
**Port:** 5001

## Executive Summary

Thin Elysia HTTP facade over `@pocket-dimension/auth`. Frontends use it as `PUBLIC_BASE_AUTH_URL`. Bun runs TypeScript directly.

## Technology Stack

Elysia 1.4, `@elysiajs/cors`, `@elysiajs/swagger`, workspace auth/db/utils.

## Architecture Pattern

API-centric: routes map 1:1 to Better Auth APIs. Macros `auth` / `authVerified` for protected endpoints.

## API Design

See [api-contracts-auth-service.md](./api-contracts-auth-service.md).

## Source Tree

```
apps/auth-service/src/
├── index.ts
├── lib/env.ts
├── routes/auth.ts
└── middlewares/auth.ts
```

## Development

`bun run dev:app:auth` after shared packages are built. Needs `DATABASE_URL`, matching `BETTER_AUTH_*`, non-empty `RESEND_API_KEY`.

## Deployment

Dockerfile from repo root. See [deployment-guide.md](./deployment-guide.md) and `apps/auth-service/DEPLOY.md`.

## Testing

`vitest run --passWithNoTests` — no test files.
