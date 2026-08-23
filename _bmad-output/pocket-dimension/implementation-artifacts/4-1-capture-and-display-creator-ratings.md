# Story 4.1: Capture and display creator ratings

Status: ready-for-dev

## Story

As a rhymes creator,
I want to rate my own piece,
so that readers can see my intended or reflective score alongside the work.

## Acceptance Criteria

1. Given a creator is editing or managing a piece, when they set a rating from 0 to 10, then the value is stored as the creator rating for that piece.
2. Given the creator changes their rating later, when the update is saved, then the new creator rating replaces the old one.
3. Given a piece is shown publicly, when creator rating exists, then it is displayed separately from community ratings.

## Tasks / Subtasks

- [ ] Task 1: Add creator-rating storage to the piece model (AC: 1, 2)
  - [ ] Persist a 0–10 creator rating field with the piece.
  - [ ] Validate allowed range and update semantics.
- [ ] Task 2: Add creator-rating controls to creator-facing UI (AC: 1, 2)
  - [ ] Surface a creator rating input in draft/editor or piece-management flows.
  - [ ] Ensure edits update the same piece cleanly.
- [ ] Task 3: Expose creator rating in the public reader distinctly (AC: 3)
  - [ ] Render creator score separately from future community aggregates.
  - [ ] Keep current reader shell visually coherent with the dedicated rating display.

## Dev Notes

- Creator rating is its own field on the piece model and must not be conflated with community aggregates. [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`, `_bmad-output/pocket-dimension/planning-artifacts/epics.md`]
- The current public reader already shows a single rating value from legacy frontmatter. This story should replace that simplistic interpretation with a deliberate creator-rating concept. [Source: `apps/rhymes/src/components/RhymeSelector.svelte`, `apps/rhymes/src/lib/rhymes.ts`]

### Project Structure Notes

- Likely touch points:
  - piece persistence/model helpers
  - creator editor/management UI
  - public reader display component(s)

### References

- `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`
- `_bmad-output/pocket-dimension/planning-artifacts/epics.md`
- `apps/rhymes/src/components/RhymeSelector.svelte`
- `apps/rhymes/src/lib/rhymes.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
