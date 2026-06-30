import { GridStack, type GridItemHTMLElement, type GridStackWidget } from "gridstack";
import type { CallTileLayout, GridMetrics } from "./types";
import { nearestPreset } from "./tile-sizes";

export type TileGridEngine = {
  grid: GridStack;
  destroy: () => void;
};

export function createTileGridEngine(container: HTMLElement, metrics: GridMetrics, onLayoutSettled: () => void): TileGridEngine {
  const grid = GridStack.init(
    {
      column: metrics.cols,
      cellHeight: metrics.cellSize,
      margin: 0,
      float: false,
      animate: true,
      staticGrid: true,
      resizable: { handles: "se" },
    },
    container
  );

  const settle = () => onLayoutSettled();

  grid.on("dragstop", settle);

  grid.on("resizestop", (_event, element) => {
    const node = (element as GridItemHTMLElement).gridstackNode;
    if (node?.w && node?.h) {
      const preset = nearestPreset(node.w, node.h);
      if (preset.w !== node.w || preset.h !== node.h) {
        grid.update(element, { w: preset.w, h: preset.h });
      }
    }

    settle();
  });

  return {
    grid,
    destroy: () => {
      grid.off("dragstop");
      grid.off("resizestop");
      grid.destroy(false);
    },
  };
}

export function widgetsFromLayout(layout: CallTileLayout): GridStackWidget[] {
  return Object.entries(layout.tiles).map(([id, rect]) => ({
    id,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  }));
}

export function updateGridMetrics(grid: GridStack, metrics: GridMetrics) {
  if (grid.getColumn() !== metrics.cols) {
    grid.column(metrics.cols, "moveScale");
  }

  grid.cellHeight(metrics.cellSize);
}

export function setGridEditMode(grid: GridStack, editMode: boolean) {
  grid.setStatic(!editMode);
}

export function registerGridWidgets(grid: GridStack, container: HTMLElement, layout: CallTileLayout) {
  for (const element of container.querySelectorAll<HTMLElement>(".grid-stack-item")) {
    const id = element.dataset.tileId;
    if (!id) continue;

    const rect = layout.tiles[id];
    if (!rect) continue;

    const item = element as GridItemHTMLElement;
    if (!item.gridstackNode) {
      grid.makeWidget(item, { id, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    }
  }
}
