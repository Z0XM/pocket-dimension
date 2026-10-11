export type FloatingPanelOptions = {
  anchor: DOMRectReadOnly;
  /** Desired panel width before viewport clamping. */
  panelWidth: number;
  /** Measured or preferred panel height (used when flipping above the anchor). */
  panelHeight?: number;
  /** Prefer aligning the panel's right edge to the anchor's right edge. */
  alignEnd?: boolean;
  gap?: number;
  padding?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

export type FloatingPanelPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function readViewportSize(width?: number, height?: number): { width: number; height: number } {
  if (typeof width === "number" && typeof height === "number") {
    return { width, height };
  }
  if (typeof window !== "undefined") {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: width ?? 1024, height: height ?? 768 };
}

/**
 * Compute a fixed-position placement that keeps a floating panel inside the viewport.
 * Prefers below the anchor; flips above when there is more room there.
 */
export function computeFloatingPanelPlacement(options: FloatingPanelOptions): FloatingPanelPlacement {
  const gap = options.gap ?? 4;
  const padding = options.padding ?? 8;
  const { width: vw, height: vh } = readViewportSize(options.viewportWidth, options.viewportHeight);
  const maxWidth = Math.max(0, vw - padding * 2);
  const width = Math.min(Math.max(0, options.panelWidth), maxWidth);

  let left = options.alignEnd ? options.anchor.right - width : options.anchor.left;
  left = Math.max(padding, Math.min(left, vw - width - padding));

  const spaceBelow = Math.max(0, vh - options.anchor.bottom - gap - padding);
  const spaceAbove = Math.max(0, options.anchor.top - gap - padding);
  const preferredHeight = options.panelHeight ?? Math.min(18 * 16, Math.max(spaceBelow, spaceAbove));

  let top: number;
  let maxHeight: number;

  if (spaceBelow >= Math.min(preferredHeight, 8 * 16) || spaceBelow >= spaceAbove) {
    top = options.anchor.bottom + gap;
    maxHeight = Math.max(0, spaceBelow);
  } else {
    maxHeight = Math.max(0, spaceAbove);
    const height = Math.min(preferredHeight, maxHeight);
    top = Math.max(padding, options.anchor.top - gap - height);
  }

  return { top, left, width, maxHeight };
}

export function floatingPanelStyle(placement: FloatingPanelPlacement): string {
  return `top:${placement.top}px;left:${placement.left}px;width:${placement.width}px;max-height:${placement.maxHeight}px;`;
}
