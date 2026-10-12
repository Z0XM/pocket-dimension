import { describe, expect, test } from "bun:test";
import { measureDropdownPlacement } from "./dropdown-placement";

function fakeAnchor(top: number, bottom: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

describe("measureDropdownPlacement", () => {
  test("opens down when plenty of space below", () => {
    // @ts-expect-error test stub
    globalThis.window = { innerHeight: 800 };
    const p = measureDropdownPlacement(fakeAnchor(100, 140));
    expect(p.openUp).toBe(false);
    expect(p.maxHeightPx).toBe(224);
  });

  test("opens up and caps height near bottom of viewport", () => {
    // @ts-expect-error test stub
    globalThis.window = { innerHeight: 800 };
    const p = measureDropdownPlacement(fakeAnchor(720, 760));
    expect(p.openUp).toBe(true);
    expect(p.maxHeightPx).toBeLessThanOrEqual(224);
    expect(p.maxHeightPx).toBeGreaterThanOrEqual(96);
    // space above ≈ 720 - 4 - 8 = 708 → still capped at preferred 224
    expect(p.maxHeightPx).toBe(224);
  });

  test("caps to remaining space when both sides are tight", () => {
    // @ts-expect-error test stub
    globalThis.window = { innerHeight: 200 };
    const p = measureDropdownPlacement(fakeAnchor(80, 120));
    // below: 200-120-4-8=68, above: 80-4-8=68 → openUp false (not greater), max = max(96, min(224,68))=96
    expect(p.maxHeightPx).toBe(96);
  });
});
