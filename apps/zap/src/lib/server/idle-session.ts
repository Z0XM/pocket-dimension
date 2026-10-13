import type { SessionPlaybackState } from "$lib/server/sessions/types";
import { SESSION_IDLE_MS, isSessionIdle as isTimestampIdle } from "$lib/server/sessions/idle";

/** Live sessions that are actively playing do not idle-end (resume / long listens). */
export function isLiveSessionIdle(opts: { lastActivityAt: Date; playbackState: SessionPlaybackState; now?: Date; idleMs?: number }): boolean {
  if (opts.playbackState === "playing") return false;
  return isTimestampIdle(opts.lastActivityAt, opts.now, opts.idleMs ?? SESSION_IDLE_MS);
}
