# Story 4.2: Allow any logged-in user to rate and update ratings

Status: ready-for-dev

## Story

As a logged-in reader,
I want to rate a piece and revise my score later,
so that my view of a work can be reflected over time.

## Acceptance Criteria

1. Given a reader is logged in, when they view a published public piece, then they can submit a rating from 0 to 10 and the system records it against their identity.
2. Given the same reader has already rated the piece, when they submit a different rating, then the previous rating is updated rather than duplicated.
3. Anonymous users cannot submit ratings.

## Tasks / Subtasks

- [ ] Task 1: Add user-rating persistence model (AC: 1, 2)
  - [ ] Introduce the per-user rating record structure described in the architecture.
  - [ ] Ensure a user can have at most one current rating per piece.
- [ ] Task 2: Add logged-in rating controls in the public reader (AC: 1, 3)
  - [ ] Show rating controls only when a logged-in user is eligible.
  - [ ] Hide or disable rating interaction for anonymous users.
- [ ] Task 3: Support update semantics for existing ratings (AC: 2)
  - [ ] Replace prior user ratings rather than creating duplicates.
  - [ ] Keep aggregate computation paths compatible with updates.

## Dev Notes

- Product rules are explicit: any logged-in user can rate content. Do not introduce an approval-only gate here. [Source: `_bmad-output/pocket-dimension/project-context.md`, `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]
- This story depends on Epic 2 auth/session groundwork so the reader can identify a logged-in user. [Source: `_bmad-output/pocket-dimension/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`]
- The architecture already calls for a separate `rhymes_piece_ratings` table or equivalent store. Keep user ratings distinct from creator ratings. [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]

### Project Structure Notes

- Likely touch points:
  - auth/session seam from Epic 2
  - public reader UI
  - server/API handlers for rating create/update
  - future DB schema for `rhymes_piece_ratings`

### References

- `_bmad-output/pocket-dimension/project-context.md`
- `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`
- `_bmad-output/pocket-dimension/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
