/** Locked Phase 3 anti-misuse cap. */
export const MAX_TRACK_DURATION_MS = 10 * 60 * 1000;

export function isOverDurationCap(durationMs: number | null | undefined, capMs = MAX_TRACK_DURATION_MS): boolean {
  if (durationMs == null || !Number.isFinite(durationMs)) return false;
  return durationMs > capMs;
}

export const DURATION_CAP_MESSAGE = "Zap only allows tracks up to 10 minutes";
