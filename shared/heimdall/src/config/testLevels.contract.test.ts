import { describe, expect, it } from "vitest";
import { CONFIG_TEST_LEVELS, resolveEnabledTestLevels, isConfigTestLevelEnabled } from "./testLevels.js";

describe("pages.testLevels helpers", () => {
  it("omitted config enables all levels", () => {
    expect([...resolveEnabledTestLevels(undefined)].sort()).toEqual([...CONFIG_TEST_LEVELS].sort());
  });

  it("explicit list enables only those levels", () => {
    const enabled = resolveEnabledTestLevels(["L1"]);
    expect(enabled.has("L1")).toBe(true);
    expect(enabled.has("L2")).toBe(false);
    expect(enabled.has("L5")).toBe(false);
    expect(isConfigTestLevelEnabled("L1", enabled)).toBe(true);
    expect(isConfigTestLevelEnabled("tooling", enabled)).toBe(false);
  });

  it("empty list enables none", () => {
    expect(resolveEnabledTestLevels([]).size).toBe(0);
  });
});
