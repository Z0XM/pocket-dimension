# Pocket Dimension — Project Context (monorepo)

**Scope:** Cross-cutting monorepo rules for AI agents  
**Product:** Personal Bun + Turbo monorepo of apps sharing Better Auth, Drizzle/PostgreSQL 18, and small shared packages  
**Heimdall module:** `pocket-dimension`

## Critical rules

- Prefer existing patterns in sibling apps over inventing new stacks.
- Apps import **built** `dist/` of `@pocket-dimension/{utils,db,auth}` — run `bun run build` (or `build:shared:*`) before app/dev/test.
- PostgreSQL **18+** required (`uuidv7()` in `shared/db`). Start with `sudo pg_ctlcluster 18 main start`.
- `RESEND_API_KEY` must be non-empty wherever `@pocket-dimension/auth` loads or auth-service crashes at import.
- `BETTER_AUTH_SECRET` must match across auth-service and every auth-backed frontend.
- Auth-service listens on **5001** (`PUBLIC_BASE_AUTH_URL=http://localhost:5001`). README mentions of 3001 are stale.
- Better Auth cookies use `secure: true` / `sameSite: "none"` — sessions often will not stick on plain `http://localhost`.
- Deploy apps with `@pocket-dimension/*` deps from **repository root** context — see root `DEPLOY.md`.
- BMAD: monorepo-wide artifacts in `_bmad-output/pocket-dimension/`; packages in `shared-*`; app-only work in that app’s `_bmad-output/<app>/`. Never use a repo-root `docs/` folder for BMAD.

## Tech defaults

| Layer | Choice |
| --- | --- |
| Runtime / PM | Bun 1.3.x, workspaces `apps/**` `shared/**` `scripts/**` |
| Orchestration | Turbo |
| Auth | Better Auth via `@pocket-dimension/auth` + `apps/auth-service` |
| DB | Drizzle + `pg`, named schemas, `@pocket-dimension/db` |
| Frontends | SvelteKit (most apps); Heimdall is Vite/React |
| Email | Resend (verification fire-and-forget) |

## When to load other contexts

| Working on | Load |
| --- | --- |
| Shared packages | `_bmad-output/shared-{utils,db,auth}/project-context.md` |
| zeo | `_bmad-output/zeo/project-context.md` |
| chhan-chhan | `_bmad-output/chhan-chhan/project-context.md` |
| Env / ports / Cloud caveats | repo-root `AGENTS.md` |

## zeo join policy

zeo requires login to join rooms — guest join without an account is not supported.
