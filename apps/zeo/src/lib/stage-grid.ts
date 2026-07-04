export type StageGridLayout = {
  cols: number;
  rows: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type ParticipantGridLayout = {
  slotCols: number;
  slotRows: number;
  blockCols: number;
  blockRows: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type TilePosition = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Default participant tile aspect ratio (16:9). */
export const TILE_ASPECT_RATIO = 16 / 9;

/** Snap when within this fraction of a cell edge while dragging. */
export const GRID_SNAP_THRESHOLD_RATIO = 0.18;

/**
 * Square-cell grid that fits the stage: column/row counts come from the stage
 * dimensions, then cell size is the largest square that fills that grid evenly.
 */
export function computeStageGrid(stageWidth: number, stageHeight: number, options?: { minCellSize?: number }): StageGridLayout | null {
  if (stageWidth <= 0 || stageHeight <= 0) return null;

  const minCellSize = options?.minCellSize ?? 48;
  const cols = Math.max(1, Math.floor(stageWidth / minCellSize));
  const rows = Math.max(1, Math.floor(stageHeight / minCellSize));
  const cellSize = Math.min(stageWidth / cols, stageHeight / rows);
  const width = cols * cellSize;
  const height = rows * cellSize;

  return {
    cols,
    rows,
    cellSize,
    offsetX: (stageWidth - width) / 2,
    offsetY: (stageHeight - height) / 2,
    width,
    height,
  };
}

/** Cell block whose aspect ratio is closest to the target, preferring larger area. */
export function closestCellBlock(targetAspect: number, maxCols: number, maxRows: number): { cols: number; rows: number } {
  let bestCols = 1;
  let bestRows = 1;
  let bestScore = Infinity;

  for (let cols = 1; cols <= maxCols; cols++) {
    for (let rows = 1; rows <= maxRows; rows++) {
      const aspectDiff = Math.abs(cols / rows - targetAspect);
      const area = cols * rows;
      const score = aspectDiff * 10_000 - area;

      if (score < bestScore) {
        bestScore = score;
        bestCols = cols;
        bestRows = rows;
      }
    }
  }

  return { cols: bestCols, rows: bestRows };
}

function gridAlignedOffset(stageOffset: number, stageCells: number, usedCells: number, cellSize: number) {
  const marginCells = stageCells - usedCells;
  return stageOffset + Math.floor(marginCells / 2) * cellSize;
}

/** Participant tile arrangement centered inside the stage grid. */
export function computeParticipantGrid(count: number, stage: StageGridLayout, aspectRatio = TILE_ASPECT_RATIO): ParticipantGridLayout | null {
  if (count <= 0) return null;

  let best: ParticipantGridLayout | null = null;
  let bestScore = Infinity;

  for (let slotCols = 1; slotCols <= count; slotCols++) {
    const slotRows = Math.ceil(count / slotCols);
    const maxBlockCols = Math.floor(stage.cols / slotCols);
    const maxBlockRows = Math.floor(stage.rows / slotRows);
    if (maxBlockCols < 1 || maxBlockRows < 1) continue;

    const block = closestCellBlock(aspectRatio, maxBlockCols, maxBlockRows);
    const empty = slotCols * slotRows - count;
    const aspectDiff = Math.abs(block.cols / block.rows - aspectRatio);
    const area = block.cols * block.rows;
    const score = empty * 1_000 + aspectDiff * 100 - area;

    if (score < bestScore) {
      bestScore = score;
      const cellSize = stage.cellSize;
      const width = slotCols * block.cols * cellSize;
      const height = slotRows * block.rows * cellSize;

      best = {
        slotCols,
        slotRows,
        blockCols: block.cols,
        blockRows: block.rows,
        cellSize,
        offsetX: gridAlignedOffset(stage.offsetX, stage.cols, slotCols * block.cols, cellSize),
        offsetY: gridAlignedOffset(stage.offsetY, stage.rows, slotRows * block.rows, cellSize),
        width,
        height,
      };
    }
  }

  return best;
}

export function tilePosition(grid: ParticipantGridLayout, index: number): TilePosition {
  const slotCol = index % grid.slotCols;
  const slotRow = Math.floor(index / grid.slotCols);

  return {
    left: grid.offsetX + slotCol * grid.blockCols * grid.cellSize,
    top: grid.offsetY + slotRow * grid.blockRows * grid.cellSize,
    width: grid.blockCols * grid.cellSize,
    height: grid.blockRows * grid.cellSize,
  };
}

export function maxBlockSize(stage: StageGridLayout, slotCols: number, slotRows: number) {
  return {
    cols: Math.max(1, Math.floor(stage.cols / slotCols)),
    rows: Math.max(1, Math.floor(stage.rows / slotRows)),
  };
}

export function maxBlockSizeFromAnchor(stage: StageGridLayout, slotCols: number, slotRows: number, anchorOffsetX: number, anchorOffsetY: number) {
  const startCol = Math.round((anchorOffsetX - stage.offsetX) / stage.cellSize);
  const startRow = Math.round((anchorOffsetY - stage.offsetY) / stage.cellSize);

  return {
    cols: Math.max(1, Math.floor((stage.cols - startCol) / slotCols)),
    rows: Math.max(1, Math.floor((stage.rows - startRow) / slotRows)),
  };
}

export function participantGridWithBlockSize(
  stage: StageGridLayout,
  slotCols: number,
  slotRows: number,
  blockCols: number,
  blockRows: number
): ParticipantGridLayout {
  const limits = maxBlockSize(stage, slotCols, slotRows);
  const cols = Math.max(1, Math.min(limits.cols, blockCols));
  const rows = Math.max(1, Math.min(limits.rows, blockRows));
  const cellSize = stage.cellSize;
  const width = slotCols * cols * cellSize;
  const height = slotRows * rows * cellSize;

  return {
    slotCols,
    slotRows,
    blockCols: cols,
    blockRows: rows,
    cellSize,
    offsetX: gridAlignedOffset(stage.offsetX, stage.cols, slotCols * cols, cellSize),
    offsetY: gridAlignedOffset(stage.offsetY, stage.rows, slotRows * rows, cellSize),
    width,
    height,
  };
}

export function participantGridWithAnchoredBlockSize(
  stage: StageGridLayout,
  slotCols: number,
  slotRows: number,
  blockCols: number,
  blockRows: number,
  anchorOffsetX: number,
  anchorOffsetY: number
): ParticipantGridLayout {
  const limits = maxBlockSizeFromAnchor(stage, slotCols, slotRows, anchorOffsetX, anchorOffsetY);
  const cols = Math.max(1, Math.min(limits.cols, blockCols));
  const rows = Math.max(1, Math.min(limits.rows, blockRows));
  const cellSize = stage.cellSize;

  return {
    slotCols,
    slotRows,
    blockCols: cols,
    blockRows: rows,
    cellSize,
    offsetX: anchorOffsetX,
    offsetY: anchorOffsetY,
    width: slotCols * cols * cellSize,
    height: slotRows * rows * cellSize,
  };
}

/** Snap a dragged pixel extent to the nearest valid 16:9 cell block. */
export function blockSizeFromPixelExtent(
  widthPx: number,
  heightPx: number,
  cellSize: number,
  maxBlockCols: number,
  maxBlockRows: number,
  aspectRatio = TILE_ASPECT_RATIO
) {
  const colHint = Math.max(1, Math.min(maxBlockCols, Math.round(widthPx / cellSize)));
  const rowHint = Math.max(1, Math.min(maxBlockRows, Math.round(heightPx / cellSize)));

  let bestCols = 1;
  let bestRows = 1;
  let bestScore = Infinity;

  for (let cols = 1; cols <= maxBlockCols; cols++) {
    for (let rows = 1; rows <= maxBlockRows; rows++) {
      const aspectDiff = Math.abs(cols / rows - aspectRatio);
      const sizeDiff = Math.abs(cols - colHint) + Math.abs(rows - rowHint);
      const score = aspectDiff * 100 + sizeDiff;

      if (score < bestScore) {
        bestScore = score;
        bestCols = cols;
        bestRows = rows;
      }
    }
  }

  return { cols: bestCols, rows: bestRows };
}

export function maxTilePixelSizeFromAnchor(stage: StageGridLayout, slotCols: number, slotRows: number, anchorOffsetX: number, anchorOffsetY: number) {
  const limits = maxBlockSizeFromAnchor(stage, slotCols, slotRows, anchorOffsetX, anchorOffsetY);
  return {
    width: limits.cols * stage.cellSize,
    height: limits.rows * stage.cellSize,
  };
}

export function snapPxToGrid(valuePx: number, cellSize: number) {
  return Math.max(cellSize, Math.round(valuePx / cellSize) * cellSize);
}

export function snapSizeToGrid(widthPx: number, heightPx: number, cellSize: number) {
  return {
    width: snapPxToGrid(widthPx, cellSize),
    height: snapPxToGrid(heightPx, cellSize),
  };
}

export function snapPxToGridIfClose(valuePx: number, cellSize: number, thresholdPx?: number) {
  const threshold = thresholdPx ?? Math.max(8, cellSize * GRID_SNAP_THRESHOLD_RATIO);
  const nearest = Math.max(cellSize, Math.round(valuePx / cellSize) * cellSize);
  return Math.abs(valuePx - nearest) <= threshold ? nearest : valuePx;
}

export function applySoftGridSnap(widthPx: number, heightPx: number, cellSize: number) {
  return {
    width: snapPxToGridIfClose(widthPx, cellSize),
    height: snapPxToGridIfClose(heightPx, cellSize),
  };
}

export function clampTilePixelSize(widthPx: number, heightPx: number, maxWidth: number, maxHeight: number, minSize: number) {
  return {
    width: Math.max(minSize, Math.min(maxWidth, widthPx)),
    height: Math.max(minSize, Math.min(maxHeight, heightPx)),
  };
}

export function tilePositionAnchored(
  anchorOffsetX: number,
  anchorOffsetY: number,
  slotCols: number,
  blockWidth: number,
  blockHeight: number,
  index: number
): TilePosition {
  const slotCol = index % slotCols;
  const slotRow = Math.floor(index / slotCols);

  return {
    left: anchorOffsetX + slotCol * blockWidth,
    top: anchorOffsetY + slotRow * blockHeight,
    width: blockWidth,
    height: blockHeight,
  };
}

export type GridCellPlacement = {
  col: number;
  row: number;
};

export function tileSpanCells(width: number, height: number, cellSize: number) {
  return {
    cols: Math.max(1, Math.round(width / cellSize)),
    rows: Math.max(1, Math.round(height / cellSize)),
  };
}

export function placementFromTilePosition(position: TilePosition, stage: StageGridLayout): GridCellPlacement {
  return {
    col: Math.round((position.left - stage.offsetX) / stage.cellSize),
    row: Math.round((position.top - stage.offsetY) / stage.cellSize),
  };
}

export function tilePositionFromPlacement(placement: GridCellPlacement, width: number, height: number, stage: StageGridLayout): TilePosition {
  return {
    left: stage.offsetX + placement.col * stage.cellSize,
    top: stage.offsetY + placement.row * stage.cellSize,
    width,
    height,
  };
}

export function clampPlacementToStage(placement: GridCellPlacement, width: number, height: number, stage: StageGridLayout): GridCellPlacement {
  const span = tileSpanCells(width, height, stage.cellSize);

  return {
    col: Math.max(0, Math.min(stage.cols - span.cols, placement.col)),
    row: Math.max(0, Math.min(stage.rows - span.rows, placement.row)),
  };
}

export function placementFromPixelOffset(
  leftPx: number,
  topPx: number,
  width: number,
  height: number,
  stage: StageGridLayout,
  options?: { softSnap?: boolean }
) {
  const softSnap = options?.softSnap ?? false;
  let col = (leftPx - stage.offsetX) / stage.cellSize;
  let row = (topPx - stage.offsetY) / stage.cellSize;

  if (softSnap) {
    const colPx = snapPxToGridIfClose(col * stage.cellSize, stage.cellSize);
    const rowPx = snapPxToGridIfClose(row * stage.cellSize, stage.cellSize);
    col = colPx / stage.cellSize;
    row = rowPx / stage.cellSize;
  } else {
    col = Math.round(col);
    row = Math.round(row);
  }

  return clampPlacementToStage({ col, row }, width, height, stage);
}

export function maxTilePixelSizeAtPlacement(stage: StageGridLayout, placement: GridCellPlacement) {
  return {
    width: Math.max(stage.cellSize, (stage.cols - placement.col) * stage.cellSize),
    height: Math.max(stage.cellSize, (stage.rows - placement.row) * stage.cellSize),
  };
}

export function placementsOverlap(
  a: GridCellPlacement,
  aSize: { width: number; height: number },
  b: GridCellPlacement,
  bSize: { width: number; height: number },
  cellSize: number
) {
  const aSpan = tileSpanCells(aSize.width, aSize.height, cellSize);
  const bSpan = tileSpanCells(bSize.width, bSize.height, cellSize);

  return !(a.col + aSpan.cols <= b.col || b.col + bSpan.cols <= a.col || a.row + aSpan.rows <= b.row || b.row + bSpan.rows <= a.row);
}
