# Brownfield notes — stream media controls

## Current behavior (baseline)

| Area | Today | Gap |
|------|-------|-----|
| Control bar share | Separate **Share screen** and **Share tab audio only** (`ControlBar.svelte` → `toggleScreenShare` / `toggleScreenAudioShare`) | CAP-1 consolidate |
| Screen capture helpers | `livekit/screen-share.ts` — video+audio, audio-only, held video track for audio-only | Reuse for tile toggles |
| Tile listen | Binary mute via `tile-listen-mute.ts` + `participant.setVolume(0\|1, source)` | CAP-2 continuous 0–1 |
| Level meter | Linear `level * 100%` in `AudioLevelIndicator.svelte`; in-call levels from LiveKit `audioLevel` | CAP-5 nonlinear display map |
| Quality | Room `adaptiveStream` + `dynacast` only; no user preset UI; project cap 720p in context | CAP-3 presets |
| Stats | Local `ConnectionQualityBadge` + room RTT poll in `CallExperience`; not per-tile overlay | CAP-4 per-tile + settings toggle |
| Settings | In-call panel in `CallExperience` (`showInCallDevices`); prefs via `browser-storage.ts` `STORAGE_KEYS` | Add quality + show-stats |

## Touchpoints (expected)

| Concern | Primary files |
|---------|----------------|
| Share control bar | `ControlBar.svelte`, `CallExperience.svelte` |
| Share publish/mute | `livekit/screen-share.ts`, possibly new helpers for mute/unmute screen video/audio without full stop |
| Stream tile share toggles | `ScreenShareTile.svelte`, `GridTile.svelte` / `TileActionBar.svelte` or dedicated local-share chrome |
| Per-tile volume | `ParticipantTile.svelte`, `ScreenShareTile.svelte`, `tile-listen-mute.ts` → generalize to volume map |
| Volume + level UI | `AudioLevelIndicator.svelte` (or sibling row component wrapping meter + slider) |
| Quality settings | `CallExperience.svelte` settings panel, `room-client.ts` `createCallRoom` / publish defaults, storage keys |
| Stats overlay | New small tile overlay component; poll/extend `connection-stats.ts`; wire through `VideoGrid` |
| Nonlinear meter | Pure function in `$lib/` + `AudioLevelIndicator.svelte` |

## LiveKit API leverage

- **Share track toggles:** mute/unmute (or unpublish/republish) `Track.Source.ScreenShare` and `Track.Source.ScreenShareAudio` on `LocalParticipant` while keeping capture alive where possible (existing held-track pattern for audio-only).
- **Listen volume:** `RemoteParticipant.setVolume(volume, source)` already used; pass continuous `volume ∈ [0,1]` instead of 0/1.
- **Video quality (subscribe):** `RemoteTrackPublication.setVideoQuality(...)` and/or rely on `adaptiveStream` with capture/publish caps.
- **Video/audio quality (publish):** `Room` `videoCaptureDefaults` + `publishDefaults` (`VideoPresets`, `audioPreset`); may require camera restart / `setCameraEnabled` cycle when changing mid-call.
- **Stats:** `ConnectionQualityChanged`; `readConnectionRttMs` today is room/local-oriented — extend with per-publication `getRTCStatsReport` for bitrate/resolution/fps where available.

## Storage keys (proposed)

```
zeo:video-quality-preset
zeo:audio-quality-preset
zeo:show-tile-stats
```

Per-tile volumes: in-memory `Record<tileKey, number>` in `CallExperience` (session-scoped default).

## Risks

- Browser display-capture: cannot always add audio after a video-only pick without a new `getDisplayMedia` prompt.
- Mid-call publish-quality changes may blip local camera.
- Per-remote RTT may be unavailable; fall back to room ping or “—” without failing the overlay.
- Nonlinear meter must not make silence look like speech — keep a true-zero floor.
