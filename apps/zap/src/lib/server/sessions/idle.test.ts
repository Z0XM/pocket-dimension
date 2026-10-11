import { describe, expect, test } from "bun:test";
import { SESSION_IDLE_MS, isSessionIdle, msUntilIdle } from "./idle";

describe("session idle", () => {
  test("not idle within window", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const last = new Date(now.getTime() - SESSION_IDLE_MS + 60_000);
    expect(isSessionIdle(last, now)).toBe(false);
    expect(msUntilIdle(last, now)).toBe(60_000);
  });

  test("idle at exactly 15 minutes", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const last = new Date(now.getTime() - SESSION_IDLE_MS);
    expect(isSessionIdle(last, now)).toBe(true);
    expect(msUntilIdle(last, now)).toBe(0);
  });
});
