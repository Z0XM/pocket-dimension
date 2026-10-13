import { describe, expect, test } from "bun:test";
import { pickAutoPlayTrack, scoreAutoPlayCandidate, type AutoPlayCandidate } from "./autoplay";

const base = (over: Partial<AutoPlayCandidate> & { id: string }): AutoPlayCandidate => ({
  title: over.id,
  tagIds: [],
  msSinceLastPlay: Infinity,
  addedByOther: false,
  ...over,
});

describe("autoplay scoring", () => {
  test("excludes assets already in seed.exclude", () => {
    const c = base({ id: "a1", tagIds: ["love"] });
    expect(scoreAutoPlayCandidate(c, { seedTagIds: ["love"], excludeAssetIds: new Set(["a1"]) })).toBe(Number.NEGATIVE_INFINITY);
  });

  test("prefers shared tags over unrelated", () => {
    const seed = { seedTagIds: ["love", "soft"], excludeAssetIds: new Set<string>() };
    const shared = scoreAutoPlayCandidate(base({ id: "a", tagIds: ["love"] }), seed);
    const none = scoreAutoPlayCandidate(base({ id: "b", tagIds: ["rap"] }), seed);
    expect(shared).toBeGreaterThan(none);
  });

  test("pickAutoPlayTrack returns highest score", () => {
    const seed = { seedTagIds: ["love"], excludeAssetIds: new Set(["x"]) };
    const pick = pickAutoPlayTrack(
      [base({ id: "x", tagIds: ["love"] }), base({ id: "y", tagIds: ["love", "soft"] }), base({ id: "z", tagIds: [] })],
      seed
    );
    expect(pick?.id).toBe("y");
  });
});
