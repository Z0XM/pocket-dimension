import { describe, expect, test } from "bun:test";
import type { LiveSessionSummary } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "./session-start";

function live(over: Partial<LiveSessionSummary> & { id: string; role: "host" | "guest" }): LiveSessionSummary {
  return {
    joinCode: "ABC",
    name: "Session ABC",
    playbackState: "idle",
    positionMs: 0,
    currentTitle: null,
    hostUserId: "h",
    lastActivityAt: new Date().toISOString(),
    perpetual: false,
    status: "live",
    canRename: over.role === "host",
    canClose: over.role === "host",
    ...over,
  };
}

describe("canStartSession", () => {
  test("no live → can start", () => {
    expect(canStartSession([])).toBe(true);
  });

  test("guest-only → cannot start", () => {
    expect(canStartSession([live({ id: "1", role: "guest" })])).toBe(false);
  });

  test("host live → can start", () => {
    expect(canStartSession([live({ id: "1", role: "host" })])).toBe(true);
  });

  test("host + guest → can start", () => {
    expect(canStartSession([live({ id: "1", role: "guest" }), live({ id: "2", role: "host" })])).toBe(true);
  });
});

describe("primaryLiveSession", () => {
  test("prefers host", () => {
    const p = primaryLiveSession([live({ id: "g", role: "guest" }), live({ id: "h", role: "host" })]);
    expect(p?.id).toBe("h");
  });
});
