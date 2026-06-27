# Story 1.2: Integrate shared Better Auth routes

**Epic:** 1 — Platform scaffold and auth integration  
**Status:** done

## User story

**As an** authenticated user,  
**I want** login, sign-up, and password flows,  
**So that** I can access zeo with my Pocket Dimension account.

## Acceptance criteria

- [x] Auth routes match sibling apps: login, sign-up, forgot-password, verify-email, check-email, reset-password
- [x] `.env.example` documents auth env vars including `BETTER_AUTH_SECRET`, `PUBLIC_BASE_AUTH_URL`, `DATABASE_URL`
- [x] Protected routes redirect unauthenticated users to login with `?redirect=`
- [x] Session available in `+layout.server.ts` (id, email, username, role, emailVerified)
- [x] `hooks.server.ts` uses `@pocket-dimension/auth` + `svelteKitHandler`

## Implementation notes

- Home moved to `(protected)/+page.svelte` — `/` requires auth
- `/health` remains public
- Requires `auth-service` on port 5001 and PostgreSQL for session resolution
- Local `vite-kysely-compat.ts` avoids svelte-check errors from root import

## References

- Pattern copied from `apps/me-via-you` / `apps/chhan-chhan`
