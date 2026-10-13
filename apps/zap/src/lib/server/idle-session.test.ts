import { describe, expect, test } from "bun:test";
import { SESSION_IDLE_MS } from "$lib/server/sessions/idle";
import { isLiveSessionIdle } from "./idle-session";

describe("isLiveSessionIdle", () => {
  test("playing sessions never idle", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const last = new Date(now.getTime() - SESSION_IDLE_MS * 3);
    expect(isLiveSessionIdle({ lastActivityAt: last, playbackState: "playing", now })).toBe(false);
  });

  test("paused sessions idle after window", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const last = new Date(now.getTime() - SESSION_IDLE_MS);
    expect(isLiveSessionIdle({ lastActivityAt: last, playbackState: "paused", now })).toBe(true);
  });
});
