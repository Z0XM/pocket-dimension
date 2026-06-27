# Story 7.2: Device picker

**Epic:** 7 — Chat, devices, and waiting room  
**Status:** done

## Acceptance criteria

- [x] FR-38: select mic/camera from enumerated devices in lobby

## Implementation

- `lib/livekit/devices.ts` — enumerate devices, build constraints
- `DevicePicker.svelte` — mic/camera `<select>` controls
- Pre-call lobby device selection + in-call **Devices** button with `switchActiveDevice`
