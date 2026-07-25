# Epic 16 — Stream media controls & tile stats

**Goal:** Consolidate share controls onto the stream tile, add per-tile listen volume, global A/V quality prefs, optional per-tile stats, and a speech-friendly level meter.

**Spec:** `specs/spec-stream-media-controls/SPEC.md`  
**Suggested sprint entry:** after current backlog; stories below map 1:1 to CAP-1…CAP-5.

---

### Story 16.1 — Single Share control + tile A/V share toggles

**Capabilities:** CAP-1  
**I want** one Share button and on-tile video/audio share switches,  
**So that** I am not choosing between two share modes in the control bar.

**Acceptance criteria**

- [ ] Control bar exposes a single Share start/stop control; “Share tab audio only” fully removed (no menu/long-press fallback)
- [ ] Starting Share requests display capture with audio when supported; both share toggles default on when tracks exist
- [ ] Local stream tile has controls to turn video sharing on/off and audio sharing on/off independently
- [ ] Video off + audio on = audio-only share for remotes
- [ ] **Both toggles off stops sharing** (capture torn down; bar returns to idle)
- [ ] Remote participants see muted/absent tracks when local toggles turn media off
- [ ] Single-sharer policy unchanged
- [ ] Keyboard/screen-reader labels present for new controls

**Primary files:** `ControlBar.svelte`, `CallExperience.svelte`, `screen-share.ts`, `ScreenShareTile.svelte`

---

### Story 16.2 — Per-tile output volume slider

**Capabilities:** CAP-2  
**I want** a volume slider beside each remote tile’s level meter,  
**So that** I can balance how loud each person or share is for me.

**Acceptance criteria**

- [ ] Remote participant and screen-share tiles show a 0–100 volume slider beside `AudioLevelIndicator`
- [ ] Slider drives continuous `RemoteParticipant.setVolume` for the tile’s audio source
- [ ] Global speaker mute forces silence; unmuting restores prior per-tile volumes
- [ ] Listen-mute action sets volume to 0 / restores previous nonzero value
- [ ] Local tiles do not offer a self-listen volume slider
- [ ] Volumes **persist across sessions** in `localStorage` keyed by tile identity + kind (`{identity}` / `screen-share:{identity}`)
- [ ] When a matching tile reappears, its slider and LiveKit volume restore from storage

**Primary files:** `ParticipantTile.svelte`, `ScreenShareTile.svelte`, `tile-listen-mute.ts`, `CallExperience.svelte`, `browser-storage.ts`, `VideoGrid.svelte`

---

### Story 16.3 — Global audio/video quality in Settings

**Capabilities:** CAP-3  
**I want** concrete audio and video quality caps in Settings,  
**So that** one choice shapes all of my streams.

**Acceptance criteria**

- [ ] In-call Settings includes Video quality: `360p` / `480p` / `720p` / `1080p` (labels = caps, not Low/Medium/High)
- [ ] Audio quality: `24 kbps` / `48 kbps` / `96 kbps` / `128 kbps` (mapped to LiveKit audio presets)
- [ ] Choice applies to all of that user’s relevant publish/subscribe streams
- [ ] Preference persists via `STORAGE_KEYS` and reapplies on join (defaults `720p` / `48 kbps`)
- [ ] Changing preset mid-call updates active streams with at most a brief camera republish blip

**Primary files:** `CallExperience.svelte`, `room-client.ts`, `browser-storage.ts`, device/publish helpers

---

### Story 16.4 — Per-tile stats overlay + Settings toggle

**Capabilities:** CAP-4  
**I want** ping, video quality, audio quality, and fps on each tile, with a master off switch,  
**So that** I can diagnose call health without clutter when I do not need it.

**Acceptance criteria**

- [ ] Top-left overlay on each stage tile shows **ping (ms)**, **video quality number**, **audio quality number (kbps)**, and **fps**
- [ ] Missing metrics render as `—` without breaking layout
- [ ] Settings toggle “Show tile stats” shows/hides overlay on all tiles for this user
- [ ] Preference persists in `localStorage` (default on)
- [ ] Overlay does not intercept clicks or collide with `TileActionBar`

**Primary files:** new overlay component, `connection-stats.ts`, `VideoGrid.svelte` / tile components, `CallExperience.svelte` settings

---

### Story 16.5 — Nonlinear audio level display mapping

**Capabilities:** CAP-5  
**I want** the level meter to use most of its travel for normal speech,  
**So that** speaking activity is easy to see.

**Acceptance criteria**

- [ ] Shared display mapper: levels at/under knee fill up to 75% of the bar; above-knee levels use the top 25%
- [ ] `AudioLevelIndicator` uses the mapper for width
- [ ] Silence still reads empty; loud peaks can still reach full
- [ ] Unit tests cover knee boundaries (`0`, `k`, `1`)
- [ ] Speaking-glow threshold remains based on raw level unless product check shows mismatch

**Primary files:** `AudioLevelIndicator.svelte`, new `$lib/audio-level-display.ts` (+ tests)

---

## Suggested implementation order

1. **16.5** — isolated, low risk, unlocks nicer CAP-2 UI  
2. **16.2** — volume beside meter + persistence  
3. **16.1** — share consolidation (most behavior risk)  
4. **16.3** — quality caps  
5. **16.4** — stats (RTC stats wiring)

## Sprint status keys (for later `sprint-status.yaml`)

```yaml
epic-16: backlog
16-1-single-share-control-and-tile-av-toggles: backlog
16-2-per-tile-output-volume-slider: backlog
16-3-global-audio-video-quality-settings: backlog
16-4-per-tile-stats-overlay-and-toggle: backlog
16-5-nonlinear-audio-level-display: backlog
```
