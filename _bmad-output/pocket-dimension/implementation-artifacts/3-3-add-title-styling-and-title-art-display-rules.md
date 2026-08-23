# Story 3.3: Add title styling and title-art display rules

Status: ready-for-dev

## Story

As a rhymes creator,
I want to style the title and optionally use title art,
so that I can choose the right presentation for each piece.

## Acceptance Criteria

1. Given a creator edits a piece title, when they apply styles, then text color, background color, font family, and font size can be set for the title.
2. Given a creator uploads title art and chooses title-art display, when the piece renders publicly, then title art takes precedence while text title remains stored as the accessibility and fallback title.
3. Given a creator prefers text-title display, when they select that mode, then the reader shows the styled text title and the title-art asset remains available without forcing display.

## Tasks / Subtasks

- [ ] Task 1: Add title-style editing controls (AC: 1)
  - [ ] Define title-style fields compatible with the long-term document/title model.
  - [ ] Add editor controls for title color, background, font family, and size.
  - [ ] Persist title-style updates independently of body styling.
- [ ] Task 2: Add title-art asset support and display preference (AC: 2, 3)
  - [ ] Introduce the first title-art upload/attachment seam.
  - [ ] Persist `display_title_mode` or equivalent preference.
  - [ ] Ensure the public reader respects title-art precedence when selected.
- [ ] Task 3: Preserve fallback/accessibility title behavior (AC: 2, 3)
  - [ ] Keep text title stored even when title art is displayed.
  - [ ] Ensure route metadata, titles, and screen-reader/fallback flows still have a textual title source.

## Dev Notes

- The architecture already names `display_title_mode`, `title_text_plain`, `title_rich_json`, and `title_art_asset_id` as likely model fields. Follow that direction rather than inventing a parallel ad hoc shape. [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`]
- Product rules are explicit: creator chooses how title text/title art are displayed, but title art takes precedence when chosen and text title remains the fallback. [Source: `_bmad-output/pocket-dimension/project-context.md`, `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]
- Direct slug routes and metadata loads rely on text titles today; do not break route title/description generation when title-art display is introduced. [Source: `apps/rhymes/src/routes/[slug]/+page.server.ts`, `apps/rhymes/src/routes/[slug]/+page.svelte`]

### Project Structure Notes

- Likely touch points:
  - expanded editor/title controls
  - server-side asset handling (upload seam)
  - `apps/rhymes/src/lib/rhymes.ts`
  - slug route metadata generation
  - public reader display component(s)

### References

- `_bmad-output/pocket-dimension/project-context.md`
- `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/pocket-dimension/planning-artifacts/architecture.md`
- `_bmad-output/pocket-dimension/planning-artifacts/epics.md`
- `apps/rhymes/src/routes/[slug]/+page.server.ts`
- `apps/rhymes/src/routes/[slug]/+page.svelte`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
