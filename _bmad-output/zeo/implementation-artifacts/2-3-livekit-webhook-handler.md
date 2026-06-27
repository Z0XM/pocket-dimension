# Story 2.3: LiveKit webhook handler

**Epic:** 2 — LiveKit infrastructure and token service  
**Status:** done

## Acceptance criteria

- [x] `POST /api/webhooks/livekit` validates signature
- [x] Handles `participant_joined` and `participant_left`
- [x] Updates `zeo.room_participants` audit rows
- [x] Maintains in-memory live count per room

## Implementation

- `src/routes/api/webhooks/livekit/+server.ts` — `WebhookReceiver`
- `src/lib/server/rooms.ts` — audit insert/update
- `src/lib/server/room-occupancy.ts` — in-memory counts
- Migration `0024_zeo_participant_identity.sql` — `participant_identity` column for webhook matching
