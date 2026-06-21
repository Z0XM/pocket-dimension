# Story 3.2: Add rich inline body styling controls

Status: ready-for-dev

## Story

As a rhymes creator,
I want to style specific parts of the body text,
so that I can control emphasis and presentation within a piece.

## Acceptance Criteria

1. Given a creator selects a body range in the expanded editor, when they apply a style, then text color, background color, font family, and font size can be assigned to that range.
2. Given styled content is saved, when the piece is reloaded or rendered publicly, then the styled result persists.
3. Given styled content is displayed publicly, when the piece is rendered, then readability constraints and accessibility fallbacks are still respected.

## Tasks / Subtasks

- [ ] Task 1: Introduce a body-range styling model (AC: 1, 2)
  - [ ] Define how inline style spans are represented in persistence.
  - [ ] Add the initial editor UI affordance for selecting and styling body ranges.
  - [ ] Keep the representation compatible with later structured-document expansion.
- [ ] Task 2: Persist and render inline body styles (AC: 1, 2)
  - [ ] Save styled spans with the piece body.
  - [ ] Ensure public rendering rehydrates the same styling output.
  - [ ] Keep source-mode editing behavior predictable when styles coexist with markup.
- [ ] Task 3: Enforce readability/accessibility constraints (AC: 3)
  - [ ] Add validation or warnings for illegible combinations.
  - [ ] Preserve readable defaults when style metadata is incomplete or invalid.

## Dev Notes

- The architecture already assumes span-level formatting support in the future document model. This story should treat inline style ranges as first-class data, not ad hoc string replacement. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- The current reader uses a restrained shell theme; body-level styling is where creator expression increases. Guardrails must keep public output readable. [Source: `_bmad-output/rhymes/project-context.md`, `_bmad-output/rhymes/planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/DESIGN.md`]
- This story depends on the editor-mode/persistence groundwork from Story 3.1 and the expanded editor from Story 2.4. [Source: `_bmad-output/rhymes/implementation-artifacts/3-1-support-plain-text-markdown-and-html-editing-modes.md`, `_bmad-output/rhymes/implementation-artifacts/2-4-provide-expanded-editor-for-structured-piece-management.md`]

### Project Structure Notes

- Likely touch points:
  - expanded editor component(s)
  - future editor state/store helpers
  - `apps/rhymes/src/components/RhymeSelector.svelte` public render path
  - `apps/rhymes/src/lib/rhymes.ts` or adjacent persistence types

### References

- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/project-context.md`
- `_bmad-output/rhymes/planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/DESIGN.md`
- `_bmad-output/rhymes/implementation-artifacts/3-1-support-plain-text-markdown-and-html-editing-modes.md`
- `_bmad-output/rhymes/implementation-artifacts/2-4-provide-expanded-editor-for-structured-piece-management.md`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
