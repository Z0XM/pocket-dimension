import { estimatePositionMs } from "$lib/catalog-queue";

/** Drift above this snaps immediately (track change, big desync, seek miss). */
export const PLAYHEAD_HARD_SNAP_MS = 1500;
/** Soft correction blend per frame toward the authoritative target. */
export const PLAYHEAD_SOFT_BLEND = 0.2;
/** Optimistic seek is done once live target is this close. */
export const PLAYHEAD_SEEK_CATCHUP_MS = 750;

export function serverPlayheadMs(
  session: { playbackState: string; positionMs: number; positionUpdatedAt: string | Date } | null | undefined,
  nowMs: number,
  durationMs?: number | null
): number {
  if (!session) return 0;
  if (session.playbackState !== "playing" && session.playbackState !== "paused" && session.playbackState !== "idle") {
    return Math.max(0, session.positionMs);
  }
  return estimatePositionMs(
    {
      playbackState: session.playbackState === "playing" ? "playing" : "paused",
      positionMs: session.positionMs,
      positionUpdatedAt: session.positionUpdatedAt,
    },
    nowMs,
    durationMs
  );
}

/**
 * One-frame reconcile: hard-snap on large drift / forced reset, otherwise ease toward target
 * so SSE anchors don't make the thumb jump while local time keeps advancing smoothly.
 */
export function reconcilePlayhead(renderMs: number, targetMs: number, hardSnap: boolean): number {
  const drift = targetMs - renderMs;
  if (hardSnap || Math.abs(drift) >= PLAYHEAD_HARD_SNAP_MS) return targetMs;
  if (Math.abs(drift) <= 40) return targetMs;
  return renderMs + drift * PLAYHEAD_SOFT_BLEND;
}
