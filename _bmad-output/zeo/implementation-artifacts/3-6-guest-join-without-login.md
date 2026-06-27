# Story 3.6: Guest join without login

**Epic:** 3 — Room lifecycle and capacity enforcement  
**Status:** done

## Acceptance criteria

- [x] `/room/[slug]` accessible without session; prompts for display name
- [x] Token accepts `{ guestName, guestIdentity? }` without session
- [x] Issues token with identity `guest_<uuid>` and sanitized display name
- [x] Rate limit guest token requests per IP (20/hour/room)
- [x] Guest tiles show "Guest" badge in people panel
- [x] Guests cannot access create/end/remove APIs
