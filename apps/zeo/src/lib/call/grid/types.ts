export const GRID_COLS = 12;
export const GRID_COLS_NARROW = 8;
export const NARROW_STAGE_WIDTH = 480;
export const DOCK_SAFE_HEIGHT = 112;
export const LAYOUT_STORAGE_VERSION = 1 as const;

export type TileRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CallTileLayout = {
  version: typeof LAYOUT_STORAGE_VERSION;
  cols: number;
  tiles: Record<string, TileRect>;
};

export type GridMetrics = {
  cols: number;
  rows: number;
  cellSize: number;
  canvasWidth: number;
  canvasHeight: number;
};
