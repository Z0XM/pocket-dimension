export type DropdownPlacement = {
  openUp: boolean;
  maxHeightPx: number;
};

const DEFAULT_MAX = 224; // ~max-h-56
const MIN_MAX = 96;
const EDGE_PAD = 8;

const CLIPPING_OVERFLOW = new Set(["auto", "scroll", "hidden", "clip"]);

/** Vertical bounds the dropdown can actually show in: the viewport, narrowed by any clipping/scrolling ancestors. */
function visibleBounds(anchor: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  if (typeof window.getComputedStyle !== "function") return { top, bottom };
  for (let el = anchor.parentElement; el; el = el.parentElement) {
    if (!CLIPPING_OVERFLOW.has(window.getComputedStyle(el).overflowY)) continue;
    const r = el.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }
  return { top, bottom };
}

/** Fit a dropdown into the visible area (viewport or scroll container): flip up when needed and cap height so the list stays on-screen. */
export function measureDropdownPlacement(anchor: HTMLElement, preferredMax = DEFAULT_MAX, gap = 4): DropdownPlacement {
  const rect = anchor.getBoundingClientRect();
  const bounds = visibleBounds(anchor);
  const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - gap - EDGE_PAD);
  const spaceAbove = Math.max(0, rect.top - bounds.top - gap - EDGE_PAD);
  const openUp = spaceBelow < Math.min(preferredMax, 140) && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;
  const maxHeightPx = Math.max(MIN_MAX, Math.min(preferredMax, available || preferredMax));
  return { openUp, maxHeightPx };
}
