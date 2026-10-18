import { describe, expect, test } from "bun:test";
import {
  DROP_ZONE_PX,
  ICON_SIZE,
  PANEL_MIN,
  clampPoint,
  clampRect,
  defaultIconPos,
  defaultPanelSize,
  inDropZone,
  panelMax,
  panelRectNearIcon,
  parseStoredFloating,
} from "./floating-panel";

const desktop = { w: 1440, h: 900 };
const phone = { w: 375, h: 667 };

describe("panel sizing", () => {
  test("default is about a quarter of the screen and within bounds", () => {
    const size = defaultPanelSize(desktop);
    expect(size.w).toBeGreaterThanOrEqual(PANEL_MIN.w);
    expect(size.h).toBeGreaterThanOrEqual(PANEL_MIN.h);
    expect(size.w * size.h).toBeLessThan(desktop.w * desktop.h * 0.3);
  });

  test("resize is limited to min / max", () => {
    const max = panelMax(desktop);
    expect(clampRect({ x: 0, y: 0, w: 10, h: 10 }, desktop)).toMatchObject({ w: PANEL_MIN.w, h: PANEL_MIN.h });
    expect(clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, desktop)).toMatchObject({ w: max.w, h: max.h });
  });

  test("panels stay on small screens", () => {
    const r = clampRect({ x: 300, y: 600, w: 400, h: 400 }, phone);
    expect(r.x + r.w).toBeLessThanOrEqual(phone.w);
    expect(r.y + r.h).toBeLessThanOrEqual(phone.h);
    expect(r.x).toBeGreaterThanOrEqual(0);
  });
});

describe("icon placement", () => {
  test("defaults stack upward from the bottom-right", () => {
    const a = defaultIconPos(desktop, 0);
    const b = defaultIconPos(desktop, 1);
    expect(a.x).toBe(b.x);
    expect(b.y).toBeLessThan(a.y);
    expect(a.x + ICON_SIZE).toBeLessThanOrEqual(desktop.w);
  });

  test("clampPoint keeps the icon on screen", () => {
    expect(clampPoint({ x: -50, y: 5000 }, { w: ICON_SIZE, h: ICON_SIZE }, desktop)).toEqual({ x: 8, y: desktop.h - ICON_SIZE - 8 });
  });

  test("panel opens towards the screen centre from the icon", () => {
    const icon = defaultIconPos(desktop, 0);
    const r = panelRectNearIcon(icon, { w: 400, h: 400 }, desktop);
    expect(r.x + r.w).toBeLessThanOrEqual(icon.x + ICON_SIZE);
    expect(r.y + r.h).toBeLessThanOrEqual(icon.y + ICON_SIZE);
  });
});

describe("drop zone", () => {
  test("only the bottom edge band counts", () => {
    expect(inDropZone(desktop.h - 1, desktop)).toBe(true);
    expect(inDropZone(desktop.h - DROP_ZONE_PX, desktop)).toBe(true);
    expect(inDropZone(desktop.h - DROP_ZONE_PX - 1, desktop)).toBe(false);
  });
});

describe("stored state", () => {
  test("parses valid state and rejects garbage", () => {
    expect(parseStoredFloating(JSON.stringify({ mode: "panel", icon: { x: 1, y: 2 }, panel: { x: 1, y: 2, w: 300, h: 300 } }))).toEqual({
      mode: "panel",
      icon: { x: 1, y: 2 },
      panel: { x: 1, y: 2, w: 300, h: 300 },
    });
    expect(parseStoredFloating("{nope")).toEqual({ mode: "icon", icon: null, panel: null });
    expect(parseStoredFloating(JSON.stringify({ mode: "weird", icon: { x: "a" } }))).toEqual({ mode: "icon", icon: null, panel: null });
  });
});
