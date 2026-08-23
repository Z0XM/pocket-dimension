# Story 2.2: Support draft-first quick composer creation

Status: ready-for-dev

## Story

As a rhymes creator,
I want the bottom composer to save a draft when I press `Enter`,
so that I can capture new writing quickly without accidentally publishing it.

## Acceptance Criteria

1. Given a creator with rhymes create access is in the authenticated workspace, when they enter short-form content in the bottom composer and press `Enter`, then a new draft content piece is created and associated with the current creator.
2. Given the quick composer saves successfully, when the draft is created, then the UI clearly confirms draft state and the piece is not exposed publicly.
3. Given the creator lacks rhymes create access or is anonymous, when they view the public reader, then the quick composer is not visible or interactive.
4. The initial quick-composer implementation can use a minimal draft persistence seam, but it must preserve the future path to the richer DB-backed content model described in the architecture.

## Tasks / Subtasks

- [ ] Task 1: Add a creator-only quick-composer surface to the existing SvelteKit reader shell (AC: 1, 3)
  - [ ] Introduce a composer slot or bottom-docked component that only renders when the auth/membership seam from Story 2.1 grants create access.
  - [ ] Keep the current reader shell intact for anonymous/public users.
  - [ ] Ensure mobile and desktop layouts still preserve the primary reading canvas while the composer is visible.
- [ ] Task 2: Implement draft-first interaction semantics (AC: 1, 2)
  - [ ] Capture Enter-to-save behavior with Shift+Enter or another explicit mechanism reserved for multiline expansion if needed.
  - [ ] Validate that empty or whitespace-only submissions do not create drafts.
  - [ ] Show immediate draft confirmation feedback after save.
- [ ] Task 3: Add the first draft persistence seam (AC: 1, 2, 4)
  - [ ] Decide whether the first increment writes to an interim store or the first rhymes DB tables introduced for Epic 2.
  - [ ] Persist the minimum metadata needed for a draft: creator, body seed, content type default, timestamps, and private state.
  - [ ] Ensure newly created drafts remain non-public in all reader queries and route loads.
- [ ] Task 4: Validate quick-composer behavior locally (AC: 1, 2, 3)
  - [ ] Build and typecheck `apps/rhymes`.
  - [ ] Manually verify that anonymous users do not see the composer.
  - [ ] Manually verify that an authorized creator can create a draft without publishing it.

## Dev Notes

- This story depends on Story 2.1 providing a session/user context plus a rhymes create-access decision seam. Do not hardcode creator access directly into the composer; consume the gating seam established in Story 2.1. [Source: `_bmad-output/pocket-dimension/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`]
- The current UI shell lives in `src/lib/components/RhymesShell.svelte` and the reader layout is driven by `src/components/RhymeSelector.svelte`. The bottom composer should integrate into this existing shell rather than replacing the public-reader workflow. [Source: `apps/rhymes/src/lib/components/RhymesShell.svelte`, `apps/rhymes/src/components/RhymeSelector.svelte`]
- The product rules are explicit: drafts are never public, quick composer saves drafts on `Enter`, and publish is a separate action. Keep those rules visible in naming, persistence flags, and UI copy. [Source: `_bmad-output/pocket-dimension/project-context.md`, `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]
- The architecture still prefers a DB-backed content model with future structured JSON documents; even if this story uses a narrow first persistence layer, avoid coding a dead-end local-only draft path that cannot evolve into Epic 3 and later stories. [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]
- Current public routes are `src/routes/+page.svelte` and `src/routes/[slug]/+page.svelte` with server loads in the matching `+page.server.ts` files. Any authenticated draft indicator or returned page data should remain compatible with both routes. [Source: `apps/rhymes/src/routes/+page.server.ts`, `apps/rhymes/src/routes/[slug]/+page.server.ts`]

### Project Structure Notes

- Expected UI touch points:
  - `src/lib/components/RhymesShell.svelte`
  - `src/components/RhymeSelector.svelte`
  - likely a new composer component under `src/components/`
- Expected server/data touch points:
  - `src/routes/+page.server.ts`
  - `src/routes/[slug]/+page.server.ts`
  - `src/lib/server/*` helpers or new API routes under `src/routes/api/*`
  - possible shared DB/auth additions if draft persistence is introduced in this story
- Keep draft creation narrowly scoped; rich formatting, expanded editor flows, and publish transitions are separate stories.

### References

- `_bmad-output/pocket-dimension/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`
- `_bmad-output/pocket-dimension/project-context.md`
- `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`
- `_bmad-output/pocket-dimension/planning-artifacts/epics.md`
- `apps/rhymes/src/lib/components/RhymesShell.svelte`
- `apps/rhymes/src/components/RhymeSelector.svelte`
- `apps/rhymes/src/routes/+page.server.ts`
- `apps/rhymes/src/routes/[slug]/+page.server.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
