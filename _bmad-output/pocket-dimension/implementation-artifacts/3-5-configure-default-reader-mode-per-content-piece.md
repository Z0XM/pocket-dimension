# Story 3.5: Configure default reader mode per content piece

Status: ready-for-dev

## Story

As a rhymes creator,
I want to choose whether each piece opens paged or continuous,
so that each work can present itself in the most suitable form.

## Acceptance Criteria

1. Given a piece supports both paged and continuous rendering, when the creator sets a default reader mode, then that preference is stored on the piece record and public readers open into that configured mode by default.
2. Given a piece has no meaningful page segmentation, when the creator selects continuous mode, then the reader defaults to continuous display and the mode selection remains independent of content type.
3. URL-backed reader state and direct slug routes remain compatible with the stored default mode.

## Tasks / Subtasks

- [ ] Task 1: Persist per-piece default reader mode (AC: 1, 2)
  - [ ] Ensure the piece model carries `paged` vs `continuous` mode as first-class metadata.
  - [ ] Save creator changes to default mode through the editor flow.
  - [ ] Keep legacy content behavior sensible when no explicit mode is set.
- [ ] Task 2: Add creator-facing mode controls (AC: 1, 2)
  - [ ] Surface mode selection in the expanded editor or piece-management UI.
  - [ ] Prevent nonsensical paged defaults when a piece has no usable page segmentation.
- [ ] Task 3: Keep reader routing/state in sync with the stored default (AC: 1, 3)
  - [ ] Ensure server loads and client-side reader hydration start from the persisted default mode.
  - [ ] Preserve current query-param overrides and direct slug route behavior.

## Dev Notes

- The current reader already supports `paged` and `continuous` modes, and URL state can override them. This story is about making creator choice persistent per piece. [Source: `apps/rhymes/src/components/RhymeSelector.svelte`, `apps/rhymes/src/lib/rhymes.ts`]
- Product rules explicitly say default reader mode is configured per content piece, not rigidly by content type. Preserve that distinction in naming and validation. [Source: `_bmad-output/pocket-dimension/project-context.md`, `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]
- Public routes already restore piece/mode/page context from URL state. Persisted defaults must coexist with that current reader-state behavior rather than replacing it. [Source: `apps/rhymes/src/components/RhymeSelector.svelte`, `apps/rhymes/src/routes/[slug]/+page.server.ts`]

### Project Structure Notes

- Likely touch points:
  - expanded editor controls
  - `apps/rhymes/src/lib/rhymes.ts`
  - `apps/rhymes/src/components/RhymeSelector.svelte`
  - piece load/save helpers in the SvelteKit app

### References

- `_bmad-output/pocket-dimension/project-context.md`
- `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/pocket-dimension/planning-artifacts/epics.md`
- `apps/rhymes/src/lib/rhymes.ts`
- `apps/rhymes/src/components/RhymeSelector.svelte`
- `apps/rhymes/src/routes/[slug]/+page.server.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
