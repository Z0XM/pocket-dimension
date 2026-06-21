# Story 2.3: Expose direct publish action beside save

Status: ready-for-dev

## Story

As a rhymes creator,
I want a separate publish button beside the save action,
so that I can intentionally publish without changing the safe draft-first default.

## Acceptance Criteria

1. Given a creator is using the quick composer or an eligible draft, when they use the publish action, then the piece transitions to published state only after required validation succeeds.
2. Given publish succeeds, when the piece becomes public, then public reader and discovery queries can include it immediately if visibility is public.
3. Given save-draft and publish actions coexist, when the creator uses one, then the behavior of the other remains explicit and unchanged.
4. Publish actions are attributable to the acting user and timestamped for future revision/audit features.

## Tasks / Subtasks

- [ ] Task 1: Add explicit publish controls adjacent to draft-save controls (AC: 1, 3)
  - [ ] Extend the authenticated composer/editor shell so save-draft and publish are clearly separate actions.
  - [ ] Use labels or affordances that make “save draft” vs “publish now” unambiguous.
  - [ ] Ensure the publish action is unavailable to users without rhymes create/publish access.
- [ ] Task 2: Implement publish transition logic (AC: 1, 2, 4)
  - [ ] Add the first publish transition handler for draft content.
  - [ ] Persist published state, publication timestamp, and acting user metadata.
  - [ ] Keep support for default `public` visibility while preserving the later hidden-published story seam.
- [ ] Task 3: Enforce basic pre-publish validation (AC: 1, 3)
  - [ ] Define the minimal validation rules required before a draft can publish (for example non-empty content and required title/body defaults).
  - [ ] Surface validation failures clearly without mutating the current draft unexpectedly.
  - [ ] Keep the validation path compatible with later Epic 3 richer content requirements.
- [ ] Task 4: Verify publish behavior end to end (AC: 1, 2, 3, 4)
  - [ ] Build and typecheck `apps/rhymes`.
  - [ ] Manually verify a creator can save a draft without publishing it.
  - [ ] Manually verify using publish makes the piece available in the public reader when visibility is public.

## Dev Notes

- This story builds directly on Story 2.2. It should reuse the draft creation seam rather than inventing a separate path for published content. [Source: `_bmad-output/rhymes/implementation-artifacts/2-2-support-draft-first-quick-composer-creation.md`]
- Product rules are explicit: drafts are never public, publish is a separate control beside save, and published content is public by default but can later be hidden. Implement publish in a way that keeps Story 2.5 straightforward. [Source: `_bmad-output/rhymes/project-context.md`, `_bmad-output/rhymes/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]
- The current public-reader shell already filters on `visibility` and route loads are server-backed in SvelteKit. Publishing should wire into those existing reader queries instead of adding a second public-content pipeline. [Source: `apps/rhymes/src/lib/rhymes.ts`, `apps/rhymes/src/routes/+page.server.ts`, `apps/rhymes/src/routes/[slug]/+page.server.ts`]
- Future audit/history work (Epic 5.4) will rely on publication metadata being captured correctly now. Avoid throwing away timestamps or acting-user references. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`, `_bmad-output/rhymes/planning-artifacts/epics.md`]

### Project Structure Notes

- Expected UI touch points:
  - composer/editor controls introduced in Story 2.2
  - shared shell/state components in `src/lib/components/RhymesShell.svelte` and/or a new composer component
- Expected server/data touch points:
  - route-server loads or new API endpoints under `src/routes/api/*`
  - draft persistence seam introduced earlier in Epic 2
  - future visibility fields should already be represented in the underlying model
- Keep visibility defaults simple in this story; full hide/unhide workflow belongs in Story 2.5.

### References

- `_bmad-output/rhymes/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`
- `_bmad-output/rhymes/implementation-artifacts/2-2-support-draft-first-quick-composer-creation.md`
- `_bmad-output/rhymes/project-context.md`
- `_bmad-output/rhymes/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `apps/rhymes/src/lib/rhymes.ts`
- `apps/rhymes/src/routes/+page.server.ts`
- `apps/rhymes/src/routes/[slug]/+page.server.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
