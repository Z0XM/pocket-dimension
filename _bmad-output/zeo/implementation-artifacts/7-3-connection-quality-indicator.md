# Story 7.3: Connection quality indicator

**Epic:** 7 — Chat, devices, and waiting room  
**Status:** done

## Acceptance criteria

- [x] FR-39: quality badge on self tile or status bar

## Implementation

- `lib/livekit/connection-quality.ts` — maps LiveKit `ConnectionQuality` to labels
- `ConnectionQualityBadge.svelte` — excellent / good / poor badge
- `room-client.ts` — `ConnectionQualityChanged` event handler
- Badge shown top-left during in-call
