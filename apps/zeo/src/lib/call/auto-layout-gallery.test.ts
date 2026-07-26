import { describe, expect, test } from "bun:test";
import { chooseGalleryGridDims, computeAutoLayoutFrames, resolveMainAndOtherTiles } from "./auto-layout";
import type { StageTileEntry } from "./stage-tiles";
import { computeStageGrid } from "$lib/stage-grid";
import type { LocalParticipant } from "livekit-client";

function fakeTiles(count: number): StageTileEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `tile-${index + 1}`,
    kind: "demo" as const,
    participant: { identity: `demo-${index + 1}` } as LocalParticipant,
    label: `Demo ${index + 1}`,
  }));
}

describe("chooseGalleryGridDims", () => {
  test("uses 2×2 for four tiles on a landscape stage", () => {
    expect(chooseGalleryGridDims(4, 880, 800)).toEqual({ cols: 2, rows: 2 });
  });

  test("uses a balanced grid for five tiles instead of 1×5", () => {
    const dims = chooseGalleryGridDims(5, 880, 800);
    expect(dims.cols).toBeGreaterThan(1);
    expect(dims.rows).toBeGreaterThan(1);
    expect(dims.cols * dims.rows).toBeGreaterThanOrEqual(5);
  });

  test("uses 2×1 or 1×2 for two tiles", () => {
    const landscape = chooseGalleryGridDims(2, 1200, 700);
    expect(landscape).toEqual({ cols: 2, rows: 1 });

    const portrait = chooseGalleryGridDims(2, 700, 1200);
    expect(portrait).toEqual({ cols: 1, rows: 2 });
  });
});

describe("gallery layout frames", () => {
  test("places four tiles in a 2×2 equal grid", () => {
    const stage = computeStageGrid(880, 800, { minCellSize: 40 });
    if (!stage) throw new Error("expected stage");

    const frames = computeAutoLayoutFrames(fakeTiles(4), stage, "gallery", null);
    const positions = Object.values(frames);
    expect(positions).toHaveLength(4);

    const widths = new Set(positions.map((frame) => Math.round(frame.width)));
    const heights = new Set(positions.map((frame) => Math.round(frame.height)));
    expect(widths.size).toBe(1);
    expect(heights.size).toBe(1);

    const lefts = [...new Set(positions.map((frame) => Math.round(frame.left)))].sort((a, b) => a - b);
    const tops = [...new Set(positions.map((frame) => Math.round(frame.top)))].sort((a, b) => a - b);
    expect(lefts).toHaveLength(2);
    expect(tops).toHaveLength(2);
  });
});

describe("pinned main stage", () => {
  test("uses pinned tiles as main and leaves the rest as others", () => {
    const tiles = fakeTiles(4);
    const { main, others } = resolveMainAndOtherTiles(tiles, null, ["tile-2", "tile-4"]);
    expect(main.map((tile) => tile.key)).toEqual(["tile-2", "tile-4"]);
    expect(others.map((tile) => tile.key)).toEqual(["tile-1", "tile-3"]);
  });

  test("shares speaker main stage equally across multiple pins", () => {
    const stage = computeStageGrid(880, 800, { minCellSize: 40 });
    if (!stage) throw new Error("expected stage");

    const frames = computeAutoLayoutFrames(fakeTiles(4), stage, "speaker", null, {
      pinnedTileKeys: ["tile-1", "tile-2"],
    });

    const mainA = frames["tile-1"];
    const mainB = frames["tile-2"];
    expect(mainA).toBeDefined();
    expect(mainB).toBeDefined();
    expect(Math.round(mainA.width)).toBe(Math.round(mainB.width));
    expect(Math.round(mainA.height)).toBe(Math.round(mainB.height));
    expect(Math.round(mainA.top)).toBe(Math.round(mainB.top));
    expect(mainA.left).not.toBe(mainB.left);

    // Unpinned tiles sit in the top strip (above the main stage).
    expect(frames["tile-3"].top).toBeLessThan(mainA.top);
    expect(frames["tile-4"].top).toBeLessThan(mainA.top);
  });
});
