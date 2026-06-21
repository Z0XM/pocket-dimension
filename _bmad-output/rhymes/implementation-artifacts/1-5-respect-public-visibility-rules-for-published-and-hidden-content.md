# Story 1.5: Respect public visibility rules for published and hidden content

Status: ready-for-dev

## Story

As a public reader,
I want to see only content meant for public reading,
so that hidden or draft pieces never leak into the public experience.

## Acceptance Criteria

1. Given the content store contains drafts, public published pieces, and hidden published pieces, when a public reader browses rhymes, then only public published pieces are included in browse results and direct reader surfaces.
2. Given a hidden or draft piece is requested by a public user, when the reader route or fetch is evaluated, then the system denies public access safely and does not expose private metadata in the response payload.
3. Public discovery, direct slug routes, and URL-restored reading state all follow the same visibility rules.

## Tasks / Subtasks

- [ ] Task 1: Normalize public visibility handling in the current SvelteKit reader (AC: 1, 2, 3)
  - [ ] Review the current `visibility` filtering behavior in the markdown loader and document where it is public-only.
  - [ ] Ensure root and slug route server loads both honor the same public visibility rule.
  - [ ] Prevent private metadata from leaking through route data for hidden/draft pieces.
- [ ] Task 2: Add a safe public access outcome for non-public pieces (AC: 2)
  - [ ] Decide whether hidden/draft routes should 404, redirect, or return another safe public response.
  - [ ] Keep that behavior consistent across server loads and client navigation.
- [ ] Task 3: Verify discovery and URL-backed reader state respect visibility uniformly (AC: 1, 3)
  - [ ] Confirm hidden/draft content cannot be surfaced by search, filters, or direct slug routes for public users.
  - [ ] Confirm URL-backed reader restoration cannot bypass visibility restrictions.

## Dev Notes

- The current `rhymes` loader already filters out `draft` and `hidden` in the normalized content model. This story should preserve that behavior while moving the rule toward a future server/database-backed source of truth. [Source: `apps/rhymes/src/lib/rhymes.ts`, `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- `rhymes` now has direct slug routes and URL-backed state restoration. Visibility enforcement must apply equally to root discovery and slug entry points. [Source: `apps/rhymes/src/routes/+page.server.ts`, `apps/rhymes/src/routes/[slug]/+page.server.ts`, `apps/rhymes/src/components/RhymeSelector.svelte`]
- This story is still public-reader-facing; do not couple it to creator UI or auth-gated flows from Epic 2. [Source: `_bmad-output/rhymes/planning-artifacts/epics.md`]

### Project Structure Notes

- Primary touch points:
  - `apps/rhymes/src/lib/rhymes.ts`
  - `apps/rhymes/src/lib/loadRhymes.ts`
  - `apps/rhymes/src/routes/+page.server.ts`
  - `apps/rhymes/src/routes/[slug]/+page.server.ts`
  - optionally `apps/rhymes/src/components/RhymeSelector.svelte` for defensive handling

### References

- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `apps/rhymes/src/lib/rhymes.ts`
- `apps/rhymes/src/lib/loadRhymes.ts`
- `apps/rhymes/src/routes/+page.server.ts`
- `apps/rhymes/src/routes/[slug]/+page.server.ts`
- `apps/rhymes/src/components/RhymeSelector.svelte`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
