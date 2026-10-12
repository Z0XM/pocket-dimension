import { describe, expect, test } from "bun:test";
import { MAX_TRACK_DURATION_MS, isOverDurationCap } from "./limits";

describe("duration cap", () => {
  test("10 minutes exact is allowed", () => {
    expect(isOverDurationCap(MAX_TRACK_DURATION_MS)).toBe(false);
  });
  test("over 10 minutes rejected", () => {
    expect(isOverDurationCap(MAX_TRACK_DURATION_MS + 1)).toBe(true);
  });
  test("unknown duration not rejected at gate helper", () => {
    expect(isOverDurationCap(null)).toBe(false);
    expect(isOverDurationCap(undefined)).toBe(false);
  });
});
