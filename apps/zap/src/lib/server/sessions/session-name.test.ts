import { describe, expect, test } from "bun:test";
import { SESSION_NAME_MAX_LEN, defaultSessionName, hostLabelForSession, normalizeSessionName } from "./session-name";

describe("hostLabelForSession", () => {
  test("prefers name, then username, then email local-part", () => {
    expect(hostLabelForSession({ name: "Alex", username: "alex", email: "a@b.c" })).toBe("Alex");
    expect(hostLabelForSession({ name: "  ", username: "alex", email: "a@b.c" })).toBe("alex");
    expect(hostLabelForSession({ name: null, username: null, email: "jess@example.com" })).toBe("jess");
    expect(hostLabelForSession({ name: null, username: null, email: null })).toBeNull();
  });
});

describe("defaultSessionName", () => {
  test("uses host label when present", () => {
    expect(defaultSessionName("ABC123", "Alex")).toBe("Alex's session");
  });

  test("falls back to join code", () => {
    expect(defaultSessionName("ABC123")).toBe("Session ABC123");
    expect(defaultSessionName("ABC123", "  ")).toBe("Session ABC123");
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
