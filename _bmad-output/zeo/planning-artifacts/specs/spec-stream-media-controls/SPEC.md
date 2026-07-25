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
  success: Control bar has one Share control (no separate “Share tab audio only” button). Starting share publishes video+audio when the browser allows. Local stream tile exposes video and audio share toggles; toggling either updates the published track mute/unpublish state for all remote viewers without ending the capture session unless both are off and the user stops share, or the capture ends.

- id: CAP-2
  intent: User can continuously adjust how loud each remote tile’s audio plays for them via a per-tile volume slider next to that tile’s audio level indicator.
  success: Each remote tile with an audio source shows a slider beside the level meter; moving it changes that tile’s listen volume in real time across 0–100% via LiveKit `setVolume`; volume 0 is silent for that tile; global speaker mute still silences all tiles.

- id: CAP-3
  intent: User can choose preferred audio and video quality once in Settings, and that choice applies to all of their audio and video streams in the call.
  success: In-call Settings exposes audio-quality and video-quality controls. Changing either immediately (or on next republish if required) affects camera/mic publish encoding and/or subscribed remote video quality for every stream for that user, persists in `localStorage`, and respects the product 720p ceiling.

- id: CAP-4
  intent: User can see per-tile ping plus video and audio quality numbers on the top-left of each tile, and can hide those stats for all tiles from Settings.
  success: When stats are enabled, every stage tile shows top-left overlay with ping (ms), video quality figure(s), and audio quality figure(s). Settings toggle turns the overlay off/on for that user across all tiles and persists. Default can be on or off as assumed below.

- id: CAP-5
  intent: User sees an audio level indicator that uses most of the bar for normal speaking levels, with louder peaks compressed into the top quarter.
  success: For typical speech (levels that today stay in the lower region of a linear meter), the filled portion of the indicator reaches roughly the lower ~75% of the bar; only higher levels occupy the remaining ~25%. Same mapping applies wherever `AudioLevelIndicator` renders LiveKit/`audioLevel` values in-call.

## Constraints

- Brownfield only in `apps/zeo`; follow existing LiveKit + Svelte 5 patterns in `CallExperience`, tiles, and `browser-storage`.
- Hard product caps remain: ≤2 rooms, ≤6 participants, one active screen capture at a time, video ≤720p.
- Per-tile listen volume is local receiver-side only (does not change what others hear).
- Share video/audio toggles on the stream tile apply only to the local user’s active screen/display capture tile (not remote viewers muting someone else’s published share tracks for the room).
- Stats overlay must not block tile action toolbar (top-right) or bottom name/level chrome; keep compact and low-contrast.
- Nonlinear level mapping is display-only; do not change mic-gate cutoff behavior or speaking-glow thresholds unless required for visual consistency (speaking glow may keep raw level).
- Persist settings that are preferences (quality, show-stats) in `localStorage` via `STORAGE_KEYS`; per-tile volumes are session-scoped unless noted otherwise.

## Non-goals

- No recording, egress, or server-side media transcoding controls.
- No per-remote-participant publish quality overrides (cannot force another user’s encoder).
- No redesign of the full control bar beyond consolidating the two share entry points and any labels needed for CAP-1.
- No moving mic/camera participant toggles off the control bar onto camera tiles.
- No admin/operator global quality policy UI.
- No mobile-specific alternate layout beyond existing compact control-bar patterns.

## Success signal

In one in-call demo: start share from the single Share button with video+audio on; mute share video then share audio from the tile; set a remote tile quieter with the new slider; change Settings A/V quality and observe all streams follow; toggle stats and see ping/quality numbers appear/disappear on every tile; speak normally and watch the level meter occupy most of the bar instead of the bottom tip.

## Assumptions

- CAP-1 targets the existing dual control-bar actions **Share screen** and **Share tab audio only**, not the mic/camera buttons.
- Starting Share requests display capture with audio when supported; if the user/browser omits audio, share still starts with video and the tile audio toggle can attempt to enable audio later or show disabled/unavailable.
- Stopping Share (control bar) ends the whole capture; turning both tile toggles off is allowed but the preferred stop path remains the Share button (open question if both-off should auto-stop).
- CAP-3 “for them” means the local user’s publish defaults + subscribe preferences, not host-enforced room policy.
- CAP-3 quality UI is discrete presets (e.g. Low / Medium / High), not free-form bitrate entry.
- CAP-4 “video quality and audio quality numbers” means concrete media stats (e.g. resolution or kbps / packet metrics), not only the existing Excellent/Good/Poor badge labels — though connection quality may complement them.
- CAP-4 stats default **on**; toggle persists per browser profile.
- CAP-2 slider appears on remote participant tiles and remote screen-share tiles that carry audio; local tiles omit listen volume (or show disabled) because self-listen is not the product path.
- Existing top-right listen-mute remains; setting slider to 0 is equivalent to muted for that tile, and unmuting restores previous nonzero volume when practical.

## Open Questions

- When both share-video and share-audio tile toggles are off, should capture auto-stop, or stay held (current audio-only hold pattern) until Share is stopped?
- Should “Share tab audio only” remain reachable somehow (long-press / menu), or is full removal acceptable now that tile toggles exist?
- Exact quality preset ladder and whether changing video quality mid-call republishes the camera track or only adjusts subscriber `setVideoQuality` / encoding parameters.
- Exact numeric fields for CAP-4 (resolution+fps vs bitrate vs LiveKit layer) — confirm in implementation spike using `getRTCStatsReport` availability per tile.
- Should per-tile volume persist across reloads for the same room/identity, or stay session-only?
