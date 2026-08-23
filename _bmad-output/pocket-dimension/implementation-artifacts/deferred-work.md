# Deferred Work — Pocket Dimension

## Magic-link sign-in (all auth-backed apps)

**Status:** backlog  
**Why deferred:** `shared/auth` already enables the Better Auth `magicLink` plugin (15-minute links, signup allowed, Resend mailer). `auth-service` does **not** expose HTTP routes for it. Only zeo’s browser client imports `magicLinkClient()`. Shipping this as a product feature needs a coordinated cut across the auth service and every app that uses Better Auth.

### Scope (when picked up)

1. **auth-service** — add Elysia handlers that wrap `auth.api.signInMagicLink` / verify (and any callback Better Auth requires). Document them in `api-contracts-auth-service.md`.
2. **Shared client** — expose `magicLinkClient()` from a common pattern (today each app has its own `auth-client.ts`).
3. **Auth UI on every auth-backed app** — login/sign-up surfaces should offer “email me a link” alongside password:
   - `watchlist`
   - `howwasyourday`
   - `chhan-chhan`
   - `me-via-you`
   - `zeo` (client plugin already present; wire UI + working service routes)
4. **rhymes** — include magic-link when the rework adds auth (Epic 2), not as a one-off.
5. **Out of scope unless those apps gain auth:** `pocket`, `markitdown`, `zeo-music-worker`.

### Notes

- Cookie policy stays `secure` / `sameSite: none`. Local `http://localhost` session caveat still applies.
- `RESEND_API_KEY` must be a real key for delivery; placeholders only boot the process.
- Trusted origins must already list each frontend (`BETTER_AUTH_TRUSTED_ORIGINS`).
