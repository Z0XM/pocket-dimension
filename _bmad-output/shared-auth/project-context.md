# shared-auth — Project Context

**Package:** `@pocket-dimension/auth`  
**Path:** `shared/auth`

## Rules

- There is **one** Better Auth instance (`export const auth`). Do not create a second auth config in an app.
- `RESEND_API_KEY` must be **non-empty** — Resend client is constructed at module load (`lib/emails.ts`). Placeholder is enough to boot.
- `BETTER_AUTH_SECRET` must be identical everywhere this package loads.
- Cookies: `secure: true`, `sameSite: "none"`, `httpOnly: true` — expect local HTTP session pain; do not “fix” by weakening cookies without a product decision.
- Browser clients talk to **auth-service** (`PUBLIC_BASE_AUTH_URL`), not to this package directly.
- SvelteKit servers import `auth` for `getSession` + `svelteKitHandler`.
- User `role` is `user | contributor | admin` (default `user`); not client-writable input.
- IDs come from DB `uuidv7()` (`generateId: false` on the adapter).

## Email

Verification, password reset, and magic-link sends are fire-and-forget. Missing/invalid Resend keys should not block account creation paths that already succeeded in DB — but empty key still crashes import.
