# AGENTS.md

## Cursor Cloud specific instructions

This is the **Pocket Dimension** Bun + Turbo monorepo. Standard commands live in `README.md` and root `package.json` scripts; the notes below cover only non-obvious caveats discovered during environment setup.

### Services overview

| App | Port | Auth/DB? | Run (dev) |
| --- | --- | --- | --- |
| `auth-service` (Elysia) | 5001 | owns auth, uses DB | `bun run dev:app:auth` |
| `watchlist` (SvelteKit) | 3002 | yes | `bun run dev:app:watchlist` |
| `rhymes` (SvelteKit) | 3003 | no (standalone) | `bun run dev:app:rhymes` |
| `howwasyourday` (SvelteKit) | 3004 | yes | `bun run dev:app:howwasyourday` |
| `chhan-chhan` (SvelteKit) | 3005 | yes | `bun run dev:app:chhan-chhan` |
| `me-via-you` (SvelteKit) | 3006 | yes | `bun run dev:app:me-via-you` |
| `markitdown` (SvelteKit) | 3009 | no (needs Python) | `bun run dev:app:markitdown` |
| `pocket` (SvelteKit) | 3007 | no (hub app) | `bun run dev:app:pocket` |
| `dashboard` (SvelteKit) | 3011 | no (standalone) | `bun run dev:app:dashboard` |
| `heimdall` (Vite/React War Room) | 5174/5175 dev · **3012** prod | no (standalone) | `bun run dev:app:heimdall` / `bun run start` in `apps/heimdall` |
| `zeo` (SvelteKit) | 3008 | yes | `bun run dev:app:zeo` |
| `zeo-music-worker` | 3010 | worker (internal) | `bun run dev:app:zeo-music-worker` |

The auth-backed apps need PostgreSQL **and** the `auth-service` running. `rhymes`, `markitdown`, `pocket`, `dashboard`, and `heimdall` are standalone. Heimdall deploy: [apps/heimdall/DEPLOY.md](./apps/heimdall/DEPLOY.md) (needs `_bmad-output` + root `heimdall.config.mjs` in the image).

### Database: PostgreSQL 18 is required (not 16)

The Drizzle schema defaults ids to the native `uuidv7()` function (`shared/db/src/schema/common.ts`), which only exists in **PostgreSQL 18+**. On 16 migrations fail with `function uuidv7() does not exist`. PG18 is installed in the VM snapshot but is **not auto-started** — start it each session:

```bash
sudo pg_ctlcluster 18 main start    # or: sudo service postgresql start
```

Connection: `postgresql://postgres:postgres@localhost:5432/postgres` (user `postgres`, password `postgres`, db `postgres`). Tables live in named schemas (`auth`, `watchlist`, `howwasyourday`, `chhanchhan`, `meviayou`, `zeo`), not `public`. Apply schema with `bun run db:migrate` (not in the update script — needs the DB running). **zeo production:** `bun run start` in `apps/zeo` auto-runs pending migrations when `DATABASE_URL` is set.

### `.env` files (gitignored — recreate per session)

Each app/package reads a local `.env` (Bun auto-loads it from the cwd; Turbo runs each task in the package dir). Copy from each `.env.example` and note:

- **`RESEND_API_KEY` must be NON-EMPTY** or `auth-service` crashes at startup — the Resend client is constructed at module load (`shared/auth/src/lib/emails.ts`). A placeholder like `re_placeholder_local_dev_only` is enough to boot; real email delivery needs a valid key, but signup/account-creation works without it (the verification email is fire-and-forget).
- **`BETTER_AUTH_SECRET` must be set** and identical across `auth-service` and every frontend app.
- `auth-service` runs on **port 5001** (the README's mention of 3001 is stale). Frontend apps point `PUBLIC_BASE_AUTH_URL=http://localhost:5001`.
- `shared/db/.env` only needs `DATABASE_URL`.

### Build before running apps

Apps import the **built** `dist/` of `@pocket-dimension/{auth,db,utils}`. Run `bun run build` (or the `build:shared:*` scripts) before starting an app or running tests. `auth-service` has no build step (Bun runs TS directly). Heimdall (`apps/heimdall`) builds with its own Vite + esbuild pipeline (`bun run build:app:heimdall` or `cd apps/heimdall && bun run build`).

### Lint / format caveats (pre-existing)

- `bun run lint` runs `prettier --check .` per package; in a subdir Prettier does **not** read the root `.prettierignore`, so it flags built `dist/` files after a build. This is a pre-existing config quirk, not a real failure.
- `bun run format:check` (root prettier, respects `.prettierignore`) may flag a few committed markdown files. Unrelated to local setup.
- `bun run typecheck` (packages that define the script) passes.

### Tests

`auth-service` has `vitest --passWithNoTests` and no test files. Real tests live in `apps/zeo` (`bun test src`) and `apps/chhan-chhan` importers (`bun test src/lib/importers/`).

### BMAD

Default artifacts and brownfield docs: `_bmad-output/pocket-dimension/` (start at `index.md`). Existing app-only trees: `_bmad-output/zeo/`, `_bmad-output/chhan-chhan/`. Heimdall War Room app: `apps/heimdall` (`@pocket-dimension/heimdall`); product SoR lands under `_bmad-output/heimdall/` incrementally (Part 2 of the port). Do not write knowledge to a repo-root `docs/` folder.

```bash
bun run heimdall doctor   # Soft-empty warnings OK until BMAD paths exist
bun run heimdall dev      # or: bun run dev:app:heimdall — UI default http://127.0.0.1:5174/heimdall/
```

### Auth session caveat (local browser)

Better Auth is configured with `secure: true` / `sameSite: "none"` cookies (`shared/auth/src/index.ts`). Over plain `http://localhost` the browser will not persist the session cookie, so a full logged-in session may not stick locally. Account **creation/signup** works fine; verifying users typically requires flipping `email_verified` in the DB since email delivery is disabled by default.

### zeo join policy

**zeo requires login** to join any room (`/room/[slug]` redirects unauthenticated users to sign-in). Guest join without an account is not supported.

### Deployment (Railpack / Dokploy)

Apps with `@pocket-dimension/*` workspace deps **must** deploy from the **repository root** (`/`), not `apps/<app>`. See root [`DEPLOY.md`](./DEPLOY.md). Each app has `Dockerfile`, `railpack.json`, and `scripts/deploy-build.sh` under `apps/<app>/` (except markitdown / zeo-music-worker / imposter-art, which keep their existing setup).

### markitdown (optional, standalone)

Needs a Python venv plus `ffmpeg` + `exiftool` (both installed in the snapshot): `cd apps/markitdown && bun run setup:python`. Defaults to port **3009**.
