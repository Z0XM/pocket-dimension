# Story 3.4: Author and manage explicit page breaks

Status: ready-for-dev

## Story

As a rhymes creator,
I want to insert and reorder page breaks,
so that I can control how a piece is segmented for reading.

## Acceptance Criteria

1. Given a creator is editing a long or structured piece, when they insert page breaks, then the content model stores them explicitly and the reader can honor them in paged mode.
2. Given a creator reorders or removes page breaks, when the piece is saved, then the page sequence updates correctly without losing unrelated content formatting.
3. Public readers continue to open pieces in their configured default mode while consuming the updated page-break model.

## Tasks / Subtasks

- [ ] Task 1: Define explicit page-break representation (AC: 1, 2)
  - [ ] Decide how page breaks are represented in the persisted source/document model.
  - [ ] Keep the representation compatible with the current reader’s paged/continuous behavior.
  - [ ] Preserve compatibility with legacy markdown separators where possible.
- [ ] Task 2: Add editor controls for page-break insertion/removal/reorder (AC: 1, 2)
  - [ ] Introduce the first page-break editing affordance in the expanded editor.
  - [ ] Support removing and reordering existing breaks.
  - [ ] Keep page operations scoped to the current piece without disturbing unrelated metadata.
- [ ] Task 3: Connect page-break persistence to reader output (AC: 1, 3)
  - [ ] Ensure saved page-break structures flow into the reader’s paged mode.
  - [ ] Preserve continuous-mode rendering of the same piece.
  - [ ] Keep direct slug routes and URL-backed page navigation working after edits.

## Dev Notes

- The current reader already supports page-based display using a split-pages model and page navigation controls. This story needs to evolve authoring/persistence, not re-invent the reader-side concept. [Source: `apps/rhymes/src/lib/rhymes.ts`, `apps/rhymes/src/components/RhymeSelector.svelte`]
- The architecture recommends page-break nodes or equivalent explicit markers rather than a separate page table in the first iteration. Follow that bias unless implementation constraints prove otherwise. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- This story must keep the per-piece default reader mode from Story 3.5 compatible with the edited page structure. [Source: `_bmad-output/rhymes/planning-artifacts/epics.md`]

### Project Structure Notes

- Likely touch points:
  - expanded editor component(s)
  - `apps/rhymes/src/lib/rhymes.ts`
  - `apps/rhymes/src/components/RhymeSelector.svelte`
  - route server loads or persistence helpers carrying updated page metadata

### References

- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `apps/rhymes/src/lib/rhymes.ts`
- `apps/rhymes/src/components/RhymeSelector.svelte`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
