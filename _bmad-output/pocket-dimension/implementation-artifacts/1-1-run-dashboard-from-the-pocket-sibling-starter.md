---
baseline_commit: e73774d9dc4426540c4bb6707fe2d202a1f4150a
---

# Story 1.1: Run dashboard from the pocket sibling starter

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want a local `dashboard` app I can start from the monorepo,
so that I have a place to open the BMAD Showcase in the browser.

## Acceptance Criteria

1. **Given** the monorepo has `apps/pocket` and watchlist shadcn wiring  
   **When** this story is implemented  
   **Then** `apps/dashboard` exists as package `@pocket-dimension/dashboard` copied from `apps/pocket`  
   **And** the pocket hub catalog is stripped so the app is not a second Pocket  
   **And** shadcn/`components.json` wiring is copied from `apps/watchlist` as needed  
   **And** root scripts `dev:app:dashboard` and `build:app:dashboard` exist  
   **And** `bun run dev:app:dashboard` serves on port **3011** with no auth-service and no PostgreSQL  
   **And** if the pocket copy is blocked, the fallback is `sv create` then immediate align with pocket/watchlist (adapter-bun, Tailwind 4, shadcn-svelte)

2. **Given** the app is running  
   **When** I open `http://localhost:3011`  
   **Then** I see a SvelteKit page for dashboard (not the Pocket hub tile grid)  
   **And** there is no write API and no database config required

## Tasks / Subtasks

- [x] Copy pocket → dashboard and rename the package (AC: 1)
  - [x] `cp -a apps/pocket apps/dashboard` (do **not** copy `node_modules`, `.svelte-kit`, `build` if present)
  - [x] Set `apps/dashboard/package.json` `name` to `@pocket-dimension/dashboard`
  - [x] Keep pocket scripts (`dev`/`build`/`preview`/`start`/`check`) and `svelte-adapter-bun` / Vite / Tailwind 4 / Svelte 5 stack
  - [x] Do **not** edit `apps/pocket/**`

- [x] Strip the hub catalog (AC: 1, 2)
  - [x] Delete: `src/lib/apps.ts`, `src/lib/app-icons.ts`, `src/lib/components/app-card.svelte`
  - [x] Replace `src/lib/server/env.ts` — drop all `POCKET_APP_*` keys and `getLinkedApps()`. Either delete the file or keep only `PORT` default **3011** and `HOST` default `0.0.0.0` without `@pocket-dimension/utils` if unused
  - [x] Delete `src/routes/+page.server.ts` (it only loaded hub apps)
  - [x] Replace `src/routes/+page.svelte` with a non-hub placeholder: title **dashboard**, no `AppCard`, no tile grid, no “Pick an app” copy
  - [x] `src/app.html` title: `dashboard` (not `Pocket`)
  - [x] `.env.example`: `PORT=3011`, `HOST=0.0.0.0`, `NODE_ENV=development`. **No** `POCKET_APP_*`, **no** `DATABASE_URL`, **no** auth secrets
  - [x] Remove unused deps if nothing imports them: `@pocket-dimension/utils`, hub-only zod usage. Keep zod only if a thin env schema remains

- [x] Wire shadcn from watchlist (AC: 1)
  - [x] Copy `apps/watchlist/components.json` → `apps/dashboard/components.json` (aliases `$lib/components`, `$lib/utils`, `$lib/components/ui`)
  - [x] Keep or replace `src/lib/utils.ts` with watchlist’s `cn()` + `WithElementRef` helpers (pocket already has a slimmer `cn`)
  - [x] Add `bits-ui` to dashboard `package.json` (watchlist uses `^2.14.4`). Pocket does **not** have bits-ui
  - [x] From `apps/dashboard`: `bun x shadcn-svelte@latest add button dialog command input scroll-area separator badge table tabs sheet -y` (architecture list + sheet for later `< lg` rail)
  - [x] Do **not** invent a second component kit. Do **not** restyle tokens yet (Story 1.2)

