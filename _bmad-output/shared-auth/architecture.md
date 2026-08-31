# Architecture — `@pocket-dimension/auth`

## Public API

```ts
import { auth } from "@pocket-dimension/auth";
```

Single export. `lib/env.ts` and `lib/emails.ts` are internal.

## Better Auth config (`src/index.ts`)

| Area | Setting |
| --- | --- |
| baseURL / basePath | from env |
| trustedOrigins | comma-split `BETTER_AUTH_TRUSTED_ORIGINS` |
| Database | `drizzleAdapter(db, { provider: "pg" })` |
| generateId | `false` (DB uuidv7) |
| User field `role` | enum, default `user`, not client-input, returned |
| Email/password | enabled; require verification; reset TTL 1h |
| Session | expiresIn 30d; updateAge 1d (sliding via get-session) |
| Email verification | sendOnSignUp; TTL 1h; autoSignInAfterVerification |
| Cookies | prefix `better-auth`; secure; httpOnly; sameSite none; useSecureCookies; cross-subdomain via COOKIE_DOMAIN |
| Plugins | `magicLink` (15m, signup allowed); `username` (3–20 alnum, lowercased) |

## Env (eager)

Required: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_PATH`, `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_COOKIE_DOMAIN`, `RESEND_API_KEY`.  
Optional default: `RESEND_FROM_EMAIL` → `noreply@example.com`.  
Plus `NODE_ENV` from utils base schema.

## Emails (`lib/emails.ts`)

- `new Resend(RESEND_API_KEY)` at module load → empty key crashes.
- `sendVerificationEmail`, `sendResetPasswordEmail`, `sendMagicLinkEmail` — HTML templates.
- Called with `void` from auth hooks (fire-and-forget). Delivery failures log + rethrow inside sendEmail, but callers do not await — signup still succeeds with placeholder keys.

## Consumer patterns

### auth-service

Elysia routes wrap `auth.api.*` (`sign-up/email`, `sign-in/email`, `sign-in/username`, session, reset, verify, forgot, sign-out, …). Macros: `auth`, `authVerified`. CORS credentials on. Port **5001**.

### SvelteKit hooks (canonical)

```ts
const session = await auth.api.getSession({ headers: event.request.headers });
// populate event.locals.user / session
return svelteKitHandler({ event, resolve, auth, building });
```

Route groups: `/(auth)/` and `/(protected)/` with verify-email allowlist for unverified users.

## Local cookie caveat

`secure` + `sameSite: none` unconditionally → browsers often refuse cookies on `http://localhost`. Signup API works; session stickiness and email verify usually need DB `email_verified` flips when Resend is placeholder.
