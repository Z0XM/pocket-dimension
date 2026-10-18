import { describe, expect, test } from "bun:test";
import {
  clampVolume,
  dedupeIds,
  defaultOutputEnabled,
  deviceLabelFromUserAgent,
  estimatePositionMs,
  formatClock,
  insertionIndex,
  isEnqueueMode,
  isPermutation,
  isValidDeviceId,
  moveItem,
  neighbourId,
  spliceIds,
} from "./catalog-queue";

const items = (sources: string[]) => sources.map((source, i) => ({ id: `i${i}`, source }));

describe("insertionIndex", () => {
  const q = items(["last", "last", "queue", "queue", "last"]);

  test("play / next insert right after the playhead", () => {
    expect(insertionIndex(q, "i1", "play")).toBe(2);
    expect(insertionIndex(q, "i1", "next")).toBe(2);
  });

  test("add to queue goes after earlier add-to-queue rows following the playhead", () => {
    expect(insertionIndex(q, "i1", "queue")).toBe(4);
    expect(insertionIndex(q, "i4", "queue")).toBe(5);
  });

  test("last appends", () => {
    expect(insertionIndex(q, "i0", "last")).toBe(5);
  });

  test("no playhead (empty or finished) appends for every mode", () => {
    expect(insertionIndex(q, null, "play")).toBe(5);
    expect(insertionIndex(q, "missing", "next")).toBe(5);
    expect(insertionIndex([], null, "queue")).toBe(0);
  });
});

describe("order helpers", () => {
  test("spliceIds clamps the index", () => {
    expect(spliceIds(["a", "b"], 1, ["x", "y"])).toEqual(["a", "x", "y", "b"]);
    expect(spliceIds(["a"], 99, ["x"])).toEqual(["a", "x"]);
    expect(spliceIds(["a"], -3, ["x"])).toEqual(["x", "a"]);
  });

  test("isPermutation", () => {
    expect(isPermutation(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isPermutation(["a", "b"], ["a", "a"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a", "z"])).toBe(false);
  });

  test("moveItem", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  test("neighbourId", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(neighbourId(list, "b", 1)).toBe("c");
    expect(neighbourId(list, "b", -1)).toBe("a");
    expect(neighbourId(list, "c", 1)).toBeNull();
    expect(neighbourId(list, null, 1)).toBeNull();
  });

  test("dedupeIds keeps first occurrence order", () => {
    expect(dedupeIds(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
});

describe("estimatePositionMs", () => {
  const at = new Date("2026-10-18T10:00:00.000Z");

  test("paused stays put", () => {
    expect(estimatePositionMs({ playbackState: "paused", positionMs: 5000, positionUpdatedAt: at }, at.getTime() + 60_000)).toBe(5000);
  });

  test("playing extrapolates and clamps to duration", () => {
    const s = { playbackState: "playing" as const, positionMs: 1000, positionUpdatedAt: at.toISOString() };
    expect(estimatePositionMs(s, at.getTime() + 2500)).toBe(3500);
    expect(estimatePositionMs(s, at.getTime() + 999_000, 120_000)).toBe(120_000);
    expect(estimatePositionMs(s, at.getTime() - 5000)).toBe(1000);
  });
});

describe("devices", () => {
  test("a new device only outputs audio when no other online device does", () => {
    expect(defaultOutputEnabled([])).toBe(true);
    expect(defaultOutputEnabled([{ outputEnabled: false }])).toBe(true);
    expect(defaultOutputEnabled([{ outputEnabled: false }, { outputEnabled: true }])).toBe(false);
  });

  test("device labels from user agents", () => {
    expect(
      deviceLabelFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36")
    ).toBe("Chrome · macOS");
    expect(
      deviceLabelFromUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("Safari · iOS");
    expect(deviceLabelFromUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox · Linux");
    expect(deviceLabelFromUserAgent(null)).toBe("Browser");
  });

  test("device id validation", () => {
    expect(isValidDeviceId("0193b0f4-5c6e-7d1a-9b2c-3d4e5f607182")).toBe(true);
    expect(isValidDeviceId("short")).toBe(false);
    expect(isValidDeviceId("../../etc")).toBe(false);
    expect(isValidDeviceId(42)).toBe(false);
  });

  test("clampVolume", () => {
    expect(clampVolume(140)).toBe(100);
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume("55.6")).toBe(56);
    expect(clampVolume("loud")).toBeNull();
  });
});

describe("misc", () => {
  test("isEnqueueMode", () => {
    expect(isEnqueueMode("next")).toBe(true);
    expect(isEnqueueMode("replace")).toBe(false);
  });

  test("formatClock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(61_500)).toBe("1:01");
    expect(formatClock(null)).toBe("0:00");
  });
});
