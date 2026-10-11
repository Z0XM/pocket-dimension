/** Phase 2 lock: end live sessions after 15 minutes with no activity. */
export const SESSION_IDLE_MS = 15 * 60 * 1000;

export function isSessionIdle(lastActivityAt: Date, now: Date = new Date(), idleMs = SESSION_IDLE_MS): boolean {
  return now.getTime() - lastActivityAt.getTime() >= idleMs;
}

export function msUntilIdle(lastActivityAt: Date, now: Date = new Date(), idleMs = SESSION_IDLE_MS): number {
  return Math.max(0, idleMs - (now.getTime() - lastActivityAt.getTime()));
}
