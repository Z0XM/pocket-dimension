# Story 3.4: End room and cleanup

**Epic:** 3 — Room lifecycle and capacity enforcement  
**Status:** done

## Acceptance criteria

- [x] `POST /api/rooms/[slug]/end` host-only; sets status `ended`, ended_at
- [x] Disconnects LiveKit room via server API
- [x] Last participant leaving triggers ended state after 60s grace
- [x] Ended rooms reject new tokens
