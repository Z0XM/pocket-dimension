# Story 5.3: Call snapshot

**Epic:** 5 — Screen sharing  
**Status:** done

## Acceptance criteria

- [x] Snapshot button in control bar
- [x] Captures visible call layout (grid or screen-share-dominant) to PNG
- [x] Downloads as `zeo-{slug}-{timestamp}.png` to user's device
- [x] Brief visual feedback on capture (flash + toast "Snapshot saved")
- [x] Works with 1–6 participants and during active screen share
- [x] No server upload in MVP (FR-43a)

## Implementation

- `snapshot.ts` — canvas composite from stage `<video>` elements → PNG download
- `CallStage.svelte` — exposes stage root element via `bind:stageRef`
- `CallExperience.svelte` — snapshot flash overlay + toast feedback
