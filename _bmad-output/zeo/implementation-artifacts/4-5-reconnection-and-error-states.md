# Story 4.5: Reconnection and error states

**Epic:** 4 — Pre-call lobby and in-call video UI  
**Status:** done

## Acceptance criteria

- [x] Reconnecting banner (non-blocking)
- [x] Fatal disconnect shows rejoin CTA if room active
- [x] Ended room shows "This room has ended"

## Implementation

- `ConnectionBanner.svelte` + disconnect reason handling in `CallExperience.svelte`
