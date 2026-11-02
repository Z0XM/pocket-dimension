import { describe, expect, test } from "bun:test";
import { intervalDue, parseSyncInterval, parseSyncMode, syncIntervalToAutoSync, SYNC_INTERVAL_MS } from "./youtube-mirror";

describe("youtube mirror sync prefs", () => {
  test("parse sync mode / interval", () => {
    expect(parseSyncMode("additive")).toBe("additive");
    expect(parseSyncMode("exact")).toBe("exact");
    expect(parseSyncMode("other")).toBeNull();
    expect(parseSyncInterval("hourly")).toBe("hourly");
    expect(parseSyncInterval("every_6_hours")).toBe("every_6_hours");
    expect(parseSyncInterval("daily")).toBe("daily");
    expect(parseSyncInterval("weekly")).toBeNull();
  });

  test("interval maps to autoSync", () => {
    expect(syncIntervalToAutoSync("off")).toBe(false);
    expect(syncIntervalToAutoSync("hourly")).toBe(true);
    expect(syncIntervalToAutoSync("daily")).toBe(true);
  });

  test("intervalDue respects cadence", () => {
    const now = Date.parse("2026-11-02T12:00:00.000Z");
    expect(intervalDue(null, "hourly", now)).toBe(true);
    expect(intervalDue(new Date(now - 30 * 60 * 1000), "hourly", now)).toBe(false);
    expect(intervalDue(new Date(now - SYNC_INTERVAL_MS.hourly), "hourly", now)).toBe(true);
    expect(intervalDue(new Date(now - 5 * 60 * 60 * 1000), "every_6_hours", now)).toBe(false);
    expect(intervalDue(new Date(now - SYNC_INTERVAL_MS.every_6_hours), "every_6_hours", now)).toBe(true);
    expect(intervalDue(new Date(now - 12 * 60 * 60 * 1000), "daily", now)).toBe(false);
    expect(intervalDue(null, "off", now)).toBe(false);
  });
});
