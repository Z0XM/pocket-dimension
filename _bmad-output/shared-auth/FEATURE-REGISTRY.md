# Feature Registry — `@pocket-dimension/auth`

Brownfield capability inventory for `shared/auth`. Derived from deep scan 2026-08-31 — see [architecture.md](./architecture.md).

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Better Auth core config | n/a | Platform | Epic 1 | Live |
| F-2 | Drizzle adapter + uuidv7 ids | n/a | Platform | Epic 1 | Live |
| F-3 | Email / password auth | n/a | Platform | Epic 1 | Live |
| F-4 | Username plugin | n/a | Platform | Epic 1 | Live |
| F-5 | Magic link plugin | n/a | Platform | Epic 1 | Live |
| F-6 | Session & cookie policy | n/a | Platform | Epic 1 | Live |
| F-7 | Resend transactional email | n/a | Platform | Epic 1 | Live |
| F-8 | Eager env validation | n/a | Platform | Epic 1 | Live |
| F-9 | Consumer integration patterns | n/a | Platform | Epic 1 | Live |

## Feature details

### F-1 — Better Auth core config

- **Goal:** Single shared `auth` export used by auth-service and SvelteKit hooks.
- **Area:** Auth core
- **Includes:**
  - `baseURL` / `basePath` / `trustedOrigins` from env
  - User `role` field (enum, default `user`, server-only input)
- **Deferred:**
  - Multi-tenant auth orgs
- **See also:**
  - [architecture.md](./architecture.md#better-auth-config-srcindexts)

### F-2 — Drizzle adapter + uuidv7 ids

- **Goal:** Persist auth entities via `@pocket-dimension/db` without client-generated ids.
- **Area:** Persistence
- **Includes:**
  - `drizzleAdapter(db, { provider: "pg" })`
  - `generateId: false` → DB `uuidv7()`
- **Deferred:**
  - None currently.
- **See also:**
  - `_bmad-output/shared-db/FEATURE-REGISTRY.md` (F-5 Auth schema)

### F-3 — Email / password auth

- **Goal:** Sign-up and sign-in with email verification required.
- **Area:** Credentials
- **Includes:**
  - Email/password enabled; require verification; reset TTL 1h
  - `sendOnSignUp`; autoSignInAfterVerification
- **Deferred:**
  - OAuth social providers (schema supports accounts; not configured)
- **See also:**
  - [project-overview.md](./project-overview.md)

### F-4 — Username plugin

- **Goal:** Allow username-based sign-in alongside email.
- **Area:** Credentials
- **Includes:**
  - Username 3–20 alphanumeric, lowercased
  - `username` / `displayUsername` on user
- **Deferred:**
  - None currently.
- **See also:**
  - [architecture.md](./architecture.md)

### F-5 — Magic link plugin

- **Goal:** Passwordless sign-in / sign-up via emailed link.
- **Area:** Credentials
- **Includes:**
  - Magic link TTL 15m; signup allowed
  - `sendMagicLinkEmail` via Resend
- **Deferred:**
  - None currently.
- **See also:**
  - F-7 Resend transactional email

### F-6 — Session & cookie policy

- **Goal:** Cross-subdomain session cookies for auth-backed apps.
- **Area:** Session
- **Includes:**
  - Session expiresIn 30d; updateAge 1d
  - Cookies: prefix `better-auth`, secure, httpOnly, sameSite none, COOKIE_DOMAIN
- **Deferred:**
  - Dev-friendly insecure cookies for plain `http://localhost` (known local caveat)
- **See also:**
  - [architecture.md](./architecture.md#local-cookie-caveat)

### F-7 — Resend transactional email

- **Goal:** Send verification, password-reset, and magic-link emails.
- **Area:** Email
- **Includes:**
  - `new Resend(RESEND_API_KEY)` at module load (non-empty key required to boot)
  - HTML templates for verification / reset / magic link
  - Fire-and-forget from auth hooks (signup succeeds with placeholder keys)
- **Deferred:**
  - Lazy Resend client so empty keys do not crash import
- **See also:**
  - [architecture.md](./architecture.md#emails-libemailsts)

### F-8 — Eager env validation

- **Goal:** Fail fast at package load when auth env is incomplete.
- **Area:** Env
- **Includes:**
  - Required: SECRET, URL, PATH, TRUSTED_ORIGINS, COOKIE_DOMAIN, RESEND_API_KEY
  - Optional: RESEND_FROM_EMAIL default
- **Deferred:**
  - None currently.
- **See also:**
  - `_bmad-output/shared-utils/FEATURE-REGISTRY.md`

### F-9 — Consumer integration patterns

- **Goal:** Document canonical HTTP and SvelteKit usage of the shared `auth` export.
- **Area:** Integration
- **Includes:**
  - auth-service Elysia routes wrapping `auth.api.*` on port 5001
  - SvelteKit hooks: `getSession` + `svelteKitHandler`
  - Route groups `/(auth)/` and `/(protected)/` with verify-email allowlist
- **Deferred:**
  - None currently.
- **See also:**
  - [architecture.md](./architecture.md#consumer-patterns)