- [x] Root Turbo filters and port (AC: 1)
  - [x] Root `package.json` add:
    - `"dev:app:dashboard": "./scripts/turbo-no-prefix.sh run dev --filter=@pocket-dimension/dashboard"`
    - `"build:app:dashboard": "./scripts/turbo-no-prefix.sh run build --filter=@pocket-dimension/dashboard"`
  - [x] Workspaces already include `apps/**` — no turbo.json change required
  - [x] Default port **3011** via `.env.example` + `vite.config.ts` `Bun.env.PORT` (same pattern as pocket)
  - [x] Add AGENTS.md table row: dashboard | `apps/dashboard` | 3011 | no auth | `bun run dev:app:dashboard`

- [x] Keep health; no product writes (AC: 2)
  - [x] Keep `src/routes/health/+server.ts` as GET `{ status: "ok" }` — do not dump files
  - [x] No `src/routes/api/` product routes, no POST/PATCH/DELETE for BMAD, no Drizzle, no Better Auth

- [x] Deploy files (optional / out of scope for “done”)
  - [x] Prefer **delete** copied `Dockerfile`, `railpack.json`, `scripts/deploy-build.sh`, `DEPLOY.md` so they cannot deploy pocket-on-3011 by mistake. Architecture: deploy artifacts deferred

- [x] Verify (AC: 1, 2)
  - [x] `bun install` at repo root
  - [x] `bun run dev:app:dashboard` listens on **3011**
  - [x] `curl -s http://localhost:3011/` HTML is dashboard, not a hub of watchlist/rhymes/zeo tiles
  - [x] `curl -s http://localhost:3011/health` → `{"status":"ok"}`
  - [x] `apps/pocket` still runs unchanged (`dev:app:pocket` / 3007)

## Dev Notes

This is the **first** dashboard story. Do not implement Overview, Tree switcher, Reader, Search, Delivery, or DESIGN.md tokens. A bootable empty Showcase shell is enough.

**Copy, do not `sv create`.** Architecture: first story is sibling copy. Fallback `bunx sv create apps/dashboard --template minimal --types ts --no-add-ons --no-install` only if `apps/pocket` cannot be copied; then immediately match pocket (adapter-bun, Tailwind 4 Vite plugin, same scripts).

**Do not copy SIS React.** Inspiration is IA only.

### Project Structure Notes

Expected after this story (later stories add more):

```
apps/dashboard/
  package.json          # @pocket-dimension/dashboard
  components.json       # from watchlist
  svelte.config.js      # adapter-bun (from pocket)
  vite.config.ts        # Tailwind 4 + PORT from Bun.env
  .env.example          # PORT=3011 HOST=0.0.0.0
  src/app.html          # title dashboard
  src/app.css           # pocket Tailwind for now; tokens in 1.2
  src/lib/utils.ts      # cn()
  src/lib/components/ui/  # shadcn primitives
  src/routes/+layout.ts / +layout.svelte
  src/routes/+page.svelte   # placeholder, not hub
  src/routes/health/+server.ts
```

Do **not** add `shared/dashboard`. Do **not** put runtime code under `_bmad-output/`.

### What pocket looks like today (UPDATE sources — do not break pocket)

| File | Today | This story |
| --- | --- | --- |
| `apps/pocket/src/lib/apps.ts` + `app-icons.ts` + `app-card.svelte` | Hub catalog | **Do not change pocket.** Delete copies in dashboard |
| `apps/pocket/src/lib/server/env.ts` | `validateEnv` + `POCKET_APP_*` + `getLinkedApps` | Dashboard: no hub env keys |
| `apps/pocket/src/routes/+page.svelte` | Tile grid “Pocket” | Dashboard: placeholder page |
| `apps/pocket/vite.config.ts` | `server.port` from `Bun.env.PORT` | **Keep this pattern**; default 3011 via env |
| `apps/pocket/src/routes/health/+server.ts` | `{ status: "ok" }` | Keep identical behavior |
| Root `package.json` | `dev:app:pocket` / `build:app:pocket` | **Add** dashboard scripts; do not rename pocket scripts |

Preserve: pocket on 3007, all other apps, rhymes `sprint-status.yaml`.

### Stack (lock these; do not invent)

From pocket `package.json` / watchlist (do not upgrade “to latest” unless the copy already has it):

