import { GRID_COLS_NARROW, type GridMetrics, type TileRect } from "./types";

export type TileSizePreset = {
  id: "S" | "M" | "L" | "XL";
  w: number;
  h: number;
};

/** Minimum cell size (px) before restricting to compact presets only. */
export const SMALL_CELL_SIZE = 48;

/** 16:9-ish footprints for the tile grid. */
export const TILE_SIZE_PRESETS: readonly TileSizePreset[] = [
  { id: "S", w: 6, h: 4 },
  { id: "M", w: 9, h: 5 },
  { id: "L", w: 11, h: 6 },
  { id: "XL", w: 12, h: 7 },
] as const;

export function isNarrowGrid(metrics: GridMetrics) {
  return metrics.cols <= GRID_COLS_NARROW || metrics.cellSize < SMALL_CELL_SIZE;
}

export function allowedPresetsForMetrics(metrics: GridMetrics): TileSizePreset[] {
  const fitting = TILE_SIZE_PRESETS.filter((preset) => preset.w <= metrics.cols && preset.h <= metrics.rows);
  if (fitting.length === 0) return [TILE_SIZE_PRESETS[0]];

  if (isNarrowGrid(metrics)) {
    return fitting.filter((preset) => preset.id === "S");
  }

  return fitting;
}

export function isAllowedTileSize(w: number, h: number, metrics?: GridMetrics) {
  const presets = metrics ? allowedPresetsForMetrics(metrics) : TILE_SIZE_PRESETS;
  return presets.some((preset) => preset.w === w && preset.h === h);
}

export function presetForParticipantCount(count: number, metrics: GridMetrics): TileSizePreset {
  const allowed = allowedPresetsForMetrics(metrics);

  if (count <= 1) {
    const preferred = allowed.find((preset) => preset.id === "L") ?? allowed[allowed.length - 1];
    return preferred;
  }

  return allowed[0];
}

export function nearestPreset(w: number, h: number, metrics?: GridMetrics): TileSizePreset {
  const presets = metrics ? allowedPresetsForMetrics(metrics) : TILE_SIZE_PRESETS;
  let best = presets[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const preset of presets) {
    const score = Math.abs(preset.w - w) + Math.abs(preset.h - h);
    if (score < bestScore) {
      bestScore = score;
      best = preset;
    }
  }

  return best;
}

export function stepPreset(rect: TileRect, metrics: GridMetrics, direction: "up" | "down"): TileRect {
  const allowed = allowedPresetsForMetrics(metrics);
  const current = nearestPreset(rect.w, rect.h, metrics);
  const currentIndex = allowed.findIndex((preset) => preset.id === current.id);
  const nextIndex = direction === "up" ? Math.min(currentIndex + 1, allowed.length - 1) : Math.max(currentIndex - 1, 0);
  const preset = allowed[nextIndex];

  return {
    x: Math.max(0, Math.min(rect.x, metrics.cols - preset.w)),
    y: Math.max(0, Math.min(rect.y, metrics.rows - preset.h)),
    w: preset.w,
    h: preset.h,
  };
}

export function presetArea(preset: TileSizePreset) {
  return preset.w * preset.h;
}

export function tileFits(rect: TileRect, cols: number, rows: number) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= cols && rect.y + rect.h <= rows;
}

export function clampTileRect(rect: TileRect, metrics: GridMetrics): TileRect | null {
  const preset = nearestPreset(rect.w, rect.h, metrics);
  let candidate: TileRect = {
    x: rect.x,
    y: rect.y,
    w: preset.w,
    h: preset.h,
  };

  if (candidate.w > metrics.cols || candidate.h > metrics.rows) {
    return null;
  }

  candidate = {
    ...candidate,
    x: Math.max(0, Math.min(candidate.x, metrics.cols - candidate.w)),
    y: Math.max(0, Math.min(candidate.y, metrics.rows - candidate.h)),
  };

  return tileFits(candidate, metrics.cols, metrics.rows) ? candidate : null;
}
