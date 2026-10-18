import { describe, expect, test } from "bun:test";
import { mergeActivity, parseAdminActivityKind, parseBeforeCursor, type AdminActivityEntry } from "./activity-merge";

function entry(id: string, at: string, kind: AdminActivityEntry["kind"] = "play"): AdminActivityEntry {
  return { id, at, kind, userId: "u", userLabel: "u", summary: id, detail: null };
}

describe("mergeActivity", () => {
  test("merges sources newest first and applies the limit", () => {
    const plays = [entry("play:2", "2026-10-18T10:00:00.000Z"), entry("play:1", "2026-10-17T10:00:00.000Z")];
    const sessions = [entry("session:1", "2026-10-18T11:00:00.000Z", "session_started")];
    const imports = [entry("sync:1", "2026-10-16T09:00:00.000Z", "import")];
    expect(mergeActivity([plays, sessions, imports], 3).map((e) => e.id)).toEqual(["session:1", "play:2", "play:1"]);
  });

  test("ties are ordered deterministically by id", () => {
    const at = "2026-10-18T10:00:00.000Z";
    expect(mergeActivity([[entry("a", at)], [entry("b", at)]], 5).map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("activity query parsing", () => {
  test("kind must be known", () => {
    expect(parseAdminActivityKind("upload")).toBe("upload");
    expect(parseAdminActivityKind("delete")).toBeNull();
    expect(parseAdminActivityKind(null)).toBeNull();
  });

  test("before cursor must be a valid date", () => {
    expect(parseBeforeCursor("2026-10-18T10:00:00.000Z")?.toISOString()).toBe("2026-10-18T10:00:00.000Z");
    expect(parseBeforeCursor("yesterday")).toBeNull();
    expect(parseBeforeCursor("")).toBeNull();
  });
});
