import { describe, expect, test } from "bun:test";
import { SESSION_NAME_MAX_LEN, defaultSessionName, normalizeSessionName } from "./session-name";

describe("defaultSessionName", () => {
  test("prefixes join code", () => {
    expect(defaultSessionName("ABC123")).toBe("Session ABC123");
  });
});

describe("normalizeSessionName", () => {
  test("nullish / blank → null", () => {
    expect(normalizeSessionName(null)).toBeNull();
    expect(normalizeSessionName(undefined)).toBeNull();
    expect(normalizeSessionName("")).toBeNull();
    expect(normalizeSessionName("   ")).toBeNull();
  });

  test("trims and collapses whitespace", () => {
    expect(normalizeSessionName("  Late   night  ")).toBe("Late night");
  });

  test("rejects overlong names", () => {
    expect(() => normalizeSessionName("x".repeat(SESSION_NAME_MAX_LEN + 1))).toThrow(/80/);
  });

  test("accepts max length", () => {
    const name = "x".repeat(SESSION_NAME_MAX_LEN);
    expect(normalizeSessionName(name)).toBe(name);
  });
});
