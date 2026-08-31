# watchlist — Project Context (for AI agents)

**Package:** `@pocket-dimension/watchlist`
**Monorepo path:** `apps/watchlist`
**Dev port:** **3002**
**Framework:** SvelteKit 5 (runes) + `svelte-adapter-bun`
**Auth/DB:** yes — needs PostgreSQL **and** `auth-service` running (see root [`AGENTS.md`](../../AGENTS.md))

## Before you touch anything

1. **Build shared packages first.** The app imports the built `dist/` of `@pocket-dimension/{auth,db,utils}`, not their source. Run `bun run build:shared:utils && bun run build:shared:db && bun run build:shared:auth` (or `bun run build` at repo root) before `bun run dev:app:watchlist`, `bun run check`, or any test run — otherwise you get stale or missing type/runtime errors that look like app bugs.
2. **Start PostgreSQL 18** (`sudo pg_ctlcluster 18 main start`) and run `bun run db:migrate` from repo root before loading any page — every route (including the public `/`) queries the `watchlist` Postgres schema.
3. **Start `auth-service`** (`bun run dev:app:auth`, port 5001) for any session-dependent flow (login, edit mode, views, dashboard "My Stats", leaderboard is public and doesn't need it). `PUBLIC_BASE_AUTH_URL` in `.env` must point at it.
4. Copy `.env.example` → `.env` in `apps/watchlist` before running `dev`, `build`, or `check` — `PUBLIC_BASE_AUTH_URL`/`PUBLIC_BASE_AUTH_PATH` are `$env/static/public` values and Vite/`svelte-check` fail to resolve them without a `.env` file present (see [development-guide.md](./development-guide.md)).

## Where things live (quick map)

- Route handlers for pages: `src/routes/(public)/*`, `src/routes/(auth)/*`, `src/routes/(protected)/*` — see [source-tree-analysis.md](./source-tree-analysis.md).
- REST API: `src/routes/api/**/+server.ts` — see [api-contracts.md](./api-contracts.md) for the full contract before adding/changing an endpoint.
- Auth/session wiring: `src/hooks.server.ts`, `src/app.d.ts`, `src/lib/auth-client.ts` — see [architecture.md](./architecture.md).
- Table read queries (raw SQL, not Drizzle query builder): `src/lib/server/watchlist.ts`.
- Dashboard/leaderboard read queries: `src/lib/server/dashboard.ts`, `src/lib/server/leaderboard.ts`, shared param parsing in `src/lib/leaderboard.ts`.
- Table write path (the only mutation endpoint for edit mode): `src/routes/api/watchlist/bulk-update/+server.ts`.
- Client edit-mode state machine (single source of truth for role permissions): `src/routes/(public)/data-table-helpers/edit-mode.svelte.ts`.

## Permission model — edit it in one place

Role gating (`user` / `contributor` / `admin` / synthetic `mobile`) is implemented in `edit-mode.svelte.ts`'s `canEditField`/`canAddRows`/`canDeleteRows`, and is mirrored (but not shared) by:
- `src/routes/api/watchlist/bulk-update/+server.ts` (server-side enforcement — the actual security boundary; client-side checks are UX only)
- `src/routes/(public)/about/+page.svelte` (human-readable prose describing the same rules)

If you change who-can-edit-what, update all three, and re-check `about/+page.svelte`'s "Mobile Limitations" copy — it currently says mobile users have "read-only access" and "cannot edit," but `data-table.svelte`'s `canEdit` derived value does **not** exclude the `mobile` role, and `canEditField("mobile", …)` allows editing `my_rating`/`my_infinity`/`my_shitty`/`my_progress_status`. In practice a logged-in, verified mobile user can enter edit mode and edit their own rating/progress fields (just not title/language/type/tags, and not add/delete rows) — narrower than "all editing," but not fully read-only either.

## Known gotchas (verified against source, 2026-08-31)

These are real, currently-present issues in `apps/watchlist` — check before assuming otherwise, and update this list if fixed.

1. **Confirmed live bug: `bulk-edit-panel.svelte` throws on open.** `src/routes/(public)/data-table-helpers/bulk-edit-panel.svelte`'s `progressOptions` derived value reads `editOptions.progressStatuses.map(...)`, but `data-table.svelte`'s `setContext("editOptions", { languages, types, tags, userRole })` (around line 144) never sets a `progressStatuses` key. Selecting ≥1 row in edit mode (which renders `BulkEditPanel`) throws `TypeError: Cannot read properties of undefined (reading 'map')`, breaking the whole panel. Fix by adding a `progressStatuses` getter to that `setContext` call, or hardcoding the four known values (`watch_later`, `watching`, `watched`, `dropped`) directly in `bulk-edit-panel.svelte` the way `add-item-dialog.svelte` already does.
2. **`theme-button.svelte` is orphaned.** `src/lib/components/theme-button.svelte` is not imported by `+layout.svelte`, `overlay.svelte`, or anywhere else (verified via full-text search). The app currently has no manual light/dark toggle in the UI — theming follows `prefers-color-scheme` only via `mode-watcher`. Either wire it into `overlay.svelte`'s nav bar or remove it; don't assume it's reachable.
3. **`src/routes/(protected)/list/+page.svelte` is dead code.** It's a 1-line file (`Login Required`, no `<script>`, no `+page.server.ts`). No route in the app links to `/list`. The `(protected)` route-group guard in `hooks.server.ts` (session + email-verified check) is real and live, but this is its only route and it's unreachable in normal navigation. Safe to delete or repurpose — flag with the team before removing in case it's an intentional smoke-test route for the guard.
4. **`src/app.d.ts` imports a non-existent module.** `import type { Session } from "$lib/auth";` — there is no `src/lib/auth.ts` in this app (only `src/lib/auth-client.ts`). Every sibling auth-backed app (`zeo`, `me-via-you`, `chhan-chhan`, `howwasyourday`) has a `src/lib/auth.ts` that re-exports `Session` from `better-auth/types` for exactly this import. This currently does **not** surface as a `svelte-check`/`tsc` error because `tsconfig.json` sets `"skipLibCheck": true`, which skips type-checking of `.d.ts` files entirely (confirmed via `tsc --traceResolution`: the module genuinely fails to resolve, but the diagnostic is suppressed). `App.Locals.session` therefore effectively types as `any` at the declaration site. Fix by adding `src/lib/auth.ts` with the same one-line re-export used by the sibling apps:
   ```ts
   import type { Session as BetterAuthSession } from "better-auth/types";
   export type Session = BetterAuthSession;
   ```
5. **Two orphaned click-to-filter cells.** `data-table-helpers/clickable-cell.svelte` and `data-table-helpers/clickable-tags-cell.svelte` have zero references anywhere in `src` (verified via full-text search) — superseded by inline click-to-filter logic inside `editable-select-cell.svelte`/`editable-tags-cell.svelte`. Don't assume either is wired into `columns.ts`.
6. **Local browser session stickiness.** Better Auth cookies use `secure: true` / `sameSite: "none"` (set in `@pocket-dimension/auth`, shared by every app). Over plain `http://localhost:3002` the browser may refuse to persist the session cookie, so a logged-in session may not stick across reloads locally. Signup/login API calls still succeed; if you need a persisted local session, flip `email_verified` directly in the `auth.user` table (Resend delivery is disabled by default via a placeholder `RESEND_API_KEY`) and test primarily via direct API/DB checks rather than relying on browser session persistence.

## Anti-patterns / things not to repeat

- Don't add a second ad hoc query builder for the watchlist table — all list/filter/sort logic for the home page lives in `getWatchlistForUser` (`src/lib/server/watchlist.ts`) and is deliberately raw `sql\`...\`` (not the Drizzle query builder) so the cross-filtering CTEs (`global_agg`, `my_agg`, `tags`, per-preferred-user `user_<name>_agg`) can be composed. Extend that function rather than writing a parallel query path.
- Don't bypass `/api/watchlist/bulk-update` for any create/update/delete on `watch_items`/`watch_item_ratings`/`watch_item_tags` — it is the single server-side authorization boundary (role checks, email-verified check, rating/progress-status business rule). Client components stage changes into `edit-mode.svelte.ts`'s state and flush them all through this one endpoint.
- Don't duplicate the rating-color gradient (`getRatingColor`, 10 discrete hex thresholds) a fourth time — it already exists in `columns.ts` and `editable-rating-cell.svelte`. Same for the strong-password regex (duplicated between `sign-up` and `reset-password` pages) and the rating→color / tag-picker UI patterns noted in [deep-dive-watchlist.md](./deep-dive-watchlist.md).
- Don't add new URL-synced client state without reading the "echo suppression" pattern in `data-table.svelte` (`pendingSorting`/`pendingFilters`/`pendingQuery`) and `overlay.svelte` (`isManualSelection`) first — both exist to stop a `goto()`-triggered URL change from being immediately re-read and fought by the same component's own URL-sync `$effect`. This is the most fragile part of the app to modify.

## Where NOT to write docs

Per `_bmad-output/README.md`, app-specific brownfield/product docs for `watchlist` belong in this folder (`_bmad-output/watchlist/`), not a repo-root `docs/` folder. `planning-artifacts/` and `implementation-artifacts/` subfolders should only be created when real PRD/story content exists — do not scaffold empty placeholder folders.
