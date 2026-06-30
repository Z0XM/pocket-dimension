import type { CallTileLayout, GridMetrics, TileRect } from "./types";
import { clampTileRect, isAllowedTileSize, presetForParticipantCount, TILE_SIZE_PRESETS, tileFits, type TileSizePreset } from "./tile-sizes";

function overlaps(a: TileRect, b: TileRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function fitsWithoutOverlap(rect: TileRect, placed: TileRect[], metrics: GridMetrics) {
  if (!tileFits(rect, metrics.cols, metrics.rows)) return false;
  return !placed.some((other) => overlaps(rect, other));
}

function findFirstAvailable(preset: TileSizePreset, placed: TileRect[], metrics: GridMetrics): TileRect | null {
  for (let y = 0; y <= metrics.rows - preset.h; y += 1) {
    for (let x = 0; x <= metrics.cols - preset.w; x += 1) {
      const candidate = { x, y, w: preset.w, h: preset.h };
      if (fitsWithoutOverlap(candidate, placed, metrics)) {
        return candidate;
      }
    }
  }

  return null;
}

function centeredRect(preset: TileSizePreset, metrics: GridMetrics): TileRect {
  return {
    x: Math.max(0, Math.floor((metrics.cols - preset.w) / 2)),
    y: Math.max(0, Math.floor((metrics.rows - preset.h) / 2)),
    w: preset.w,
    h: preset.h,
  };
}

function defaultRectForIndex(index: number, count: number, preset: TileSizePreset, metrics: GridMetrics): TileRect {
  if (count === 1) {
    return centeredRect(preset, metrics);
  }

  if (count === 2) {
    const y = Math.max(0, Math.floor((metrics.rows - preset.h) / 2));
    return {
      x: index === 0 ? 0 : preset.w,
      y,
      w: preset.w,
      h: preset.h,
    };
  }

  if (count <= 4) {
    const positions = [
      { x: 0, y: 0 },
      { x: preset.w, y: 0 },
      { x: 0, y: preset.h },
      { x: preset.w, y: preset.h },
    ];
    const offsetX = Math.max(0, Math.floor((metrics.cols - preset.w * 2) / 2));
    const offsetY = Math.max(0, Math.floor((metrics.rows - preset.h * 2) / 2));
    const slot = positions[index] ?? positions[0];
    return {
      x: offsetX + slot.x,
      y: offsetY + slot.y,
      w: preset.w,
      h: preset.h,
    };
  }

  return findFirstAvailable(preset, [], metrics) ?? centeredRect(preset, metrics);
}

export function createDefaultLayout(identities: string[], metrics: GridMetrics): CallTileLayout {
  return mergeParticipantLayout(identities, null, metrics);
}

export function mergeParticipantLayout(identities: string[], saved: CallTileLayout | null, metrics: GridMetrics): CallTileLayout {
  const preset = presetForParticipantCount(identities.length, metrics);
  const placed: TileRect[] = [];
  const tiles: Record<string, TileRect> = {};

  for (const identity of identities) {
    const savedTile = saved?.cols === metrics.cols ? saved.tiles[identity] : undefined;
    const clamped = savedTile ? clampTileRect(savedTile, metrics) : undefined;

    if (clamped && isAllowedTileSize(clamped.w, clamped.h, metrics) && fitsWithoutOverlap(clamped, placed, metrics)) {
      tiles[identity] = clamped;
      placed.push(clamped);
    }
  }

  identities.forEach((identity, index) => {
    if (tiles[identity]) return;

    const candidates = [
      defaultRectForIndex(index, identities.length, preset, metrics),
      ...TILE_SIZE_PRESETS.map((size) => findFirstAvailable(size, placed, metrics)).filter(Boolean),
    ] as TileRect[];

    const next = candidates.find((rect) => fitsWithoutOverlap(rect, placed, metrics));
    if (!next) return;

    tiles[identity] = next;
    placed.push(next);
  });

  return {
    version: 1,
    cols: metrics.cols,
    tiles,
  };
}

export function layoutFromGridNodes(
  nodes: Array<{ id?: string; x?: number; y?: number; w?: number; h?: number }>,
  metrics: GridMetrics
): CallTileLayout {
  const tiles: Record<string, TileRect> = {};

  for (const node of nodes) {
    if (!node.id) continue;
    if (node.x === undefined || node.y === undefined || node.w === undefined || node.h === undefined) continue;

    const rect = clampTileRect({ x: node.x, y: node.y, w: node.w, h: node.h }, metrics);
    if (!rect || !isAllowedTileSize(rect.w, rect.h, metrics)) continue;

    tiles[node.id] = rect;
  }

  return {
    version: 1,
    cols: metrics.cols,
    tiles,
  };
}

export function clampParticipantLayout(layout: CallTileLayout, identities: string[], metrics: GridMetrics): CallTileLayout {
  return mergeParticipantLayout(identities, layout, metrics);
}
