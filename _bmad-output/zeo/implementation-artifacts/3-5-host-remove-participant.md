# Story 3.5: Host remove participant

**Epic:** 3 — Room lifecycle and capacity enforcement  
**Status:** done

## Acceptance criteria

- [x] Host can remove via people panel → confirm
- [x] Server calls LiveKit RemoveParticipant
- [x] Inserts `room_session_blocks` row
- [x] Token endpoint rejects blocked identity
- [x] Audit row records `removed_by_id`
- [x] Rejoin attempt shows block message (guest identity persisted in sessionStorage)
