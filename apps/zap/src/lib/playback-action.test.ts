import { describe, expect, test } from "bun:test";
import { nextPlaybackAction } from "./playback-action";

describe("nextPlaybackAction", () => {
  test("playing → pause", () => {
    expect(nextPlaybackAction(true, false)).toBe("pause");
  });
  test("paused same track → resume (not load)", () => {
    expect(nextPlaybackAction(true, true)).toBe("resume");
  });
  test("different / unloaded → load", () => {
    expect(nextPlaybackAction(false, true)).toBe("load");
    expect(nextPlaybackAction(false, false)).toBe("load");
  });
});
