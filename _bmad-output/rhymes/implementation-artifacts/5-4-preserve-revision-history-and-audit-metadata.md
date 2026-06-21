# Story 5.4: Preserve revision history and audit metadata

Status: ready-for-dev

## Story

As a rhymes admin or owner,
I want changes and critical actions to be traceable,
so that collaborative editing remains safe and recoverable.

## Acceptance Criteria

1. Given a creator or editor saves changes, publishes, hides, unhides, or updates permissions, when the action completes, then the system records the acting user and relevant timestamps.
2. Given a collaborative editing issue occurs, when an admin inspects piece history, then they can identify who changed what and when.
3. The history model supports future revision-browsing features without schema redesign.

## Tasks / Subtasks

- [ ] Task 1: Define revision/audit capture boundaries (AC: 1, 2, 3)
  - [ ] Decide which piece and permission transitions must always be logged.
  - [ ] Extend the persistence model with the minimum history metadata needed now.
- [ ] Task 2: Persist actor/timestamp data for critical actions (AC: 1)
  - [ ] Ensure create/edit/publish/hide/permission flows record acting user + timestamps.
  - [ ] Reuse shared `createdById` / `updatedById` conventions wherever possible.
- [ ] Task 3: Create the first inspectable history seam (AC: 2, 3)
  - [ ] Provide a minimal way for future admin tooling to access historical action data.
  - [ ] Avoid schema shapes that would make later revision browsing awkward or lossy.

## Dev Notes

- The architecture already calls out revision history and auditability as first-class requirements. This story should create the durable foundation rather than a throwaway debug log. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`, `_bmad-output/rhymes/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]
- Shared DB helpers already expose `createdById` and `updatedById`; use those patterns wherever they apply. [Source: `shared/db/src/schema/common.ts`]
- This story is cross-cutting: it should align with Epic 2 publish/hide flows, Epic 4 rating updates, and Epic 5 permission changes. [Source: `_bmad-output/rhymes/planning-artifacts/epics.md`]

### Project Structure Notes

- Likely touch points:
  - shared DB schema/migrations
  - server actions and API endpoints across creator/admin flows
  - future admin history UI seam

### References

- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/rhymes/planning-artifacts/epics.md`
- `shared/db/src/schema/common.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
