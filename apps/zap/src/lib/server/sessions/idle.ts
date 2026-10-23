/**
 * Phase 2 lock: end / stale live sessions after 15 minutes with no activity
 * (playing sessions do not idle — see `isLiveSessionIdle`).
 *
 * Discord voice uses the same window (`DISCORD_VOICE_IDLE_MS`) so the bot
 * leaves the channel when the session has been idle that long.
 */
export const SESSION_IDLE_MS = 15 * 60 * 1000;

/** Idle window before the Discord bot auto-disconnects from voice. Keep in sync with session idle. */
export const DISCORD_VOICE_IDLE_MS = SESSION_IDLE_MS;

export function isSessionIdle(lastActivityAt: Date, now: Date = new Date(), idleMs = SESSION_IDLE_MS): boolean {
  return now.getTime() - lastActivityAt.getTime() >= idleMs;
}

export function msUntilIdle(lastActivityAt: Date, now: Date = new Date(), idleMs = SESSION_IDLE_MS): number {
  return Math.max(0, idleMs - (now.getTime() - lastActivityAt.getTime()));
}
