import { describe, expect, test } from "bun:test";

/** Mirrors the visibility rule used when listing/resolving tags. */
function isTagVisibleToUser(tag: { kind: string; ownerUserId: string | null }, userId: string) {
  if (tag.kind === "system") return true;
  if (tag.kind === "custom") return tag.ownerUserId === userId;
  return false;
}

describe("custom tag privacy", () => {
  test("system tags are visible to everyone", () => {
    expect(isTagVisibleToUser({ kind: "system", ownerUserId: null }, "user-a")).toBe(true);
    expect(isTagVisibleToUser({ kind: "system", ownerUserId: null }, "user-b")).toBe(true);
  });

  test("custom tags are only visible to their owner", () => {
    const tag = { kind: "custom", ownerUserId: "user-a" };
    expect(isTagVisibleToUser(tag, "user-a")).toBe(true);
    expect(isTagVisibleToUser(tag, "user-b")).toBe(false);
  });
});
