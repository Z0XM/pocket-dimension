export type SongProgressPhase = "probing" | "downloading" | "uploading" | "finalizing" | "done" | "skipped" | "failed";

export type SongProgress = {
  identityKey?: string;
  title?: string | null;
  phase: SongProgressPhase;
  /** 0–100 within the current phase */
  percent: number;
};

/** Throttle percent updates so NDJSON streams stay light. */
export function createPercentThrottle(onEmit: (percent: number) => void, minDelta = 2, minIntervalMs = 200) {
  let last = -1;
  let lastAt = 0;
  return (percent: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const now = Date.now();
    if (clamped >= 100 || clamped - last >= minDelta || now - lastAt >= minIntervalMs) {
      last = clamped;
      lastAt = now;
      onEmit(clamped);
    }
  };
}

export function parseYtDlpDownloadPercent(line: string): number | null {
  const pct = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  if (pct) return Math.min(100, Math.round(Number(pct[1])));
  if (/\[download\].*100%/.test(line) || /has already been downloaded/i.test(line)) return 100;
  return null;
}
