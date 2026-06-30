# Grid tile layout — feature plan

**Status:** in progress (Phase 1 MVP)  
**Epic:** 9 (proposed) — Personal in-call tile layout  
**Updated:** 2026-06-30

## Summary

Replace the fixed CSS auto-grid in `VideoGrid` with a personal, device-local layout canvas. Users enter **layout edit mode** to drag tiles and resize them in discrete steps. Tile **aspect ratio is locked to 16:9** (matching current `ParticipantTile` / `aspect-video`). Grid **cells are always square**; cell pixel size is derived from stage width and a fixed column count.

Layouts are stored in **grid units** (not pixels) in `localStorage` per room slug. Not synced to other participants.

---

## Design decisions (locked)

| Decision | Choice |
| --- | --- |
| Cell shape | Square |
| Cell size | Derived: `cellSize = floor(stageWidth / COLS)` |
| Column count | Fixed **12** columns |
| Row count | `floor(stageHeight / cellSize)` (computed, not fixed) |
| Tile aspect ratio | **Locked 16:9** — users cannot stretch tiles to arbitrary w×h |
| Layout scope | Local per device, per room |
| Screen share mode | Out of scope v1 — keep existing `ScreenShareLayout` |
| Library | **GridStack.js** via thin custom Svelte 5 wrapper |

---

## Grid geometry

```
cellSize = floor(stageWidth / 12)
cols     = 12
rows     = floor(availableHeight / cellSize)
canvasW  = cols * cellSize   // may letterbox if stageWidth not divisible by 12
canvasH  = rows * cellSize
```

**Available height** = stage container height minus control-dock safe zone (~100–124px). Measure with `ResizeObserver` on stage + dock.

**Letterboxing:** Center the grid canvas horizontally when `stageWidth - canvasW > 0`.

**Grid lines:** CSS background at `cellSize` intervals. Visible in edit mode; hidden or faint in view mode.

**Window resize:** Recompute `cellSize` and `rows`. Tile positions stay in grid units; clamp tiles that exceed new bounds.

---

## Tile sizing (16:9 locked)

Tiles occupy `(w, h)` grid cells where pixel aspect ratio is locked to **16:9**:

```
pixelWidth  = w * cellSize
pixelHeight = h * cellSize
pixelWidth / pixelHeight ≈ 16/9
```

Because cells are square, integer `(w, h)` pairs only approximate 16:9. Use a **whitelist of allowed sizes** (best matches for 12-column grid):

| Preset | Grid cells (w×h) | Ratio | Use |
| --- | --- | --- | --- |
| XS | 4×3 | 1.33 | Too far from 16:9 — **exclude** |
| S | 7×4 | 1.75 | Minimum on desktop |
| M | 9×5 | 1.80 | Default for 3–4 participants |
| L | 11×6 | 1.83 | Comfortable single tile |
| XL | 12×7 | 1.71 | Full-width spotlight |

**Minimum tile:** 7×4 cells (≈16:9 within tolerance).

**Resize behavior:** Not free-form. User resize snaps to the **nearest allowed preset** larger or smaller than current size. GridStack custom `resize` handler enforces `(w, h)` pairs from the whitelist.

**Default placement** when no saved layout (by participant count):

| Count | Default size | Placement |
| --- | --- | --- |
| 1 | L (11×6) | Centered |
| 2 | M (9×5) | Side by side |
| 3–4 | M (9×5) | 2×2 arrangement with auto-place |
| 5–6 | S (7×4) | First-fit scan |
| 7+ | S (7×4) | First-fit scan |

---

## Data model

```typescript
const GRID_COLS = 12;
const TILE_ASPECT = 16 / 9;

type TileRect = {
  x: number; // 0..cols-1
  y: number; // 0..rows-1
  w: number; // width in cells (from whitelist)
  h: number; // height in cells (paired with w)
};

type CallTileLayout = {
  version: 1;
  tiles: Record<string, TileRect>; // participant identity
};

// localStorage: zeo:call-layout:{roomSlug}
```

On load: validate each tile fits current `cols × rows` and `(w, h)` is in whitelist. Invalid tiles → re-auto-place.

---

## UX

### Modes

| Mode | Grid lines | Drag | Resize | Notes |
| --- | --- | --- | --- | --- |
| **View** (default) | Off / faint | Off | Off | Auto-layout if no saved layout |
| **Edit** | On | On | Preset steps only | Toggle from control bar or `L` key |

