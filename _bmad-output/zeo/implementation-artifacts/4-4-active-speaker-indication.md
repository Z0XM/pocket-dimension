# Story 4.4: Active speaker indication

**Epic:** 4 — Pre-call lobby and in-call video UI  
**Status:** done

## Acceptance criteria

- [x] Primary speaker tile shows accent ring (off-white primary)
- [x] Subscribes to LiveKit ActiveSpeakersChanged events

## Implementation

- `room-client.ts` → `ParticipantTile.svelte` ring when `isActiveSpeaker`
