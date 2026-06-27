# Story 3.1: Create room API and home UI

**Epic:** 3 — Room lifecycle and capacity enforcement  
**Status:** done

## Acceptance criteria

- [x] `POST /api/rooms` requires contributor/admin; 403 for `user`
- [x] Creates room with unique slug and livekit_room_name
- [x] Host set to current user; status `waiting`
- [x] Home UI: New room for contributor/admin only
- [x] Home UI for `user`: join-only with explanation
- [x] Redirect to `/room/[slug]` after create
