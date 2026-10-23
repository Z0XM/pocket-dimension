import { describe, expect, test } from "bun:test";
import { importStatusFromCounts } from "./youtube-status";

describe("importStatusFromCounts", () => {
  test("empty playlist", () => {
    expect(importStatusFromCounts(0, 0)).toBe("not_imported");
  });

  test("none / partial / full", () => {
    expect(importStatusFromCounts(10, 0)).toBe("not_imported");
    expect(importStatusFromCounts(10, 3)).toBe("partially_imported");
    expect(importStatusFromCounts(10, 10)).toBe("fully_imported");
  });
});
