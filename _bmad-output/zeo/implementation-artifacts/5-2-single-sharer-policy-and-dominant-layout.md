# Story 5.2: Single sharer policy and dominant layout

**Epic:** 5 — Screen sharing  
**Status:** done

## Acceptance criteria

- [x] New share stops previous sharer's publish (with toast to prior sharer)
- [x] Shared screen as dominant viewport; participants in filmstrip
- [x] Screen share button highlighted when self is sharing

## Implementation

- `POST /api/rooms/[slug]/screen-share/stop-active` — mutes active screen-share tracks via LiveKit RoomService
- `livekit-room.ts` — `stopActiveScreenShares()`
- `CallExperience.svelte` — calls stop-active before new share; toast on involuntary `LocalTrackUnpublished`
- `ScreenShareLayout.svelte` — dominant screen + horizontal filmstrip with compact tiles
- `ControlBar.svelte` — primary highlight when `screenSharing`
