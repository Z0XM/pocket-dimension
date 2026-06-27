# Story 1.3: Add zeo database schema and migrations

**Epic:** 1 — Platform scaffold and auth integration  
**Status:** done

## User story

**As a** developer,  
**I want** PostgreSQL schema `zeo` with rooms table,  
**So that** room metadata persists.

## Acceptance criteria

- [x] Drizzle schema in `shared/db` for `zeo.rooms` per architecture.md
- [x] Migration applies on PostgreSQL 18
- [x] Uses uuidv7() default id pattern from common schema

## Implementation notes

- Added `shared/db/src/schema/zeo.ts` with schema `zeo` and tables:
  - `rooms` — slug, livekit_room_name, display_name, host, status enum, max_participants, audit fields
  - `room_participants` — audit trail for joins/leaves (supports guests)
  - `room_session_blocks` — blocks rejoin after host remove
- Registered in `shared/db/src/schema/index.ts` and `drizzle.config.ts`
- Migration `0023_zeo_schema.sql` applied successfully
- Removed duplicate `hidden_from_public` ALTER from generated migration (already in `0022`)

## References

- `_bmad-output/zeo/planning-artifacts/architecture.md` §4 Domain model
