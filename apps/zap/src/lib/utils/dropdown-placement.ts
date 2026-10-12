export type DropdownPlacement = {
  openUp: boolean;
  maxHeightPx: number;
};

const DEFAULT_MAX = 224; // ~max-h-56
const MIN_MAX = 96;
const EDGE_PAD = 8;

/** Fit a dropdown into the viewport: flip up when needed and cap height so the list stays scrollable on-screen. */
export function measureDropdownPlacement(anchor: HTMLElement, preferredMax = DEFAULT_MAX, gap = 4): DropdownPlacement {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap - EDGE_PAD);
  const spaceAbove = Math.max(0, rect.top - gap - EDGE_PAD);
  const openUp = spaceBelow < Math.min(preferredMax, 140) && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;
  const maxHeightPx = Math.max(MIN_MAX, Math.min(preferredMax, available || preferredMax));
  return { openUp, maxHeightPx };
}
