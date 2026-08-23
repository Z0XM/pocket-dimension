# Architecture — shared-auth

**Type:** library  
**Path:** `shared/auth`  
**Package:** `@pocket-dimension/auth`

## Executive Summary

One Better Auth instance used by auth-service (HTTP) and SvelteKit apps (SSR session). Email/password, username, magic link, Resend mailers. IDs come from the database (`generateId: false`).

## Technology Stack

| Category | Technology |
| --- | --- |
| Auth | Better Auth 1.4 + drizzleAdapter |
| Email | Resend (`RESEND_API_KEY` required at module load) |
| DB | `@pocket-dimension/db` |

## Architecture Pattern

Configured singleton. Not a framework — consumers call `auth.api.*` or `svelteKitHandler`.

## Auth / security

- Email verification required; 1h tokens; auto sign-in after verify
- Session 30 days, sliding 1-day update
- Cookies: `better-auth` prefix, `secure`, `httpOnly`, `sameSite: none`, optional cookie domain
- Extra user field `role`: `user` | `contributor` | `admin` (not client-settable)
- Trusted origins from `BETTER_AUTH_TRUSTED_ORIGINS`

## How apps consume it

1. **SSR:** `hooks.server.ts` → `getSession` + `svelteKitHandler`
2. **Browser:** `createAuthClient({ baseURL: PUBLIC_BASE_AUTH_URL })`
3. **auth-service:** Elysia wrappers around `auth.api.*`

## Development / Deploy

`bun run build:shared:auth`. Deployed only as part of auth-service or app images.

## Testing

None.
