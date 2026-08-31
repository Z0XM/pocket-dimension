# Architecture — `@pocket-dimension/auth`

## Purpose

Shared Better Auth configuration used by auth-service (HTTP) and auth-backed app server hooks (session).

## Stack

| Item | Value |
| --- | --- |
| Library | better-auth |
| Adapter | Drizzle → `@pocket-dimension/db` |
| Email | Resend |
| Plugins | `magicLink` (15m), `username` (3–20 alnum, lowercased) |

## Public API

Only **`auth`** is exported from `shared/auth/src/index.ts`. Env and email helpers are internal.

## Config highlights

- Email/password with verification required; reset token TTL 1h; auto sign-in after verify
- Session: 30d `expiresIn`, 1d `updateAge`
- Cookies: `secure`, `httpOnly`, `sameSite: "none"`, `useSecureCookies: true`, prefix `better-auth`, optional cross-subdomain via `BETTER_AUTH_COOKIE_DOMAIN`
- Extra user field: `role` enum with default `user`
- Eager env at import: secrets, trusted origins, Resend key/from

## Consumer patterns

| Role | Pattern |
| --- | --- |
| auth-service | Elysia routes → `auth.api.*` on :5001 |
| SvelteKit server | `import { auth } from "@pocket-dimension/auth"` in `hooks.server.ts` |
| SvelteKit browser | `better-auth/svelte` client → `PUBLIC_BASE_AUTH_URL` |

## Build / deps

```bash
bun run build:shared:auth
```

Depends on `@pocket-dimension/db`, `@pocket-dimension/utils`, `better-auth`, `resend`.

## Local caveat

Over plain `http://localhost`, browsers may refuse the secure cross-site cookies — sessions often do not stick. Signup can still create users; verifying email may require flipping `email_verified` in DB when delivery is disabled.