- TypeScript, Svelte `^5.45.6`, SvelteKit `^2.49.1`, Vite `^7.2.6`
- `bun --bun vite`, `svelte-adapter-bun` `^1.0.1`
- Tailwind `^4.1.17` + `@tailwindcss/vite`
- shadcn-svelte CLI `@latest` (npm 1.5.x) + `bits-ui` `^2.14.4` (watchlist)
- `@lucide/svelte` already in pocket
- Svelte 5 runes (`$props`) — pocket page already uses them
- No Zustand/Redux, no React, no MiniSearch, no Postgres, no Better Auth

### shadcn add (cwd = `apps/dashboard`)

```bash
bun x shadcn-svelte@latest add button dialog command input scroll-area separator badge table tabs sheet -y
```

If pocket’s unused `src/lib/components/ui/button` conflicts, `--overwrite` after commit, or delete pocket’s unused button first then add.

### Anti-patterns (do not)

- `sv create` as the happy path
- Second Pocket hub (`apps.ts` / `POCKET_APP_*` / AppCard grid)
- Auth, `DATABASE_URL`, Drizzle, `@pocket-dimension/auth` or `db`
- Port 3007 (pocket) or 3010 (zeo-music-worker)
- Implementing DESIGN.md hex / Fira Code (Story 1.2)
- BMAD file readers / `_bmad-output` walks (Stories 1.3+)
- Deploy Dockerfile that still filters `@pocket-dimension/pocket`
- Overwriting `_bmad-output/pocket-dimension/implementation-artifacts/sprint-status.yaml` (rhymes)

### Testing

No parser tests this story. Manual / curl:

```bash
bun run dev:app:dashboard
curl -sS http://localhost:3011/health
curl -sS http://localhost:3011/ | head
```

Fail if `/` still lists other monorepo apps as tiles or title is Pocket.

`bun test` not required. `bun run --filter=@pocket-dimension/dashboard check` should pass after `svelte-kit sync`.

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 1.1]
- [Source: planning-artifacts/architecture-dashboard.md — Starter Template Evaluation, Implementation Handoff]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — §5 Not auth-backed, §11 no DB]
- [Source: apps/pocket/package.json, svelte.config.js, vite.config.ts, src/lib/server/env.ts, src/routes/+page.svelte]
- [Source: apps/watchlist/components.json, src/lib/utils.ts, bits-ui in package.json]
- [Source: root package.json — turbo-no-prefix.sh filter scripts]
- [Source: AGENTS.md — app port table]

## Dev Agent Record

### Agent Model Used

Composer (subagent implementer)

### Debug Log References

- `bun run --filter=@pocket-dimension/dashboard check` returned ENOENT at repo root; `bun run check` in `apps/dashboard` passed (0 errors).

### Completion Notes List

- Copied `apps/pocket` → `apps/dashboard` (excluding build artifacts); renamed package to `@pocket-dimension/dashboard`.
- Stripped hub catalog (apps.ts, app-icons, app-card, +page.server.ts, env.ts); placeholder `/` page with title **dashboard**.
- Wired shadcn from watchlist (`components.json`, utils helpers, bits-ui); added button/dialog/command/input/scroll-area/separator/badge/table/tabs/sheet via shadcn CLI.
- Root scripts `dev:app:dashboard` / `build:app:dashboard`; AGENTS.md row; port 3011 via `.env.example`.
- Deleted deploy artifacts (Dockerfile, railpack.json, deploy-build.sh, DEPLOY.md).
- Verified: `svelte-check` clean; dev on 3011; `/health` → `{"status":"ok"}`; `/` not a hub tile grid.

### File List

- `apps/dashboard/` (new app — package, components, routes, config)
- `package.json` (root dev/build dashboard scripts)
- `bun.lock` (dashboard + shadcn deps)
- `AGENTS.md` (dashboard port table row)
- `_bmad-output/pocket-dimension/implementation-artifacts/1-1-run-dashboard-from-the-pocket-sibling-starter.md`
- `_bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml`

## Change Log

- 2026-08-23: Story 1.1 — add standalone `apps/dashboard` sibling from pocket with hub stripped, shadcn wired, port 3011.
