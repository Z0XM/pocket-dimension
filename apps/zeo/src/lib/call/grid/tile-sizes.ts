import type { TileRect } from "./types";

export type TileSizePreset = {
  id: "S" | "M" | "L" | "XL";
  w: number;
  h: number;
};

/** 16:9-ish footprints for the tile grid. */
export const TILE_SIZE_PRESETS: readonly TileSizePreset[] = [
  { id: "S", w: 6, h: 4 },
  { id: "M", w: 9, h: 5 },
  { id: "L", w: 11, h: 6 },
  { id: "XL", w: 12, h: 7 },
] as const;

export function isAllowedTileSize(w: number, h: number) {
  return TILE_SIZE_PRESETS.some((preset) => preset.w === w && preset.h === h);
}

export function presetForParticipantCount(count: number): TileSizePreset {
  if (count <= 1) return TILE_SIZE_PRESETS[2]; // L
  if (count === 2) return TILE_SIZE_PRESETS[0]; // S — two fit across 12 columns
  if (count <= 4) return TILE_SIZE_PRESETS[0]; // S
  return TILE_SIZE_PRESETS[0]; // S
}

export function nearestPreset(w: number, h: number): TileSizePreset {
  let best = TILE_SIZE_PRESETS[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const preset of TILE_SIZE_PRESETS) {
    const score = Math.abs(preset.w - w) + Math.abs(preset.h - h);
    if (score < bestScore) {
      bestScore = score;
      best = preset;
    }
  }

  return best;
}

export function presetArea(preset: TileSizePreset) {
  return preset.w * preset.h;
}

export function tileFits(rect: TileRect, cols: number, rows: number) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= cols && rect.y + rect.h <= rows;
}
