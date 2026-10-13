import type { LiveSessionSummary } from "$lib/server/sessions";

/**
 * Guests cannot start sessions.
 * - No live memberships → may start
 * - Host of any live session → may start (New) / resume
 * - Live guest-only (no host role) → Join / Resume only
 */
export function canStartSession(live: LiveSessionSummary[]): boolean {
  if (live.length === 0) return true;
  return live.some((s) => s.role === "host");
}

export function primaryLiveSession(live: LiveSessionSummary[]): LiveSessionSummary | null {
  if (live.length === 0) return null;
  return live.find((s) => s.role === "host") ?? live[0] ?? null;
}
