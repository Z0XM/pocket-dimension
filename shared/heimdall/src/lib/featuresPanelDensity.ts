/**
 * Features Project areas aside scroll ceilings (FR6 / UX-DR4 / AD-T6-4).
 * Lock-in: do not exceed these compact caps (no ~70vh / large dvh regressions).
 */
export const FEATURES_PROJECT_AREAS_SCROLL_MAX_H_BASE = "max-h-40" as const;

/** sm+ breakpoint ceiling — 42vh max */
export const FEATURES_PROJECT_AREAS_SCROLL_MAX_H_SM = "sm:max-h-[42vh]" as const;

export const FEATURES_PROJECT_AREAS_SCROLL_OVERFLOW = "overflow-y-auto overscroll-contain" as const;

/** Tailwind max-h-40 = 10rem */
export const FEATURES_PROJECT_AREAS_MAX_HEIGHT_REM = 10;

/** sm+ viewport fraction ceiling */
export const FEATURES_PROJECT_AREAS_MAX_HEIGHT_VH = 42;

/** Patterns that must never appear in scroll region classes */
export const FEATURES_PROJECT_AREAS_FORBIDDEN_SCROLL_PATTERNS = [
  /100dvh/i,
  /70vh/i,
  /calc\(100dvh/i,
  /lg:max-h-\[calc\(100dvh/i,
  /max-h-\[min\(20rem/i,
] as const;

export function featuresProjectAreasScrollClassName(): string {
  return `${FEATURES_PROJECT_AREAS_SCROLL_MAX_H_BASE} ${FEATURES_PROJECT_AREAS_SCROLL_OVERFLOW} ${FEATURES_PROJECT_AREAS_SCROLL_MAX_H_SM}`;
}
