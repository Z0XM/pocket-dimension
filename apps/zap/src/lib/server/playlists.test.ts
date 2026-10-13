import { describe, expect, test } from "bun:test";

/** Pure merge dedupe used by mergePlaylists ordering. */
function mergeOrderedIds(groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const id of group) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

describe("playlist merge order", () => {
  test("dedupes preserving first-seen order across sources", () => {
    expect(
      mergeOrderedIds([
        ["a", "b"],
        ["b", "c"],
        ["a", "d"],
      ])
    ).toEqual(["a", "b", "c", "d"]);
  });
});
