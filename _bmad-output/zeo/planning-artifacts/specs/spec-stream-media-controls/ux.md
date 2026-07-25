# UX — stream media controls & tile stats

## Control bar (CAP-1)

- Keep a single **Share** button.
  - Idle label: “Share screen and audio” (or shorter “Share” on compact).
  - Active label: “Stop sharing”.
- **Remove** “Share tab audio only” from primary bar and overflow — no alternate entry.
- Mic, speakers, and camera stay on the control bar unchanged.

## Local stream tile share controls (CAP-1)

On the **local** screen-share tile only, show durable (not hover-only) controls:

| Control | States | Notes |
|---------|--------|-------|
| Video share | On / Off | Off → audio-only share (tile shows audio placeholder). On again republishes/unmutes screen video if capture still live |
| Audio share | On / Off | Mutes/unpublishes screen audio; disabled + tooltip if browser never granted share audio |

Defaults after start: **both on** when media is available.

**Both off → stop sharing** (tear down capture; control bar returns to idle Share). Equivalent to pressing Stop sharing.

Placement: bottom-right of the stream tile chrome, above the name strip, distinct from top-right `TileActionBar` (minimize/pin/fullscreen). Use icon buttons with `aria-pressed` and labels “Share video” / “Share audio”.

Remote viewers see resulting media state only (no publisher toggles).

## Per-tile volume (CAP-2)

Bottom tile strip (participant + screen-share with audio), remote only:

```
[name] … [AudioLevelIndicator] [volume slider]
```

- Slider: horizontal, compact (`w-16`–`w-20`), 0–100, `aria-label` “Volume for {name}”.
- Lives beside the level indicator (right of meter).
- When global speakers are muted, slider disabled or visually dimmed; restoring speakers reapplies stored tile volumes.
- Existing top-right listen-mute remains a shortcut to 0 / restore.
- Persist by tile key (`identity` or `screen-share:{identity}`) in `localStorage`; restore when that person/tile reappears in any room.

## Settings — quality & stats (CAP-3, CAP-4)

Add a section in the in-call Settings panel (gear), below existing visual toggles:

**Media quality**

- Video quality: segmented control or select with **actual caps** as labels — `360p` · `480p` · `720p` · `1080p`.
- Audio quality: same pattern — `24 kbps` · `48 kbps` · `96 kbps` · `128 kbps`.
- Helper text: “Applies to all your audio and video in this browser.”
- Default suggestion: `720p` / `48 kbps` (document in storage defaults).

**Stats**

- Toggle: “Show tile stats” — default on.
- Tooltip: “Ping, video/audio quality, and fps on every tile.”

No change to `/settings` account page for these prefs (in-call panel is enough).

## Tile stats overlay (CAP-4)

Top-left of each stage tile when enabled — four fields:

```
12 ms
720p · 24 fps
48 kbps
```

Or single compact block:

```
12 ms · 720p · 48 kbps · 24 fps
```

| Field | Display |
|-------|---------|
| Ping | `{n} ms` |
| Video quality number | `{height}p` or `W×H` if nonstandard |
| Audio quality number | `{n} kbps` |
| FPS | `{n} fps` |

- Compact mono/small text, white/80 on dark scrim `bg-black/45`, `rounded-sm`, `pointer-events-none`.
- Missing values show `—`.
- Hidden entirely when setting off (not just empty).
- Prefer per-tile overlay as source of truth when stats on; local stage connection badge may remain or be de-emphasized later.

## Level indicator curve (CAP-5)

Display mapping only (input still 0–1):

1. Clamp `x` to `[0, 1]`.
2. Knee `k` (constant, start `0.3` — tune against real LiveKit speech).
3. If `x ≤ k`: `y = 0.75 * (x / k)`.
4. Else: `y = 0.75 + 0.25 * ((x - k) / (1 - k))`.

So the lower detection band fills **75%** of the bar; the upper band is **squished into 25%**.

Apply in `AudioLevelIndicator` (or shared `mapAudioLevelForDisplay`) for all in-call meters using LiveKit levels. Mic-test RMS meter may keep linear or share the same helper — prefer same helper for consistency.

## Accessibility

- All new controls: keyboard operable, `aria-label` / `aria-pressed` / `aria-valuenow` on slider.
- Stats overlay: `aria-hidden="true"` on decorative per-tile numbers to avoid SR noise.
- Do not rely on color alone for on/off share state (icon + pressed).

## Compact / mobile

- Volume slider stays usable at touch size (min thumb target ~24px).
- Stats text may collapse to one line under ~200px tile width.
- Share toggles stack or icon-only on narrow tiles.
