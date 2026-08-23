# Story 2.1: Add authenticated creator access and rhymes workspace gating

Status: ready-for-dev

## Story

As a rhymes creator,
I want the product to recognize my signed-in access level,
so that authoring controls appear only when I am allowed to use them.

## Acceptance Criteria

1. Given a user is not signed in or lacks rhymes create access, when they use the public reader, then authoring controls remain hidden and public reading still works normally.
2. Given a signed-in user has rhymes create access, when they open rhymes, then the authenticated workspace augments the same reader shell with creator controls and access checks use rhymes-specific membership data rather than global-only role assumptions.
3. SvelteKit `rhymes` server-side request handling exposes session/user context in `locals` in the same general pattern used by the monorepo's other auth-backed SvelteKit apps.
4. The `rhymes` app can read Better Auth session state from the shared auth package without regressing the current public reader routes (`/` and `/:slug`).
5. The implementation introduces a rhymes-specific membership check seam, even if the first increment uses a temporary or minimal backing model before full CRUD/admin UI lands.

## Tasks / Subtasks

- [ ] Task 1: Add shared-auth session plumbing to the SvelteKit `rhymes` app (AC: 1, 3, 4)
  - [ ] Add the necessary `@pocket-dimension/auth` and `@pocket-dimension/db` package dependencies to `apps/rhymes`.
  - [ ] Add the SvelteKit server hook pattern so `event.locals.session` and `event.locals.user` can be populated from Better Auth request headers.
  - [ ] Add the app-level type declarations needed for `locals` so the auth context is typed.
- [ ] Task 2: Introduce rhymes membership authorization boundaries (AC: 1, 2, 5)
  - [ ] Define the first rhymes-specific membership model in shared DB schema or another explicitly temporary seam approved in code comments.
  - [ ] Decide and document the minimal role set to unlock the first authoring controls (for example `owner/admin/editor/contributor/viewer` or a smaller bootstrapping subset).
  - [ ] Add a helper or service function the UI can call to determine whether the current user has rhymes create access.
- [ ] Task 3: Surface auth-aware reader shell state without regressing public access (AC: 1, 2, 4)
  - [ ] Extend the root/server load path so the current reader shell can receive auth-aware page data.
  - [ ] Keep public reading behavior unchanged for anonymous users at `/` and `/:slug`.
  - [ ] Add a simple authenticated marker or dormant authoring shell slot that only appears for users with rhymes create access.
- [ ] Task 4: Validate auth-aware behavior in local development (AC: 1, 2, 3, 4)
  - [ ] Build and typecheck `apps/rhymes` after the auth integration.
  - [ ] Manually verify anonymous behavior still works at both root and slug routes.
  - [ ] Manually verify a session-bearing user with rhymes access sees the gated creator shell affordance.

## Dev Notes

- `rhymes` already runs on SvelteKit with Bun/Vite and `svelte-adapter-bun`; new auth work should integrate into the current `src/routes` structure rather than recreating the old Astro shape. [Source: `apps/rhymes/package.json`, `apps/rhymes/svelte.config.js`, `apps/rhymes/vite.config.ts`]
- The public reader shell is currently rendered through `src/routes/+page.svelte`, `src/routes/[slug]/+page.svelte`, and the shared `src/lib/components/RhymesShell.svelte`. The auth-gating work should preserve those routes and add auth-aware data around them instead of forking a separate reader. [Source: `apps/rhymes/src/routes/+page.svelte`, `apps/rhymes/src/routes/[slug]/+page.svelte`, `apps/rhymes/src/lib/components/RhymesShell.svelte`]
- Existing monorepo SvelteKit auth apps populate `event.locals.session` and `event.locals.user` in `hooks.server.ts` using `auth.api.getSession()` and `svelteKitHandler(...)`. Reuse that pattern as closely as practical for `rhymes`. [Source: `apps/watchlist/src/hooks.server.ts`]
- Shared Better Auth already returns `user.role` with enum values `user`, `contributor`, and `admin`, but the rhymes product direction explicitly prefers rhymes-specific memberships over relying only on the global role field. The first implementation should therefore keep a clean seam for app-specific permissions even if it temporarily maps from global roles while the rhymes schema is being introduced. [Source: `shared/auth/src/index.ts`, `shared/db/src/schema/auth.ts`, `_bmad-output/pocket-dimension/project-context.md`, `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]
- Shared DB helpers already provide `createdById` and `updatedById` via `actionsByUser`; use these conventions if a new rhymes membership schema/table is added. [Source: `shared/db/src/schema/common.ts`, `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]
- The architecture doc now treats SvelteKit as the current framework baseline and calls out Epic 2 Story 2.1 as the next major implementation target. Keep the code aligned with that architecture rather than reintroducing Astro-specific assumptions. [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]
- Local auth-backed apps in this monorepo depend on `auth-service` and PostgreSQL, and AGENTS notes that Better Auth cookies are configured as secure/`sameSite:none`, which can affect localhost session persistence. Testing notes should be honest about that local limitation if encountered. [Source: `AGENTS.md`, `shared/auth/src/index.ts`]

### Project Structure Notes

- Current `rhymes` app structure is SvelteKit-first:
  - `src/routes/+layout.svelte`
  - `src/routes/+page.server.ts`
  - `src/routes/+page.svelte`
  - `src/routes/[slug]/+page.server.ts`
  - `src/routes/[slug]/+page.svelte`
  - `src/lib/components/RhymesShell.svelte`
  - `src/components/FilterSort.svelte`
  - `src/components/RhymeSelector.svelte`
  - `src/lib/loadRhymes.ts`
  - `src/lib/rhymes.ts`
- The first auth increment should add:
  - `src/hooks.server.ts`
  - `src/app.d.ts`
  - optional `src/lib/server/*` helper(s) for membership resolution
  - shared DB/auth dependency entries in `package.json`
- Avoid prematurely adding full editor/auth UI in this story; the goal is server-side auth context + workspace gating seam, not the full draft composer/editor flow yet.

### References

- `apps/rhymes/package.json`
- `apps/rhymes/svelte.config.js`
- `apps/rhymes/vite.config.ts`
- `apps/rhymes/src/routes/+layout.svelte`
- `apps/rhymes/src/routes/+page.server.ts`
- `apps/rhymes/src/routes/[slug]/+page.server.ts`
- `apps/rhymes/src/lib/components/RhymesShell.svelte`
- `apps/watchlist/src/hooks.server.ts`
- `shared/auth/src/index.ts`
- `shared/db/src/schema/auth.ts`
- `shared/db/src/schema/common.ts`
- `AGENTS.md`
- `_bmad-output/pocket-dimension/project-context.md`
- `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`
- `_bmad-output/pocket-dimension/planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
