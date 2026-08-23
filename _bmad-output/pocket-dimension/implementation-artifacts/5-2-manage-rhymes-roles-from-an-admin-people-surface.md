# Story 5.2: Manage rhymes roles from an admin people surface

Status: ready-for-dev

## Story

As a rhymes admin,
I want to assign rhymes admin or editor access from a management surface,
so that I can manage who is allowed to create and administer content.

## Acceptance Criteria

1. Given a rhymes admin opens the people/settings surface, when they review user entries, then they can assign or update rhymes-specific roles for eligible users.
2. Given a role change is made, when the affected user next loads rhymes, then their visible controls and permissions reflect the updated role.
3. Role changes are attributable to the acting admin for later audit/history work.

## Tasks / Subtasks

- [ ] Task 1: Add an admin-facing people/settings surface (AC: 1)
  - [ ] Provide a basic UI for listing eligible users and their current rhymes role.
  - [ ] Restrict the surface to authorized rhymes admins/owners.
- [ ] Task 2: Implement role update actions (AC: 1, 2, 3)
  - [ ] Add server-side endpoints/actions for changing rhymes roles.
  - [ ] Persist acting-user metadata on role changes.
  - [ ] Ensure updated roles are reflected on subsequent page loads.
- [ ] Task 3: Validate admin-only access (AC: 1, 2)
  - [ ] Confirm non-admin users cannot access or mutate the people surface.
  - [ ] Confirm changed users gain/lose creator/admin affordances as expected.

## Dev Notes

- This story depends on the membership model from Story 5.1. Do not build a people surface against temporary global-role hacks if the membership schema is available. [Source: `_bmad-output/pocket-dimension/implementation-artifacts/5-1-introduce-rhymes-specific-memberships-and-workspace-roles.md`]
- The original product ask explicitly requested a way to mark an account as a rhymes admin from the user table; this is the spec expression of that requirement. [Source: `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`]

### Project Structure Notes

- Likely touch points:
  - rhymes admin routes/components
  - server actions or API endpoints for role updates
  - membership helpers from Story 5.1

### References

- `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md`
- `_bmad-output/pocket-dimension/implementation-artifacts/5-1-introduce-rhymes-specific-memberships-and-workspace-roles.md`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
