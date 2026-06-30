import { DOCK_SAFE_HEIGHT, GRID_COLS, GRID_COLS_NARROW, NARROW_STAGE_WIDTH, type GridMetrics } from "./types";

export function computeGridMetrics(width: number, height: number, dockHeight = DOCK_SAFE_HEIGHT): GridMetrics {
  const availableHeight = Math.max(0, height - dockHeight);
  const cols = width < NARROW_STAGE_WIDTH ? GRID_COLS_NARROW : GRID_COLS;
  const cellSize = Math.max(1, Math.floor(width / cols));
  const rows = Math.max(1, Math.floor(availableHeight / cellSize));

  return {
    cols,
    rows,
    cellSize,
    canvasWidth: cols * cellSize,
    canvasHeight: rows * cellSize,
  };
}
