/** Geometry for the floating queue / devices widgets (icon ↔ panel ↔ fullscreen). */

export type Point = { x: number; y: number };
export type Rect = Point & { w: number; h: number };
export type Viewport = { w: number; h: number };
export type FloatingMode = "icon" | "panel" | "full";

export const ICON_SIZE = 52;
/** Releasing a drag with the pointer this close to the bottom edge triggers the drop action. */
export const DROP_ZONE_PX = 72;
export const PANEL_MIN = { w: 280, h: 240 } as const;
const EDGE = 8;

/** Limited resize: beyond this the user switches to fullscreen. */
export function panelMax(vp: Viewport) {
  return {
    w: Math.max(PANEL_MIN.w, Math.floor(Math.min(vp.w - EDGE * 2, vp.w * 0.6))),
    h: Math.max(PANEL_MIN.h, Math.floor(Math.min(vp.h - EDGE * 2, vp.h * 0.85))),
  };
}

/** Roughly a quarter of the screen, within the min/max bounds. */
export function defaultPanelSize(vp: Viewport) {
  const max = panelMax(vp);
  return {
    w: clamp(Math.round(vp.w * 0.34), PANEL_MIN.w, Math.min(max.w, 480)),
    h: clamp(Math.round(vp.h * 0.5), PANEL_MIN.h, Math.min(max.h, 640)),
  };
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), Math.max(min, max));
}

export function clampPoint(p: Point, size: { w: number; h: number }, vp: Viewport): Point {
  return {
    x: clamp(Math.round(p.x), EDGE, vp.w - size.w - EDGE),
    y: clamp(Math.round(p.y), EDGE, vp.h - size.h - EDGE),
  };
}

export function clampRect(r: Rect, vp: Viewport): Rect {
  const max = panelMax(vp);
  const w = clamp(Math.round(r.w), Math.min(PANEL_MIN.w, vp.w - EDGE * 2), max.w);
  const h = clamp(Math.round(r.h), Math.min(PANEL_MIN.h, vp.h - EDGE * 2), max.h);
  return { ...clampPoint(r, { w, h }, vp), w, h };
}

export function inDropZone(pointerY: number, vp: Viewport): boolean {
  return pointerY >= vp.h - DROP_ZONE_PX;
}

/** Icons stack upwards from the bottom-right corner; `slot` 0 is the lowest. */
export function defaultIconPos(vp: Viewport, slot: number): Point {
  return clampPoint({ x: vp.w - ICON_SIZE - 20, y: vp.h - ICON_SIZE - 28 - slot * (ICON_SIZE + 12) }, { w: ICON_SIZE, h: ICON_SIZE }, vp);
}

/** Open the panel next to its icon (growing up/left from it), kept on screen. */
export function panelRectNearIcon(icon: Point, size: { w: number; h: number }, vp: Viewport): Rect {
  const x = icon.x + ICON_SIZE / 2 > vp.w / 2 ? icon.x + ICON_SIZE - size.w : icon.x;
  const y = icon.y + ICON_SIZE / 2 > vp.h / 2 ? icon.y + ICON_SIZE - size.h : icon.y;
  return clampRect({ x, y, ...size }, vp);
}

export type StoredFloating = { mode: FloatingMode; icon: Point | null; panel: Rect | null };

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseStoredFloating(raw: string | null): StoredFloating {
  const fallback: StoredFloating = { mode: "icon", icon: null, panel: null };
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<StoredFloating>;
    const mode = v.mode === "panel" || v.mode === "full" ? v.mode : "icon";
    const icon = v.icon && isFiniteNum(v.icon.x) && isFiniteNum(v.icon.y) ? { x: v.icon.x, y: v.icon.y } : null;
    const p = v.panel;
    const panel = p && isFiniteNum(p.x) && isFiniteNum(p.y) && isFiniteNum(p.w) && isFiniteNum(p.h) ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
    return { mode, icon, panel };
  } catch {
    return fallback;
  }
}
