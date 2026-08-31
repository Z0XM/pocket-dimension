# Integration Architecture — Pocket Dimension

How monorepo parts talk. Package internals: `_bmad-output/shared-*`.

## Integration points

| From | To | Type | Notes |
| --- | --- | --- | --- |
| Auth-backed apps (browser) | auth-service | REST + cookies | `PUBLIC_BASE_AUTH_URL` (default `:5001`) |
| Auth-backed apps (server) | `@pocket-dimension/auth` | in-process | `getSession` + `svelteKitHandler` |
| Auth-backed apps | `@pocket-dimension/db` | in-process Drizzle | Named schemas per app |
| auth-service | `@pocket-dimension/auth` + `db` | in-process | Owns HTTP auth surface |
| shared-auth | shared-db | in-process | Drizzle adapter |
| shared-db / auth | shared-utils | in-process | `validateEnv` |
| zeo | LiveKit | JWT + RoomService + webhooks | Self-hosted SFU |
| zeo | zeo-music-worker | REST + shared secret | Internal worker |
| pocket | sibling apps | env URL links | Hub only |
| Heimdall | `_bmad-output/` | filesystem parse | Soft-empty on missing paths |

## Auth flow (happy path)

1. Browser hits SvelteKit app; unauthenticated routes may redirect to sign-in.
2. Client auth SDK talks to **auth-service**, not the SvelteKit origin, for credential/session APIs.
3. Cookies: `secure` + `sameSite: "none"` + `cookiePrefix: "better-auth"` — localhost HTTP often drops them.
4. Server hooks resolve session via shared `auth` against the same DB/session tables.
5. App data queries use `db` / `schema` in the app’s named PostgreSQL schema; `auth.user` is shared.

## Data boundaries

- One Postgres database; **no** dumping app tables into `public`.
- FK-style references to `auth.user` via shared helpers (`actionsByUser` in `shared/db`).
- Migrations owned solely by `@pocket-dimension/db` (`bun run db:migrate`).

## Secrets that must align

| Variable | Where |
| --- | --- |
| `DATABASE_URL` | db package, auth-service, auth-backed apps |
| `BETTER_AUTH_SECRET` | auth package importers (must be identical) |
| `RESEND_API_KEY` | non-empty anywhere auth package loads |
| `PUBLIC_BASE_AUTH_URL` | frontend public env → auth-service |
