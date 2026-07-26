import { describe, expect, test } from "bun:test";
import { computeStageGrid, findCenteredPlacement, placementsOverlap, type GridCellPlacement, type OccupiedGridTile } from "./stage-grid";

function stage() {
  const layout = computeStageGrid(1280, 720, { minCellSize: 40 });
  if (!layout) throw new Error("expected stage layout");
  return layout;
}

describe("findCenteredPlacement", () => {
  test("places the first tile at stage center", () => {
    const layout = stage();
    const size = { width: layout.cellSize * 4, height: layout.cellSize * 3 };
    const placement = findCenteredPlacement(layout, size, []);

    const spanCols = 4;
    const spanRows = 3;
    const expectedCol = Math.floor((layout.cols - spanCols) / 2);
    const expectedRow = Math.floor((layout.rows - spanRows) / 2);

    expect(placement).toEqual({ col: expectedCol, row: expectedRow });
  });

  test("places a new tile without overlapping an existing centered tile", () => {
    const layout = stage();
    const size = { width: layout.cellSize * 4, height: layout.cellSize * 3 };
    const first = findCenteredPlacement(layout, size, []);
    const occupied: OccupiedGridTile[] = [{ placement: first, size }];
    const second = findCenteredPlacement(layout, size, occupied);

    expect(placementsOverlap(first, size, second, size, layout.cellSize)).toBe(false);
  });

  test("keeps existing placements undisturbed when adding newcomers", () => {
    const layout = stage();
    const size = { width: layout.cellSize * 3, height: layout.cellSize * 2 };
    const existing: Array<{ key: string; placement: GridCellPlacement }> = [
      { key: "a", placement: { col: 0, row: 0 } },
      { key: "b", placement: { col: 6, row: 0 } },
    ];
    const occupied = existing.map((tile) => ({ placement: tile.placement, size }));
    const next = findCenteredPlacement(layout, size, occupied);

    for (const tile of existing) {
      expect(tile.placement).toEqual(tile.key === "a" ? { col: 0, row: 0 } : { col: 6, row: 0 });
      expect(placementsOverlap(tile.placement, size, next, size, layout.cellSize)).toBe(false);
    }
  });
});
