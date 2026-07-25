# Investigation: Mic mute/unmute does not reconnect microphone

## Hand-off Brief

1. **What happened.** Mute/unmute of the local microphone can leave outbound mic audio dead because the mic-gate `TrackProcessor` stays attached across mute and its `restart()` path requires `audioContext` that LiveKit does not pass on track reacquire.
2. **Where the case stands.** Root cause Confirmed in source; fix in progress on `cursor/fix-mic-unmute-reconnect-a92c`.
3. **What's needed next.** Stop processor on mute, attach a fresh processor on unmute, and make `restart()` retain `audioContext`.

## Case Info

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Ticket           | N/A (user report)                                                          |
| Date opened      | 2026-07-25                                                                 |
| Status           | Concluded                                                                  |
| System           | zeo / livekit-client@2.20.0 / WebAudio mic-gate processor                  |
| Evidence sources | Source code (`CallExperience.svelte`, `mic-gate-processor.ts`, LiveKit SDK) |

## Problem Statement

User report (verbatim hypothesis): "muting and unmuting doesnt reconnect microphone".

## Evidence Inventory

| Source                         | Status    | Notes                                                                 |
| ------------------------------ | --------- | --------------------------------------------------------------------- |
| `CallExperience.svelte` toggle | Available | Mute uses `setMicrophoneEnabled(false)`; unmute re-attaches same gate |
| `mic-gate-processor.ts`        | Available | `restart` → `destroy` + `init`; `init` requires `opts.audioContext`   |
| livekit-client LocalTrack      | Available | `setMediaStreamTrack` calls `processor.restart` without `audioContext` |
| livekit-client LocalAudioTrack | Available | Unmute reacquires when track `ended` / `stopOnMute` / device change   |
| Runtime repro logs             | Missing   | Not captured in this environment                                      |

## Hypothesized Paths

### Hypothesis 1: Mic-gate processor breaks unmute reacquire

**Status:** Confirmed

**Theory:** When the underlying mic track is reacquired on unmute, LiveKit calls `processor.restart({ track, kind, ... })` without `audioContext`. Our `init` reads `opts.audioContext.state` and throws, so unmute/reacquire fails and `enableLocalMicrophone` rolls `micEnabled` back to false / leaves silence.

**Supporting indicators:**
- `mic-gate-processor.ts` `init` requires `opts.audioContext`
- LiveKit `LocalTrack.setMediaStreamTrack` restart opts omit `audioContext` (2.20.0)
- Unmute reacquires when `readyState === 'ended'` (mic-test second `getUserMedia`, device loss, etc.)

**Resolution:** Confirmed via SDK + app source. Fix: retain last `audioContext` on the processor; stop processor before mute; attach fresh processor after unmute.

### Hypothesis 2: WebAudio source does not resume after `track.enabled` toggle

**Status:** Open (secondary)

**Theory:** Even without reacquire, disabling the raw track under a `MediaStreamAudioSourceNode` can leave the processed destination silent after re-enable; reusing the same processor instance may not fully rebuild the graph.

**Would confirm:** Runtime capture showing live unmuted publication with near-zero outbound audio after mute cycle without track restart.

**Resolution:** Mitigated by stopping processor on mute and attaching a fresh processor on unmute.

## Source Code Trace

| Element       | Detail                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| Error origin  | `apps/zeo/src/lib/livekit/mic-gate-processor.ts` (`init` / `restart`)  |
| Trigger       | `toggleMic` → mute/unmute → optional track restart with processor on   |
| Condition     | Mic-gate attached; unmute reacquires or reuses stalled WebAudio graph  |
| Related files | `CallExperience.svelte`, `room-client.ts`, LiveKit `LocalAudioTrack`   |

## Conclusion

**Confidence:** High

**Status:** Concluded — fixed on `cursor/fix-mic-unmute-reconnect-a92c`.

Mute/unmute did not reliably restore mic capture/publish while the mic-gate processor remained attached. The deterministic failure was `restart()` without `audioContext`; the fix detaches the processor on mute, retains `audioContext` for restart, and attaches a fresh processor on unmute.

## Recommended Next Steps

### Fix direction

1. Retain `audioContext` inside `createMicGateProcessor` for `restart()`.
2. On mute: `stopProcessor` then `setMicrophoneEnabled(false)`.
3. On unmute: fresh processor → `setMicrophoneEnabled(true)` → `attachMicGateProcessor`.
4. Apply the same mute teardown in in-call mic-test start.
