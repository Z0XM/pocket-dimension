# Story 8.1: Admin dashboard

**Epic:** 8 — Admin and scheduling  
**Status:** done

## Acceptance criteria

- [x] FR-41: list active rooms, participant counts, force-end

## Implementation

- `/admin` route (admin role only)
- `GET /api/admin/rooms` — active rooms with participant counts
- `POST /api/admin/rooms/[slug]/force-end` — operator force-end with audit (`force_ended_by_id`)
- Admin dashboard table with force-end actions
