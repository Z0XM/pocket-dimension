# Story 7.4: Waiting room

**Epic:** 7 — Chat, devices, and waiting room  
**Status:** done

## Acceptance criteria

- [x] FR-37: host admits participants before LiveKit connect

## Implementation

- DB: `rooms.waiting_room_enabled`, `zeo.room_waiting_entries` (migration 0025)
- Token API returns `{ status: "waiting" }` until host admits
- `GET/POST /api/rooms/[slug]/waiting` — poll status, host admit/deny
- `WaitingRoomView.svelte` — guest waiting UI with poll
- `HostWaitingPanel.svelte` — host admit/deny in lobby
- Create room checkbox on home page
