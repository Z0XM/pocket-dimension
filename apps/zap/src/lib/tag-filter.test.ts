import { describe, expect, test } from "bun:test";
import {
  effectiveTagQuery,
  findPlaylistMatchingTagFilter,
  rankTopTagIds,
  tagFilterKey,
  tagIdsToQuery,
  tagQueryProblem,
  type TagFilterTag,
} from "./tag-filter";

const tags: TagFilterTag[] = [
  { id: "t-chill", name: "chill", kind: "system", slug: "chill" },
  { id: "t-lofi", name: "Lo-Fi", kind: "system", slug: "lo-fi" },
  { id: "t-sad", name: "sad", kind: "system", slug: "sad" },
  { id: "t-gym", name: "gym", kind: "system", slug: "gym" },
  { id: "t-late", name: "Late Night", kind: "custom", slug: "late-night" },
  { id: "t-road", name: "road trip", kind: "custom", slug: "road-trip" },
];

const noUsage = { userCounts: new Map<string, number>(), globalCounts: new Map<string, number>() };

describe("rankTopTagIds", () => {
  test("prefers the user's most-used tags, then top system tags", () => {
    const ranked = rankTopTagIds(
      tags,
      {
        userCounts: new Map([
          ["t-late", 9],
          ["t-sad", 3],
        ]),
        globalCounts: new Map([
          ["t-gym", 50],
          ["t-chill", 20],
          ["t-sad", 5],
        ]),
      },
      4
    );
    expect(ranked).toEqual(["t-late", "t-sad", "t-gym", "t-chill"]);
  });

  test("falls back to system tags by name without any usage, leaving unused custom tags out", () => {
    expect(rankTopTagIds(tags, noUsage, 6)).toEqual(["t-chill", "t-gym", "t-lofi", "t-sad"]);
  });
});

describe("tag ids ↔ query", () => {
  test("chips serialize to slugs joined by and", () => {
    expect(tagIdsToQuery(["t-late", "t-lofi", "missing"], tags)).toBe("late-night and lo-fi");
  });

  test("typed query wins over chips", () => {
    expect(effectiveTagQuery({ tagQuery: " sad ", tagIds: ["t-gym"] }, tags)).toBe("sad");
    expect(effectiveTagQuery({ tagQuery: "", tagIds: ["t-gym"] }, tags)).toBe("gym");
  });
});

describe("tagFilterKey", () => {
  test("chips and an equivalent AND query share a key regardless of order, case, or name vs slug", () => {
    const chips = tagFilterKey({ tagIds: ["t-lofi", "t-chill"] }, tags);
    expect(chips).not.toBeNull();
    expect(tagFilterKey({ tagQuery: "chill and lo-fi" }, tags)).toBe(chips);
    expect(tagFilterKey({ tagQuery: "LO-FI CHILL" }, tags)).toBe(chips);
    expect(tagFilterKey({ tagQuery: "(chill) and (lo-fi and chill)" }, tags)).toBe(chips);
  });

  test("operators matter", () => {
    expect(tagFilterKey({ tagQuery: "chill or lo-fi" }, tags)).not.toBe(tagFilterKey({ tagQuery: "chill and lo-fi" }, tags));
    expect(tagFilterKey({ tagQuery: "chill not sad" }, tags)).not.toBe(tagFilterKey({ tagQuery: "chill sad" }, tags));
  });

  test("normalizes OR order and double negation", () => {
    expect(tagFilterKey({ tagQuery: "(sad or gym) and not not chill" }, tags)).toBe(tagFilterKey({ tagQuery: "chill and (gym or sad)" }, tags));
  });

  test("empty, invalid, or unknown filters have no key", () => {
    expect(tagFilterKey({ tagQuery: "", tagIds: [] }, tags)).toBeNull();
    expect(tagFilterKey({ tagQuery: "chill and (" }, tags)).toBeNull();
    expect(tagFilterKey({ tagQuery: "chill and polka" }, tags)).toBeNull();
    expect(tagFilterKey({ tagIds: ["missing"] }, tags)).toBeNull();
  });
});

describe("findPlaylistMatchingTagFilter", () => {
  const playlists = [
    { id: "p1", name: "Hand picked", tagQuery: null },
    { id: "p2", name: "Night drive", tagQuery: "late-night and road-trip" },
    { id: "p3", name: "Mellow", tagQuery: "chill or lo-fi" },
  ];

  test("matches chips to a playlist query", () => {
    expect(findPlaylistMatchingTagFilter({ tagIds: ["t-road", "t-late"] }, playlists, tags)?.id).toBe("p2");
  });

  test("matches an equivalent typed query", () => {
    expect(findPlaylistMatchingTagFilter({ tagQuery: "lo-fi or chill" }, playlists, tags)?.id).toBe("p3");
  });

  test("returns null when nothing matches or no filter is set", () => {
    expect(findPlaylistMatchingTagFilter({ tagIds: ["t-late"] }, playlists, tags)).toBeNull();
    expect(findPlaylistMatchingTagFilter({}, playlists, tags)).toBeNull();
  });
});

describe("tagQueryProblem", () => {
  test("reports syntax errors and unknown tags", () => {
    expect(tagQueryProblem("", tags)).toBeNull();
    expect(tagQueryProblem("chill and late-night", tags)).toBeNull();
    expect(tagQueryProblem("chill and (", tags)).not.toBeNull();
    expect(tagQueryProblem("chill polka", tags)).toBe("Unknown tag: polka");
  });
});
