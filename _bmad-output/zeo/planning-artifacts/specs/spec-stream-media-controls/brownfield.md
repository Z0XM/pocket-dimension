# Brownfield notes — stream media controls

## Current behavior (baseline)

| Area | Today | Gap |
|------|-------|-----|
| Control bar share | Separate **Share screen** and **Share tab audio only** (`ControlBar.svelte` → `toggleScreenShare` / `toggleScreenAudioShare`) | CAP-1 consolidate; delete audio-only entry |
| Screen capture helpers | `livekit/screen-share.ts` — video+audio, audio-only, held video track for audio-only | Tile toggles; both-off → full stop; audio-only via video toggle off |
| Tile listen | Binary mute via `tile-listen-mute.ts` + `participant.setVolume(0\|1, source)` | CAP-2 continuous 0–1 + persisted map |
| Level meter | Linear `level * 100%` in `AudioLevelIndicator.svelte`; in-call levels from LiveKit `audioLevel` | CAP-5 nonlinear display map |
| Quality | Room `adaptiveStream` + `dynacast` only; no user preset UI; older context preferred ≤720p | CAP-3 concrete p / kbps ladders up to 1080p |
| Stats | Local `ConnectionQualityBadge` + room RTT poll in `CallExperience`; not per-tile overlay | CAP-4 ping + video + audio + fps |
| Settings | In-call panel in `CallExperience` (`showInCallDevices`); prefs via `browser-storage.ts` `STORAGE_KEYS` | Add quality + show-stats |

## Touchpoints (expected)

| Concern | Primary files |
|---------|----------------|
| Share control bar | `ControlBar.svelte`, `CallExperience.svelte` |
| Share publish/mute/stop | `livekit/screen-share.ts` — mute/unmute screen A/V; both-off calls existing stop path |
| Stream tile share toggles | `ScreenShareTile.svelte`, `GridTile.svelte` / dedicated local-share chrome |
| Per-tile volume | `ParticipantTile.svelte`, `ScreenShareTile.svelte`, `tile-listen-mute.ts` → volume map + storage |
| Volume + level UI | `AudioLevelIndicator.svelte` (or sibling row wrapping meter + slider) |
| Quality settings | `CallExperience.svelte` settings panel, `room-client.ts` publish/capture defaults, storage keys |
| Stats overlay | New overlay component; extend `connection-stats.ts` for per-tile RTC stats; wire through `VideoGrid` |
| Nonlinear meter | Pure function in `$lib/` + `AudioLevelIndicator.svelte` |

## LiveKit API leverage

- **Share track toggles:** mute/unmute (or unpublish/republish) `Track.Source.ScreenShare` and `Track.Source.ScreenShareAudio`. Video-off + audio-on keeps capture (held-track pattern). Both off → `disable` / stop share helpers (full teardown).
- **Listen volume:** `RemoteParticipant.setVolume(volume, source)` with continuous `volume ∈ [0,1]`.
- **Video quality:** map UI → capture/encode:
  - `360p` → `VideoPresets.h360`
  - `480p` → custom preset (~854×480) or nearest encode
  - `720p` → `VideoPresets.h720`
  - `1080p` → `VideoPresets.h1080`
  Subscribe side: `setVideoQuality` / `adaptiveStream` still allowed within the chosen ceiling.
- **Audio quality:** map UI → `publishDefaults.audioPreset`:
  - `24 kbps` → `AudioPresets.speech`
  - `48 kbps` → `AudioPresets.music`
  - `96 kbps` → `AudioPresets.musicHighQuality`
  - `128 kbps` → `AudioPresets.musicHighQualityStereo`
- **Stats:** per-publication `getRTCStatsReport` → RTT/`currentRoundTripTime`, outbound/inbound bitrate (audio kbps), frame width/height (video quality number), `framesPerSecond`. Fall back to room ping / `—` when unavailable.

## Storage keys (proposed)

```
zeo:video-quality          # "360p" | "480p" | "720p" | "1080p"
zeo:audio-quality          # "24" | "48" | "96" | "128"  (kbps)
zeo:show-tile-stats        # boolean, default true
zeo:tile-volumes           # JSON map: { "<tileKey>": 0-100, ... }
```

Tile volume keys reuse stage keys: `{identity}` and `screen-share:{identity}`. Browser-wide (not per-room).

Defaults: video `720p`, audio `48` kbps, stats on, missing tile volume → `100`.

## Risks

- Browser display-capture: cannot always add audio after a video-only pick without a new `getDisplayMedia` prompt.
- Mid-call publish-quality changes may blip local camera.
- 1080p under 5–6 concurrent cameras may stress Hostinger KVM 2 — user choice is allowed; soft copy can warn when selecting 1080p.
- Per-remote RTT may be unavailable; fall back to room ping or `—`.
- Nonlinear meter must not make silence look like speech — keep a true-zero floor.
- Persisted volume map can grow; prune entries for identities not seen in a long time only if needed (not required for MVP of this epic).
