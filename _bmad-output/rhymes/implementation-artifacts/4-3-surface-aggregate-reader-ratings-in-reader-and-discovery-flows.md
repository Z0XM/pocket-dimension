# Story 4.3: Surface aggregate reader ratings in reader and discovery flows

Status: ready-for-dev

## Story

As a public or logged-in reader,
I want to see community rating information clearly,
so that I can understand how the audience responds to a piece without confusing it with the creator's own rating.

## Acceptance Criteria

1. Given a piece has one or more reader ratings, when it is shown in the reader or discovery UI, then the average reader rating and rating count are available for display.
2. Given creator rating also exists, when the piece is displayed, then creator rating remains visually distinct from community aggregates.
3. Given discovery uses rating-aware sorting or filtering, when the reader applies those controls, then the product can sort using the stored aggregate values.

## Tasks / Subtasks

- [ ] Task 1: Add aggregate rating fields or aggregation strategy (AC: 1, 3)
  - [ ] Decide whether reader averages/counts are computed on demand or persisted alongside the piece.
  - [ ] Ensure updates from Story 4.2 flow into the aggregate values.
- [ ] Task 2: Display aggregate ratings distinctly in reader/discovery UI (AC: 1, 2)
  - [ ] Render count and average for community ratings.
  - [ ] Keep creator score visually distinct from reader aggregates.
- [ ] Task 3: Connect aggregate ratings to discovery controls (AC: 3)
  - [ ] Ensure sort/filter paths can consume aggregate rating data.
  - [ ] Keep discovery responsive as rating volume grows.

## Dev Notes

- The architecture already names `reader_average_rating` and `reader_rating_count` as part of the target piece model. Use that as the baseline. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- The current discovery rail already supports sorting/filtering concepts. This story should extend that public-reader path rather than creating a separate ratings page. [Source: `apps/rhymes/src/components/FilterSort.svelte`, `apps/rhymes/src/components/RhymeSelector.svelte`]
- This story depends on both creator ratings (Story 4.1) and user ratings (Story 4.2). [Source: `_bmad-output/rhymes/implementation-artifacts/4-1-capture-and-display-creator-ratings.md`, `_bmad-output/rhymes/implementation-artifacts/4-2-allow-any-logged-in-user-to-rate-and-update-ratings.md`]

### Project Structure Notes

- Likely touch points:
  - public reader shell and discovery components
  - rating aggregation helpers/server routes
  - piece loader model

### References

- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `_bmad-output/rhymes/implementation-artifacts/4-1-capture-and-display-creator-ratings.md`
- `_bmad-output/rhymes/implementation-artifacts/4-2-allow-any-logged-in-user-to-rate-and-update-ratings.md`
- `apps/rhymes/src/components/FilterSort.svelte`
- `apps/rhymes/src/components/RhymeSelector.svelte`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
