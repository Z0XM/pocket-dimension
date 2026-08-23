# Story 2.4: Provide expanded editor for structured piece management

Status: ready-for-dev

## Story

As a rhymes creator,
I want an expanded editor for longer or more structured work,
so that I can manage content type, body, title, and visibility in one place.

## Acceptance Criteria

1. Given a creator opens the expanded editor from a draft or existing piece, when the editor loads, then the creator can set content type, update body/title content, and view the current publication state.
2. Given the editor is used for a draft or published piece, when changes are saved, then the piece state remains explicit and the creator stays within the same reader-first workspace.
3. The expanded editor remains compatible with the current SvelteKit reader shell rather than replacing it with a separate app surface.
4. The editor shape leaves room for Epic 3’s richer formatting, title art, and page-break capabilities without requiring another structural reset.

## Tasks / Subtasks

- [ ] Task 1: Add an expanded-editor entry path from the creator workflow (AC: 1, 3)
  - [ ] Add a clear transition from the quick composer and/or draft cards into a fuller editor surface.
  - [ ] Keep the reader shell visible or readily returnable rather than navigating creators into a disconnected admin-only UI.
  - [ ] Restrict editor entry to users with rhymes edit/create access.
- [ ] Task 2: Implement the structured editor scaffold (AC: 1, 2, 4)
  - [ ] Support core editable fields: content type, title, body seed, visibility/publication state display.
  - [ ] Ensure drafts and published pieces can both be loaded into the same editing surface.
  - [ ] Preserve current piece identity so saving updates the same record rather than creating duplicates.
- [ ] Task 3: Add save/update flow for existing draft and published records (AC: 2)
  - [ ] Persist updates without forcing publish transitions.
  - [ ] Keep draft/private rules intact while editing drafts.
  - [ ] Preserve routing/reader context so the creator remains in the same product experience after save.
- [ ] Task 4: Validate the expanded-editor scaffold locally (AC: 1, 2, 3)
  - [ ] Build and typecheck `apps/rhymes`.
  - [ ] Manually verify opening the editor from a draft and from an existing piece.
  - [ ] Manually verify saving keeps the creator in the reader workspace with updated state visible.

## Dev Notes

- This story assumes Stories 2.1 and 2.2 have already introduced auth-aware gating plus the first draft persistence path. Build on that path rather than creating a second, disconnected editing model. [Source: `_bmad-output/pocket-dimension/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`, `_bmad-output/pocket-dimension/implementation-artifacts/2-2-support-draft-first-quick-composer-creation.md`]
- The architecture calls for the expanded editor to live on top of the SvelteKit baseline and evolve toward a structured document model; avoid creating a temporary UI that hardcodes assumptions incompatible with Epic 3’s source-mode/rich-mode requirements. [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]
- The reader-first product rule still applies even for creators. The expanded editor should feel like a richer mode within `rhymes`, not a totally separate CMS app. [Source: `_bmad-output/pocket-dimension/project-context.md`, `_bmad-output/pocket-dimension/planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/EXPERIENCE.md`]
- Direct slug routes and URL-backed reader state already exist. Editor entry/exit should not destroy those navigation patterns without a strong reason. [Source: `apps/rhymes/src/routes/[slug]/+page.svelte`, `apps/rhymes/src/components/RhymeSelector.svelte`]

### Project Structure Notes

- Expected UI touch points:
  - `src/lib/components/RhymesShell.svelte`
  - current reader components plus a new expanded-editor component (likely under `src/components/` or `src/lib/components/`)
  - a minimal creator shell state store/helper if the expanded editor needs modal/sheet/page state
- Expected server/data touch points:
  - the draft persistence layer from Story 2.2
  - optional SvelteKit API routes for save/update
  - auth-aware server loads from Story 2.1
- The richer body formatting, title art upload, and page-break editing should be stub-friendly here but are fully owned by Epic 3 stories.

### References

- `_bmad-output/pocket-dimension/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`
- `_bmad-output/pocket-dimension/implementation-artifacts/2-2-support-draft-first-quick-composer-creation.md`
- `_bmad-output/pocket-dimension/project-context.md`
- `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`
- `_bmad-output/pocket-dimension/planning-artifacts/epics.md`
- `_bmad-output/pocket-dimension/planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/EXPERIENCE.md`
- `apps/rhymes/src/lib/components/RhymesShell.svelte`
- `apps/rhymes/src/components/RhymeSelector.svelte`
- `apps/rhymes/src/routes/+page.svelte`
- `apps/rhymes/src/routes/[slug]/+page.svelte`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
