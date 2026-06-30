import { browser } from "$app/environment";
import { LAYOUT_STORAGE_VERSION, type CallTileLayout } from "./types";
import { isAllowedTileSize, tileFits } from "./tile-sizes";

export function layoutStorageKey(roomSlug: string) {
  return `zeo:call-layout:${roomSlug}`;
}

export function readCallTileLayout(roomSlug: string): CallTileLayout | null {
  if (!browser) return null;

  try {
    const raw = localStorage.getItem(layoutStorageKey(roomSlug));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CallTileLayout;
    if (parsed.version !== LAYOUT_STORAGE_VERSION || typeof parsed.cols !== "number" || !parsed.tiles) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeCallTileLayout(roomSlug: string, layout: CallTileLayout) {
  if (!browser) return;

  try {
    localStorage.setItem(layoutStorageKey(roomSlug), JSON.stringify(layout));
  } catch {
    // Private browsing or quota — ignore
  }
}

export function clearCallTileLayout(roomSlug: string) {
  if (!browser) return;

  try {
    localStorage.removeItem(layoutStorageKey(roomSlug));
  } catch {
    // Private browsing — ignore
  }
}

export function sanitizeTileLayout(layout: CallTileLayout, cols: number, rows: number): CallTileLayout {
  const tiles: CallTileLayout["tiles"] = {};

  for (const [identity, rect] of Object.entries(layout.tiles)) {
    if (!isAllowedTileSize(rect.w, rect.h)) continue;
    if (!tileFits(rect, cols, rows)) continue;
    tiles[identity] = rect;
  }

  return {
    version: LAYOUT_STORAGE_VERSION,
    cols,
    tiles,
  };
}
