# Story 2.5: Manage hidden-published visibility without reverting to draft

Status: ready-for-dev

## Story

As a rhymes creator,
I want to hide a published piece without turning it back into a draft,
so that I can temporarily remove it from public view while preserving publication history.

## Acceptance Criteria

1. Given a piece is already published, when an authorized creator or admin marks it hidden, then the piece remains published in lifecycle terms but is removed from public discovery and public reading.
2. Given a hidden-published piece should return to public view, when an authorized creator or admin unhides it, then it becomes publicly readable again without losing prior ratings, publication metadata, or revision history.
3. Given public readers browse or open routes, when a piece is hidden, then it is excluded from public result sets and direct public reads.
4. Hidden/public toggles are attributable to the acting user and timestamp-friendly for later audit/revision work.

## Tasks / Subtasks

- [ ] Task 1: Implement hidden-published visibility transitions (AC: 1, 2, 4)
  - [ ] Extend the underlying piece model or interim persistence seam to distinguish `published + hidden` from `draft`.
  - [ ] Add creator/admin actions for hide and unhide without resetting publication metadata.
  - [ ] Persist acting-user/timestamp metadata needed for future history features.
- [ ] Task 2: Apply hidden visibility to public reader queries and routes (AC: 1, 3)
  - [ ] Exclude hidden pieces from root reader discovery results.
  - [ ] Prevent hidden pieces from loading for public users on direct slug routes.
  - [ ] Keep authenticated creator/admin views capable of identifying that a piece exists and is hidden.
- [ ] Task 3: Surface hidden state clearly in creator-facing UI (AC: 1, 2)
  - [ ] Show hidden state distinctly from draft state.
  - [ ] Provide a clear path to unhide a hidden-published piece.
  - [ ] Ensure hide/unhide behavior does not conflict with save-draft or publish actions.
- [ ] Task 4: Validate hidden visibility end to end (AC: 1, 2, 3, 4)
  - [ ] Build and typecheck `apps/rhymes`.
  - [ ] Manually verify a hidden piece disappears from public discovery and direct public reading.
  - [ ] Manually verify an authorized creator/admin can restore visibility without losing prior published state.

## Dev Notes

- This story builds on Story 2.3’s publish action and must preserve the distinction between lifecycle state (`draft` vs `published`) and visibility state (`public` vs `hidden`). Do not overload `draft` to simulate hidden behavior. [Source: `_bmad-output/rhymes/implementation-artifacts/2-3-expose-direct-publish-action-beside-save.md`, `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- The current normalized reader model already carries a `visibility` concept and filters out `draft`/`hidden` items from the public loader. When the persistence layer changes, preserve the same public-query contract. [Source: `apps/rhymes/src/lib/rhymes.ts`]
- Direct slug routes are now first-class. Hidden visibility must affect both discovery queries and direct `/:slug` route access for public users. [Source: `apps/rhymes/src/routes/+page.server.ts`, `apps/rhymes/src/routes/[slug]/+page.server.ts`]
- Ratings and revision/history stories come later, but hiding/unhiding must not discard those future-linked records or timestamps. [Source: `_bmad-output/rhymes/planning-artifacts/epics.md`, `_bmad-output/rhymes/planning-artifacts/architecture.md`]

### Project Structure Notes

- Expected UI touch points:
  - creator-side controls introduced in Stories 2.2–2.4
  - reader shell messaging/state for hidden pieces in creator contexts
- Expected server/data touch points:
  - publish/draft persistence seam from Stories 2.2 and 2.3
  - root and slug route server loads
  - optional API endpoint(s) for hide/unhide transitions
- Keep public-reader behavior simple: hidden means absent from public browse and absent from public direct reads.

### References

- `_bmad-output/rhymes/implementation-artifacts/2-3-expose-direct-publish-action-beside-save.md`
- `_bmad-output/rhymes/project-context.md`
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
