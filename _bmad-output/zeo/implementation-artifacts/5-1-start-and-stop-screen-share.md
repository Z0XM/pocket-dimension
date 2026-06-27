# Story 5.1: Start and stop screen share

**Epic:** 5 — Screen sharing  
**Status:** done

## Acceptance criteria

- [x] Share button in control bar starts `getDisplayMedia` via LiveKit
- [x] Stop share returns to grid layout
- [x] Banner: "{Name} is sharing their screen"

## Implementation

- `ControlBar.svelte` — Share / Stop share toggle
- `CallExperience.svelte` — `toggleScreenShare()` via `setScreenShareEnabled`
- `CallStage.svelte` — switches between `VideoGrid` and `ScreenShareLayout`
- `ScreenShareLayout.svelte` — sharing banner
- `ScreenShareVideo.svelte` — attaches screen-share track to `<video>`
