# Story 5.3: Grant piece-level edit access

Status: ready-for-dev

## Story

As a rhymes admin or owner,
I want to grant edit access on specific pieces,
so that contributors can work on assigned content without broad workspace ownership.

## Acceptance Criteria

1. Given a piece exists and a user is eligible for collaboration, when an authorized admin/owner grants piece-level edit access, then that user can edit the assigned piece within the allowed scope.
2. Given piece-level access is revoked, when the affected user reloads or attempts to edit, then editing capability for that piece is removed while unrelated pieces remain protected.
3. Piece-level access changes preserve attribution for later history and audit features.

## Tasks / Subtasks

- [ ] Task 1: Define piece-level permission model (AC: 1, 2, 3)
  - [ ] Add a `rhymes_piece_permissions` structure or equivalent.
  - [ ] Model user/piece/permission relationships in a way that fits future collaboration stories.
- [ ] Task 2: Add grant/revoke flows for admins/owners (AC: 1, 2)
  - [ ] Provide a creator/admin UI or action surface for assigning piece-specific access.
  - [ ] Restrict grant/revoke capabilities to authorized roles.
- [ ] Task 3: Apply permission checks to editing flows (AC: 1, 2)
  - [ ] Ensure edit routes/actions recognize piece-level grants.
  - [ ] Ensure revocation takes effect on reload and on attempted mutations.

## Dev Notes

- The architecture already anticipates `rhymes_piece_permissions`; use that as the guiding shape. [Source: `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- This story extends workspace membership, not replaces it: piece-level grants sit beneath the broader rhymes role model. [Source: `_bmad-output/rhymes/project-context.md`, `_bmad-output/rhymes/implementation-artifacts/5-1-introduce-rhymes-specific-memberships-and-workspace-roles.md`]

### Project Structure Notes

- Likely touch points:
  - shared DB schema/migrations
  - rhymes server auth/permission helpers
  - admin/editor UI surfaces

### References

- `_bmad-output/rhymes/project-context.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/implementation-artifacts/5-1-introduce-rhymes-specific-memberships-and-workspace-roles.md`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
