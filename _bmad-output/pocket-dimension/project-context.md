# Pocket Dimension — Project Context (monorepo)

**Scope:** Cross-cutting monorepo + tooling rules for AI agents  
**Heimdall module:** `pocket-dimension`  
**Scan:** 2026-08-31 deep rescan

## Critical rules

- Prefer existing patterns in sibling apps over inventing new stacks.
- Apps import **built** `dist/` of `@pocket-dimension/{utils,db,auth}` — run `bun run build` (or `build:shared:*`) before app/dev/test.
- PostgreSQL **18+** required (`uuidv7()` in `shared/db`). Start with `sudo pg_ctlcluster 18 main start`.
- `RESEND_API_KEY` must be non-empty wherever `@pocket-dimension/auth` loads or auth-service crashes at import.
- `BETTER_AUTH_SECRET` must match across auth-service and every auth-backed frontend.
- Auth-service listens on **5001** (`PUBLIC_BASE_AUTH_URL=http://localhost:5001`).
- Better Auth cookies use `secure: true` / `sameSite: "none"` — sessions often will not stick on plain `http://localhost`.
- Deploy apps with `@pocket-dimension/*` deps from **repository root** context — see root `DEPLOY.md` and [architecture-monorepo-tools.md](./architecture-monorepo-tools.md).
- BMAD: monorepo/tools in `_bmad-output/pocket-dimension/`; packages in `shared-*`; app-only work in `_bmad-output/<app>/`. Never use a repo-root `docs/` folder for BMAD.
- Root `README.md` still mentions Biome / `bun run check` — **stale**. Real toolchain is Prettier + Turbo + husky (see contribution / tools docs).

## Tech defaults

| Layer | Choice |
| --- | --- |
| Runtime / PM | Bun 1.3.5, workspaces `apps/**` `shared/**` `scripts/**` |
| Orchestration | Turbo 2.x via `scripts/turbo-no-prefix.sh` |
| Typecheck | `tsgo` for shared/backend; `svelte-check` for SvelteKit apps |
| Auth | Better Auth via `@pocket-dimension/auth` + `apps/auth-service` |
| DB | Drizzle + `pg`, named schemas, `@pocket-dimension/db` |
| Frontends | SvelteKit (most apps); Heimdall is Vite/React |
| Email | Resend (verification fire-and-forget) |
| Format | Prettier 3 (not Biome) |
| CI | None at root — husky pre-commit is the gate |

## When to load other contexts

| Working on | Load |
| --- | --- |
| Shared packages | `_bmad-output/shared-{utils,db,auth}/project-context.md` |
| watchlist | `_bmad-output/watchlist/project-context.md` |
| zeo | `_bmad-output/zeo/project-context.md` |
| chhan-chhan | `_bmad-output/chhan-chhan/project-context.md` |
| Env / ports / Cloud | repo-root `AGENTS.md` |

## zeo join policy

zeo requires login to join rooms — guest join without an account is not supported.
