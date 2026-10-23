import { describe, expect, test } from "bun:test";
import { generateShareCode, normalizeShareCode } from "./playlist-share-code";

describe("playlist-share-code", () => {
  test("generateShareCode length and alphabet", () => {
    const code = generateShareCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });

  test("normalizeShareCode trims and uppercases", () => {
    expect(normalizeShareCode("  ab-cd 12 ")).toBe("ABCD12");
  });
});
