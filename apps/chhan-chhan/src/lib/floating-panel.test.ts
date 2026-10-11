import { describe, expect, test } from "bun:test";
import { computeFloatingPanelPlacement } from "$lib/floating-panel";

function rect(left: number, top: number, width: number, height: number): DOMRectReadOnly {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    },
  };
}

describe("computeFloatingPanelPlacement", () => {
  test("clamps align-end menus that would overflow the left edge", () => {
    const placement = computeFloatingPanelPlacement({
      anchor: rect(16, 120, 72, 32),
      panelWidth: 16 * 16,
      alignEnd: true,
      padding: 8,
      viewportWidth: 375,
      viewportHeight: 800,
    });

    expect(placement.left).toBe(8);
    expect(placement.width).toBeLessThanOrEqual(375 - 16);
    expect(placement.left + placement.width).toBeLessThanOrEqual(375 - 8);
  });

  test("keeps start-aligned menus inside the right edge", () => {
    const placement = computeFloatingPanelPlacement({
      anchor: rect(280, 80, 80, 28),
      panelWidth: 220,
      alignEnd: false,
      padding: 8,
      viewportWidth: 375,
      viewportHeight: 800,
    });

    expect(placement.left).toBeGreaterThanOrEqual(8);
    expect(placement.left + placement.width).toBeLessThanOrEqual(367);
  });

  test("flips above when there is more room above the anchor", () => {
    const placement = computeFloatingPanelPlacement({
      anchor: rect(40, 420, 100, 30),
      panelWidth: 160,
      panelHeight: 200,
      padding: 8,
      gap: 4,
      viewportWidth: 400,
      viewportHeight: 500,
    });

    expect(placement.top).toBeLessThan(420);
    expect(placement.maxHeight).toBeGreaterThan(0);
  });
});