**Edit mode entry:** "Layout" button in `ControlBar`.  
**Exit:** "Done", `Esc`, or toggle off.  
**Toast:** "Drag tiles to rearrange. Saved on this device only."

### Constraints

- No overlap (`float: false` in GridStack)
- Drag snaps to cell boundaries (`margin: 0`)
- Resize changes preset size only; ratio always 16:9
- Muted/video/speaking glow on `ParticipantTile` unchanged

---

## Architecture

```
CallExperience.svelte
  ├── layoutEditMode, tileLayout state
  ├── persist → layout-storage.ts
  └── CallStage → VideoGrid → GridCanvas.svelte
        ├── ResizeObserver → grid metrics
        ├── GridStack instance (layout-engine.ts)
        └── ParticipantTile per widget
```

### New files

| Path | Purpose |
| --- | --- |
| `lib/call/grid/types.ts` | Constants, types, size whitelist |
| `lib/call/grid/metrics.ts` | `computeGridMetrics(stageEl, dockHeight)` |
| `lib/call/grid/layout-engine.ts` | GridStack init, preset resize, sync |
| `lib/call/grid/layout-storage.ts` | localStorage read/write |
| `lib/call/grid/default-layout.ts` | Auto-place on join / reset |
| `lib/call/grid/tile-sizes.ts` | Allowed (w,h) pairs, nearest preset |
| `components/call/GridCanvas.svelte` | Grid host + lines + edit chrome |

### Modified files

| Path | Change |
| --- | --- |
| `VideoGrid.svelte` | Delegate to `GridCanvas` |
| `ControlBar.svelte` | Layout edit toggle |
| `CallExperience.svelte` | Layout state + persistence |
| `ParticipantTile.svelte` | Remove forced `aspect-video` on outer shell; grid cell sets pixel bounds; inner video stays `object-cover` |

---

## GridStack integration notes

```typescript
GridStack.init({
  column: 12,
  cellHeight: cellSize, // updated on resize observer
  margin: 0,
  float: false,
  animate: true,
  disableOneColumnMode: true,
  staticGrid: !editMode,
  resizable: {
    handles: "se",
    // custom handler: snap w/h to whitelist pair
  },
});
```

- **Svelte owns tile content; GridStack owns position/size DOM.**
- Key widgets by `participant.identity`; avoid remounting on layout change.
- On `change` event → serialize grid units → debounced localStorage write.
- Custom resize: intercept `resizestop`, replace free-form size with nearest allowed preset.

---

## Implementation phases

### Phase 1 — MVP
- [ ] Grid metrics + canvas with square cells (12 cols)
- [ ] GridStack drag with snap
- [ ] Preset-only resize (16:9 locked)
- [ ] Edit mode toggle
- [ ] localStorage persistence
- [ ] Auto-place for new participants
- [ ] Participant join/leave handling

### Phase 2 — Polish
- [ ] Window resize clamping
- [ ] "Reset layout" action
- [ ] Small-screen min preset (may use S only on narrow stages)
- [ ] Snapshot compatibility verify
- [ ] Keyboard a11y

### Phase 3 — Future
- [ ] Screen-share layout integration
- [ ] Optional layout sync via LiveKit data channel

---

## Risks

| Risk | Mitigation |
| --- | --- |
| 16:9 ≠ integer cell pairs | Whitelist of best-fit pairs; document ~3% tolerance |
| GridStack free resize breaks ratio | Disable default resize; custom preset stepping |
| LiveKit video detaches on DOM move | Stable keys; GridStack moves wrapper, not video element |
| Small phones: 12 cols → ~32px cells | Min preset 7×4 may be too large; detect narrow stage and use S (7×4) only or reduce COLS to 8 below breakpoint |
| GridStack CSS vs Tailwind | Scope under `.grid-stack`; override in `app.css` |

### Small-screen fallback (TBD in implementation)

If `cellSize < 48px`, consider `COLS = 8` for that session so cells stay usable. Layout stored in grid units assumes same column count — key storage by `{ roomSlug, cols: 12 | 8 }` or normalize on load.

---

## Open items

- [ ] Confirm small-screen column reduction (12 → 8) vs fixed 12 everywhere
- [ ] Exact whitelist tolerance for 16:9 matching
- [ ] Whether view mode uses saved layout or reverts to auto-grid until user edits once
