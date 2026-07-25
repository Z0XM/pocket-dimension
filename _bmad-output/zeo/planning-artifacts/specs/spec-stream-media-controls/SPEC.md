---
id: SPEC-stream-media-controls
companions:
  - brownfield.md
  - ux.md
  - stories.md
sources:
  - /workspace/_bmad-output/zeo/project-context.md
  - /workspace/_bmad-output/zeo/planning-artifacts/architecture.md
  - /workspace/_bmad-output/zeo/planning-artifacts/epics.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Stream media controls & tile stats

## Why

**Pain to solve.** Call media controls are split awkwardly: screen video share and tab-audio share are two control-bar actions; per-tile listening is mute-only; normal speaking barely moves the level meter; users cannot tune outbound A/V quality or inspect per-tile network/media stats. This package tightens in-call control around stream tiles and settings so participants can manage share tracks, listen volume, quality, and visibility of stats without leaving the call stage.

## Capabilities

- id: CAP-1
  intent: User can start or stop a screen/display capture from a single control-bar Share action, and once capturing can independently turn video sharing and audio sharing on or off from that stream tile (default both on).
  success: Control bar has one Share control; “Share tab audio only” is fully removed. Starting share publishes video+audio when the browser allows. Local stream tile exposes video and audio share toggles. Turning video off while keeping audio on yields audio-only share. Turning **both** toggles off stops sharing entirely (same end state as Stop Share).

- id: CAP-2
  intent: User can continuously adjust how loud each remote tile’s audio plays for them via a per-tile volume slider next to that tile’s audio level indicator.
  success: Each remote tile with an audio source shows a slider beside the level meter; moving it changes that tile’s listen volume in real time across 0–100% via LiveKit `setVolume`; volume 0 is silent for that tile; global speaker mute still silences all tiles. Volumes persist across sessions keyed by participant identity + tile kind.

- id: CAP-3
  intent: User can choose preferred audio and video quality once in Settings, and that choice applies to all of their audio and video streams in the call.
  success: In-call Settings exposes concrete caps — video `360p` / `480p` / `720p` / `1080p`, audio `24 kbps` / `48 kbps` / `96 kbps` / `128 kbps` (labels are the actual caps, not Low/Medium/High). Changing either updates all of that user’s relevant streams, persists in `localStorage`, and reapplies on join.

- id: CAP-4
  intent: User can see per-tile ping, video quality number, audio quality number, and fps on the top-left of each tile, and can hide those stats for all tiles from Settings.
  success: When stats are enabled, every stage tile shows top-left overlay with **ping (ms)**, **video quality number**, **audio quality number**, and **fps**. Missing values show `—`. Settings toggle turns the overlay off/on for that user across all tiles and persists (default on).

- id: CAP-5
  intent: User sees an audio level indicator that uses most of the bar for normal speaking levels, with louder peaks compressed into the top quarter.
  success: For typical speech (levels that today stay in the lower region of a linear meter), the filled portion of the indicator reaches roughly the lower ~75% of the bar; only higher levels occupy the remaining ~25%. Same mapping applies wherever `AudioLevelIndicator` renders LiveKit/`audioLevel` values in-call.

## Constraints

- Brownfield only in `apps/zeo`; follow existing LiveKit + Svelte 5 patterns in `CallExperience`, tiles, and `browser-storage`.
- Hard product caps remain: ≤2 rooms, ≤6 participants, one active screen capture at a time. User-selectable video quality may go up to **1080p** (supersedes the older soft “cap at 720p” guidance for this preference UI).
- Per-tile listen volume is local receiver-side only (does not change what others hear).
- Share video/audio toggles on the stream tile apply only to the local user’s active screen/display capture tile (not remote viewers muting someone else’s published share tracks for the room).
- Both share toggles off **must** tear down the capture (stop sharing); audio-only share is achieved by video-off + audio-on, not a separate control-bar entry.
- Stats overlay must not block tile action toolbar (top-right) or bottom name/level chrome; keep compact and low-contrast.
- Nonlinear level mapping is display-only; do not change mic-gate cutoff behavior or speaking-glow thresholds unless required for visual consistency (speaking glow may keep raw level).
- Persist quality, show-stats, and per-tile volumes in `localStorage` via `STORAGE_KEYS` / helpers.

## Non-goals

- No recording, egress, or server-side media transcoding controls.
- No per-remote-participant publish quality overrides (cannot force another user’s encoder).
- No redesign of the full control bar beyond consolidating the two share entry points and any labels needed for CAP-1.
- No secondary path (menu/long-press) to start audio-only share — that path is removed.
- No moving mic/camera participant toggles off the control bar onto camera tiles.
- No admin/operator global quality policy UI.
- No mobile-specific alternate layout beyond existing compact control-bar patterns.

## Success signal

In one in-call demo: start share from the single Share button with video+audio on; turn video share off to keep audio-only; turn both off and confirm share stops; set a remote tile quieter and reload — volume restored for that identity+tile kind; pick `720p` / `48 kbps` in Settings and observe streams follow; toggle stats and see ping, video quality, audio quality, and fps on every tile; speak normally and watch the level meter occupy most of the bar instead of the bottom tip.

## Assumptions

- CAP-1 targets the existing dual control-bar actions **Share screen** and **Share tab audio only**, not the mic/camera buttons.
- Starting Share requests display capture with audio when supported; if the user/browser omits audio, share still starts with video and the tile audio toggle is disabled/unavailable until a new capture grants audio.
- CAP-3 “for them” means the local user’s publish defaults + subscribe preferences, not host-enforced room policy.
- Video ladder labels are exact UI strings: `360p`, `480p`, `720p`, `1080p` (480p may be a custom LiveKit preset; others map to `VideoPresets`).
- Audio ladder labels are exact UI strings: `24 kbps`, `48 kbps`, `96 kbps`, `128 kbps` → LiveKit `AudioPresets.speech` / `music` / `musicHighQuality` / `musicHighQualityStereo`.
- CAP-4 video quality number = effective spatial quality (prefer height label like `720p` or `W×H` when height is nonstandard); audio quality number = bitrate in kbps; fps = integer frames/sec from RTC stats.
- CAP-4 stats default **on**; toggle persists per browser profile.
- CAP-2 slider appears on remote participant tiles and remote screen-share tiles that carry audio; local tiles omit listen volume.
- Existing top-right listen-mute remains; setting slider to 0 is equivalent to muted for that tile, and unmuting restores previous nonzero volume when practical.
- Per-tile volume persistence key = `{identity}` for participant camera tiles and `screen-share:{identity}` for stream tiles (same scheme as stage tile keys), stored browser-wide (not room-scoped).
