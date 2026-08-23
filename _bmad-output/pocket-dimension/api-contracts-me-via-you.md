# API Contracts — me-via-you

Almost all writes are **SvelteKit form actions** (`/u/[username]`, `/f/[slug]`, protected form detail).

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| GET | `/health` | No | `select 1`; 503 if DB down |

Public: `/u/[username]`, `/f/[slug]` (no login to answer). Owner actions use `requireProfileOwner` in `src/lib/server/authz.ts`.
