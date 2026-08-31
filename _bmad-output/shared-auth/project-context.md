# shared-auth — Project Context

**Package:** `@pocket-dimension/auth`  
**Path:** `shared/auth`

## Rules

- **One** Better Auth instance (`export const auth`). Never fork a second config in an app.
- Env validates **eagerly** at import — missing required vars crash any importer immediately.
- `RESEND_API_KEY` must be **non-empty** (Resend constructed at module load). Placeholder is enough to boot.
- `BETTER_AUTH_SECRET` identical everywhere this package loads.
- Cookies: `secure: true`, `sameSite: "none"`, `httpOnly: true` — expect local HTTP session pain.
- Browser clients talk to **auth-service** (`PUBLIC_BASE_AUTH_URL`), not this package.
- SvelteKit servers import `auth` for `getSession` + `svelteKitHandler`.
- User `role`: `user | contributor | admin` (default `user`, `input: false`).
- IDs from DB `uuidv7()` (`generateId: false`).
- Infer user/session shapes from `@pocket-dimension/db` schema — auth package does not re-export types.
