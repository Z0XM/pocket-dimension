# Story 8.2: Scheduled rooms

**Epic:** 8 — Admin and scheduling  
**Status:** done

## Acceptance criteria

- [x] FR-42: future start time, persistent link

## Implementation

- `rooms.scheduled_start_at` column (migration 0026)
- `POST /api/rooms` accepts `scheduledStartAt`; future scheduled rooms don't consume capacity until open
- Home page schedule UI + upcoming scheduled rooms list
- Room page blocks join until start time (host can join early)
- Token API returns 403 with open time for early guests
