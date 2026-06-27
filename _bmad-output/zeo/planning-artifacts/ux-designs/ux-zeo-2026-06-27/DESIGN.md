---
title: zeo UX Design
status: final
created: 2026-06-27
updated: 2026-06-27
colors:
  background: "#0f1117"
  surface: "#1a1d27"
  surfaceElevated: "#242836"
  primary: "#6ee7b7"
  primaryMuted: "#34d399"
  danger: "#f87171"
  warning: "#fbbf24"
  textPrimary: "#f3f4f6"
  textSecondary: "#9ca3af"
  border: "#374151"
typography:
  ui: "Inter, system-ui, sans-serif"
  display: "Inter, system-ui, sans-serif"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  full: "9999px"
spacing:
  unit: 4
  compact: 8
  comfortable: 16
  spacious: 24
components:
  buttonPrimary: "filled primary on dark surface"
  buttonDanger: "filled danger for end call"
  controlBar: "floating bottom bar, glass-dark"
---

# Brand & Style

zeo should feel **focused and calm under pressure** — a video tool that stays out of the way once a call starts. The aesthetic is dark, minimal, and confidence-inspiring: deep surfaces, soft contrast, and a single mint-green accent for primary actions and "live" states. It should not mimic corporate Zoom blue or playful Discord purple; it belongs visually alongside Pocket Dimension's other tools.

## Colors

- **Background** (`background`): near-black blue-gray — `{colors.background}`
- **Surface** (`surface`): card and panel base — `{colors.surface}`
- **Elevated surface** (`surfaceElevated`): modals, control bar — `{colors.surfaceElevated}`
- **Primary accent** (`primary`): mint green for Join, live indicators — `{colors.primary}`
- **Danger** (`danger`): End room, leave, destructive — `{colors.danger}`
- **Warning** (`warning`): connection issues, at-capacity — `{colors.warning}`
- **Text primary / secondary** — `{colors.textPrimary}` / `{colors.textSecondary}`

Design rule: the **video grid is the hero**; chrome stays darker and quieter than participant tiles.

## Typography

- UI font: `{typography.ui}` — clean, legible at small sizes for names and timestamps.
- Display: same family; room titles use semibold 20–24px.
- In-tile names: 12–14px, high contrast on semi-transparent overlay.

## Layout & Spacing

- Full-viewport call surface; no persistent sidebar during active call.
- Control bar anchored bottom-center with `{spacing.comfortable}` padding.
- Pre-call lobby: centered card max-width 480px on `{colors.surface}`.
- Grid: 1×1, 2×2, 2×3 layouts for 1–6 participants; screen share switches to dominant + filmstrip.

## Elevation & Depth

- Control bar uses subtle elevation (soft shadow, `{colors.surfaceElevated}`) over video.
- Modals (settings, confirm end room) use scrim + elevated panel.
- Avoid heavy glassmorphism; prefer solid dark surfaces for performance on video-heavy pages.

## Shapes

- Tiles: `{rounded.md}` corners when not full-bleed screen share.
- Buttons: `{rounded.md}`; circular icon buttons for mic/camera/share.
- End call button: circular `{rounded.full}`, `{colors.danger}` fill.

## Components

### Video tile
- Video or avatar fallback, name pill bottom-left, mute icon overlay when muted.
- Active speaker: 2px `{colors.primary}` ring.

### Control bar
- Icon buttons: mic, camera, screen share, snapshot, participants, leave.
- Host-only: end room for all (separate from leave, requires confirm).
- Screen share active: share button highlighted `{colors.primaryMuted}`.

### Snapshot button
- Circular shutter icon; same size as mic/camera.
- On capture: brief white flash overlay (150ms) + toast "Snapshot saved".

### Pre-call lobby
- Device preview, room name, participant count if joining existing room.
- Primary **Join call** button; secondary **Cancel**.

### Capacity error state
- Warning icon, plain language ("All rooms are in use"), no technical codes.

### Screen share stage
- Shared content 80% viewport; participant strip along bottom or side.

## Do's and Don'ts

### Do
- Keep controls large enough for touch on tablet.
- Show mute/camera state clearly on every tile.
- Use `{colors.danger}` only for leave/end — not for mute.

### Do not
- Clutter the call view with marketing or navigation.
- Hide host controls behind deep menus.
- Use motion-heavy animations during active calls (CPU budget).
