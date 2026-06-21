# Story 5.1: Introduce rhymes-specific memberships and workspace roles

Status: ready-for-dev

## Story

As a rhymes admin,
I want rhymes to manage its own roles separate from global platform roles,
so that I can grow the contributor base without over-privileging users across the whole monorepo.

## Acceptance Criteria

1. Given the rhymes workspace has authenticated users, when memberships are configured, then rhymes-specific roles such as owner, admin, editor, contributor, and viewer are stored independently from global auth roles.
2. Given a user has no rhymes membership, when they sign in, then they can still read public content and do not receive creator/admin controls by default.
3. Workspace role checks can be used by later creator, admin, and collaboration stories.

## Tasks / Subtasks

- [ ] Task 1: Define rhymes-specific membership schema/model (AC: 1, 3)
  - [ ] Add the first rhymes membership structure in shared DB schema.
  - [ ] Model the minimal role set needed for future stories.
- [ ] Task 2: Add membership resolution helpers in the rhymes app (AC: 1, 2, 3)
  - [ ] Load membership by current authenticated user.
  - [ ] Distinguish global auth role from rhymes workspace role.
  - [ ] Default non-members to public-reader-only behavior.
- [ ] Task 3: Wire workspace role checks into the auth seam (AC: 2, 3)
  - [ ] Make creator/admin UI checks consume rhymes membership decisions.
  - [ ] Preserve public-reader behavior for anonymous or non-member users.

## Dev Notes

- Product context explicitly prefers rhymes-specific memberships over global-only auth roles. This story is the formal schema/helper realization of that rule. [Source: `_bmad-output/rhymes/project-context.md`, `_bmad-output/rhymes/planning-artifacts/architecture.md`]
- Story 2.1 may use a temporary seam first; this story is where the long-term membership model should become real. [Source: `_bmad-output/rhymes/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`]
- Shared DB `actionsByUser` conventions should be used if membership tables are created. [Source: `shared/db/src/schema/common.ts`]

### Project Structure Notes

- Likely touch points:
  - `shared/db/src/schema/*`
  - migration files for shared DB
  - rhymes server helpers/hooks

### References

- `_bmad-output/rhymes/project-context.md`
- `_bmad-output/rhymes/planning-artifacts/architecture.md`
- `_bmad-output/rhymes/implementation-artifacts/2-1-add-authenticated-creator-access-and-rhymes-workspace-gating.md`
- `shared/db/src/schema/common.ts`
- `shared/db/src/schema/auth.ts`

## Dev Agent Record

### Agent Model Used

Pending implementation

### Debug Log References

### Completion Notes List

### File List
