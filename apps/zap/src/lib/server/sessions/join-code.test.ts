import { describe, expect, test } from "bun:test";
import { generateJoinCode, normalizeJoinCode } from "./join-code";

describe("join-code", () => {
  test("generateJoinCode length and alphabet", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });

  test("normalizeJoinCode strips and uppercases", () => {
    expect(normalizeJoinCode("  k7m2qx ")).toBe("K7M2QX");
    expect(normalizeJoinCode("ab-cd")).toBe("ABCD");
    expect(normalizeJoinCode("")).toBe("");
  });
});
