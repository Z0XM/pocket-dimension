# Story 3.1: Support plain text, Markdown, and HTML editing modes

Status: ready-for-dev

## Story

As a rhymes creator,
I want to work in plain text, Markdown, or HTML,
so that I can use the authoring mode best suited to the piece and my editing style.

## Acceptance Criteria

1. Given a creator opens the expanded editor, when they choose a source mode, then the editor supports plain text, Markdown, and HTML as valid editing modes.
2. Given existing Markdown or HTML content exists, when the creator reopens it, then the content can be edited directly in its chosen mode.
3. Given HTML content is authored or edited, when it is saved for public rendering, then the system sanitizes the rendered result without corrupting valid author intent.

## Tasks / Subtasks

- [ ] Task 1: Add editor-mode state for plain text, Markdown, and HTML (AC: 1, 2)
  - [ ] Introduce mode selection state in the expanded editor scaffold from Story 2.4.
  - [ ] Define how existing pieces store and reopen their current source mode.
  - [ ] Keep current markdown-based public rendering compatible while the richer content model evolves.
- [ ] Task 2: Support mode-specific editing and persistence (AC: 1, 2)
  - [ ] Ensure plain text, Markdown, and HTML bodies can be loaded, edited, and saved.
  - [ ] Preserve piece identity and publication state while switching modes.
  - [ ] Define a source payload shape that can later coexist with the structured document model.
- [ ] Task 3: Add safe HTML sanitization for public output (AC: 3)
  - [ ] Choose or introduce an HTML sanitization layer suitable for SvelteKit/server rendering.
  - [ ] Ensure unsafe markup is rejected or stripped before public output.
  - [ ] Add tests or validation coverage for safe/unsafe HTML examples.

## Dev Notes

- The public reader currently renders markdown via `marked` and `{@html}`. This story is where the first real author-controlled HTML path needs sanitization guarantees. [Source: `apps/rhymes/src/components/RhymeSelector.svelte`, `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- The architecture already expects a two-layer content model: canonical structured JSON plus optional source payloads for plain text/Markdown/HTML. The first implementation can stage toward that, but should not trap the code in a markdown-only model. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- Build this on top of the expanded editor from Story 2.4 and the auth/gating work from Epic 2. [Source: `_bmad-output/rhymes/implementation-artifacts/2-4-provide-expanded-editor-for-structured-piece-management.md`, `_bmad-output/rhymes/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`]

### Project Structure Notes

- Likely touch points:
  - expanded editor component introduced in Story 2.4
  - `apps/rhymes/src/components/RhymeSelector.svelte`
  - `apps/rhymes/src/lib/rhymes.ts`
  - new server/persistence helpers under `apps/rhymes/src/lib/server/*` or API routes

### References

- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/implementation-artifacts/2-4-provide-expanded-editor-for-structured-piece-management.md`
- `apps/rhymes/src/components/RhymeSelector.svelte`
- `apps/rhymes/src/lib/rhymes.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
