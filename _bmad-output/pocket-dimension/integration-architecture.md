# Integration Architecture — Pocket Dimension

How monorepo parts talk. Package internals: `_bmad-output/shared-*`. Tools: [architecture-monorepo-tools.md](./architecture-monorepo-tools.md).

## Integration points

| From | To | Type | Notes |
| --- | --- | --- | --- |
| Auth-backed apps (browser) | auth-service | REST + cookies | `PUBLIC_BASE_AUTH_URL` (:5001) |
| Auth-backed apps (server) | `@pocket-dimension/auth` | in-process | `getSession` + `svelteKitHandler` |
| Auth-backed apps | `@pocket-dimension/db` | in-process Drizzle | Named schemas per app |
| auth-service | `@pocket-dimension/auth` + `db` | in-process | Owns HTTP auth surface |
| shared-auth | shared-db | in-process | Drizzle adapter; **eager** env at import |
| shared-db | shared-utils | in-process | Lazy env Proxy |
| shared-auth | shared-utils | in-process | Eager `validateEnv` |
| scripts workspace | shared-db | in-process | Seed/ETL |
| zeo | LiveKit | JWT + RoomService + webhooks | Self-hosted SFU |
| zeo | zeo-music-worker | REST + shared secret | Internal worker |
| pocket | sibling apps | env URL links | Hub only |
| Heimdall | `_bmad-output/` | filesystem parse | Soft-empty on missing paths |

## Auth flow

1. Browser hits SvelteKit app; protected routes redirect to sign-in.
2. Client auth SDK talks to **auth-service**, not the SvelteKit origin.
3. Cookies: `secure` + `sameSite: "none"` + prefix `better-auth` — localhost HTTP often drops them.
4. Server hooks resolve session via shared `auth` against the same DB session tables.
5. App data uses `db` / `schema` in the app’s named PostgreSQL schema; `auth.user` is shared.

## Env validation asymmetry (important)

| Package | When env validates |
| --- | --- |
| `@pocket-dimension/db` | Lazy Proxy — first property access |
| `@pocket-dimension/auth` | Eager at module import — missing vars crash importers immediately |
| Apps | Local `env.ts` via `validateEnv` (pattern varies) |

## Data boundaries

- One Postgres database; **no** app tables in `public`.
- Migrations owned solely by `@pocket-dimension/db`.
- Some intentional/legacy non-FK uuid columns documented under `shared-db` data models.

## Secrets that must align

| Variable | Where |
| --- | --- |
| `DATABASE_URL` | db package, auth-service, auth-backed apps, drizzle-kit |
| `BETTER_AUTH_SECRET` | every auth package importer (identical) |
| `RESEND_API_KEY` | non-empty anywhere auth package loads |
| `PUBLIC_BASE_AUTH_URL` | frontend public env → auth-service |
| `BETTER_AUTH_URL` / `PATH` / `TRUSTED_ORIGINS` / `COOKIE_DOMAIN` | auth package |
