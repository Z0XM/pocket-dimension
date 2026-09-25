import { describe, expect, test } from "bun:test";
import {
  alphanumericKey,
  clusterFingerprint,
  findDuplicateClusters,
  levenshtein,
  matchingKey,
  normalizeForMatch,
  normalizeTitle,
  parseSequelParts,
  titleSimilarity,
  titlesAreDistinctSequels,
} from "./normalize";
import { chooseRating, planRatingMerges, ratingsDisagree, type RatingSnapshot } from "./merge-ratings";

describe("normalizeTitle", () => {
  test("trims, collapses spaces, lowercases", () => {
    expect(normalizeTitle("  The  Matrix  ")).toBe("the matrix");
    expect(normalizeTitle("Inception")).toBe("inception");
  });
});

describe("alphanumericKey", () => {
  test("strips symbols and spaces", () => {
    expect(alphanumericKey("Spider-Man: No Way Home")).toBe("spidermannowayhome");
    expect(alphanumericKey("Spider Man No Way Home!")).toBe("spidermannowayhome");
    expect(alphanumericKey("  Foo & Bar #1 ")).toBe("foobar1");
  });
});

describe("matchingKey / normalizeForMatch (stop-words)", () => {
  test("ignores the/and/or and symbols", () => {
    expect(matchingKey("The Matrix")).toBe("matrix");
    expect(matchingKey("Matrix")).toBe("matrix");
    expect(matchingKey("Foo and Bar")).toBe("foobar");
    expect(matchingKey("Foo & Bar")).toBe("foobar");
    expect(matchingKey("Foo or Bar")).toBe("foobar");
    expect(normalizeForMatch("The Lord of the Rings")).toBe("lord rings");
  });

  test("clusters titles that only differ by stop-words", () => {
    const items = [
      { id: "1", title: "The Matrix", type: "movie", languageId: "l1" },
      { id: "2", title: "Matrix", type: "movie", languageId: "l1" },
      { id: "3", title: "Foo and Bar", type: "movie", languageId: "l1" },
      { id: "4", title: "Foo & Bar", type: "movie", languageId: "l1" },
    ];
    const clusters = findDuplicateClusters(items);
    const matrix = clusters.find((c) => c.members.some((m) => m.id === "1"));
    expect(matrix?.members.map((m) => m.id).sort()).toEqual(["1", "2"]);
    const foo = clusters.find((c) => c.members.some((m) => m.id === "3"));
    expect(foo?.members.map((m) => m.id).sort()).toEqual(["3", "4"]);
  });
});

describe("parseSequelParts / titlesAreDistinctSequels", () => {
  test("parses trailing numbers and part/season suffixes", () => {
    expect(parseSequelParts("ABC 1")).toEqual({ base: "abc", baseAlpha: "abc", part: 1 });
    expect(parseSequelParts("ABC 2")).toEqual({ base: "abc", baseAlpha: "abc", part: 2 });
    expect(parseSequelParts("Foo Part 2")).toEqual({ base: "foo", baseAlpha: "foo", part: 2 });
    expect(parseSequelParts("Bar Season 3")).toEqual({ base: "bar", baseAlpha: "bar", part: 3 });
    expect(parseSequelParts("Baz #4")).toEqual({ base: "baz", baseAlpha: "baz", part: 4 });
    expect(parseSequelParts("Qux II")).toEqual({ base: "qux", baseAlpha: "qux", part: 2 });
    expect(parseSequelParts("Inception").part).toBeNull();
  });

  test("ABC 1 vs ABC 2 are distinct sequels; same part is not", () => {
    expect(titlesAreDistinctSequels("ABC 1", "ABC 2")).toBe(true);
    expect(titlesAreDistinctSequels("ABC 1", "ABC 1")).toBe(false);
    expect(titlesAreDistinctSequels("ABC Part 1", "ABC Part 2")).toBe(true);
  });

  test("different series with same part are not sequels of each other", () => {
    expect(titlesAreDistinctSequels("ABC 1", "ADC 1")).toBe(false);
  });

  test("base title vs numbered sequel counts as distinct", () => {
    expect(titlesAreDistinctSequels("Alien", "Alien 2")).toBe(true);
  });
});

describe("levenshtein / titleSimilarity", () => {
  test("identical → distance 0 / similarity 1", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(titleSimilarity("Inception", "inception")).toBe(1);
  });

  test("close titles score high", () => {
    const s = titleSimilarity("The Matrix", "The Matrx");
    expect(s).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(1);
  });

  test("unrelated titles score low", () => {
    expect(titleSimilarity("Inception", "Totoro")).toBeLessThan(0.5);
  });
});

describe("clusterFingerprint", () => {
  test("order-independent", () => {
    expect(clusterFingerprint(["b", "a", "c"])).toBe(clusterFingerprint(["c", "a", "b"]));
  });
});

describe("findDuplicateClusters", () => {
  const items = [
    { id: "1", title: "Inception", type: "movie", languageId: "l1", language: "English" },
    { id: "2", title: "inception", type: "movie", languageId: "l1", language: "English" },
    { id: "3", title: "Spider-Man", type: "movie", languageId: "l1", language: "English" },
    { id: "4", title: "Spider Man", type: "movie", languageId: "l1", language: "English" },
    { id: "5", title: "The Matrix", type: "movie", languageId: "l1", language: "English" },
    { id: "6", title: "The Matrx", type: "movie", languageId: "l1", language: "English" },
    { id: "7", title: "Totoro", type: "movie", languageId: "l2", language: "Japanese" },
  ];

  test("detects direct duplicates", () => {
    const clusters = findDuplicateClusters(items);
    const direct = clusters.filter((c) => c.tier === "direct");
    expect(direct.length).toBeGreaterThanOrEqual(1);
    const inception = direct.find((c) => c.members.some((m) => m.id === "1"));
    expect(inception?.members.map((m) => m.id).sort()).toEqual(["1", "2"]);
    expect(inception?.confidence).toBe(1);
  });

  test("detects indirect alphanumeric duplicates", () => {
    const clusters = findDuplicateClusters(items);
    const indirect = clusters.filter((c) => c.tier === "indirect");
    const spider = indirect.find((c) => c.members.some((m) => m.id === "3"));
    expect(spider?.members.map((m) => m.id).sort()).toEqual(["3", "4"]);
  });

  test("detects fuzzy close matches", () => {
    const clusters = findDuplicateClusters(items, { fuzzyThreshold: 0.8 });
    const fuzzy = clusters.filter((c) => c.tier === "fuzzy");
    const matrix = fuzzy.find((c) => c.members.some((m) => m.id === "5"));
    expect(matrix).toBeTruthy();
    expect(matrix!.members.map((m) => m.id).sort()).toEqual(["5", "6"]);
    expect(matrix!.confidence).toBeGreaterThan(0.8);
    expect(matrix!.confidence).toBeLessThan(1);
  });

  test("singletons are not clustered", () => {
    const clusters = findDuplicateClusters(items);
    expect(clusters.every((c) => c.members.length >= 2)).toBe(true);
    expect(clusters.some((c) => c.members.some((m) => m.id === "7"))).toBe(false);
  });

  test("does not treat numbered parts as duplicates of each other", () => {
    const sequels = [
      { id: "a1", title: "ABC 1", type: "movie", languageId: "l1" },
      { id: "a2", title: "ABC 2", type: "movie", languageId: "l1" },
      { id: "a1b", title: "ABC 1", type: "movie", languageId: "l1" },
      { id: "d1", title: "ADC 1", type: "movie", languageId: "l1" },
      { id: "p1", title: "Show Part 1", type: "series", languageId: "l1" },
      { id: "p2", title: "Show Part 2", type: "series", languageId: "l1" },
    ];
    const clusters = findDuplicateClusters(sequels, { fuzzyThreshold: 0.7 });

    // Exact same title twice → direct duplicate
    const abc1 = clusters.find(
      (c) => c.tier === "direct" && c.members.some((m) => m.id === "a1") && c.members.some((m) => m.id === "a1b")
    );
    expect(abc1).toBeTruthy();
    expect(abc1!.members.map((m) => m.id).sort()).toEqual(["a1", "a1b"]);

    // Different parts must never share a cluster
    const hasAbc12 = clusters.some(
      (c) => c.members.some((m) => m.id === "a1" || m.id === "a1b") && c.members.some((m) => m.id === "a2")
    );
    expect(hasAbc12).toBe(false);

    const hasShowParts = clusters.some(
      (c) => c.members.some((m) => m.id === "p1") && c.members.some((m) => m.id === "p2")
    );
    expect(hasShowParts).toBe(false);

    // ADC 1 is allowed to match ABC 1 if fuzzy rules say so — not blocked as a sequel
    expect(titlesAreDistinctSequels("ABC 1", "ADC 1")).toBe(false);
  });
});

describe("merge-ratings strategies", () => {
  const base = (over: Partial<RatingSnapshot>): RatingSnapshot => ({
    id: "r0",
    watchItemId: "keep",
    userId: "u1",
    rating: "7",
    infinity: false,
    shitty: false,
    recommendation: null,
    review: "",
    progressStatus: "watched",
    droppedAtSeason: null,
    droppedAtEpisode: null,
    updatedAt: new Date("2024-01-01"),
    ...over,
  });

  test("prefer_kept picks rating on survivor", () => {
    const kept = base({ id: "a", watchItemId: "keep", rating: "5" });
    const other = base({ id: "b", watchItemId: "lose", rating: "9", updatedAt: new Date("2025-01-01") });
    expect(chooseRating([kept, other], "keep", "prefer_kept")?.id).toBe("a");
  });

  test("prefer_highest picks max rating", () => {
    const a = base({ id: "a", watchItemId: "keep", rating: "5" });
    const b = base({ id: "b", watchItemId: "lose", rating: "9" });
    expect(chooseRating([a, b], "keep", "prefer_highest")?.id).toBe("b");
  });

  test("prefer_recent picks latest updatedAt", () => {
    const a = base({ id: "a", watchItemId: "keep", rating: "9", updatedAt: new Date("2020-01-01") });
    const b = base({ id: "b", watchItemId: "lose", rating: "2", updatedAt: new Date("2025-06-01") });
    expect(chooseRating([a, b], "keep", "prefer_recent")?.id).toBe("b");
  });

  test("ratingsDisagree detects value differences", () => {
    expect(ratingsDisagree(base({ rating: "5" }), base({ rating: "8" }))).toBe(true);
    expect(ratingsDisagree(base({ rating: "5" }), base({ id: "x", rating: "5" }))).toBe(false);
  });

  test("planRatingMerges reports conflicts", () => {
    const ratings = [
      base({ id: "a", userId: "u1", watchItemId: "keep", rating: "5" }),
      base({ id: "b", userId: "u1", watchItemId: "lose", rating: "9" }),
      base({ id: "c", userId: "u2", watchItemId: "lose", rating: "6" }),
    ];
    const plan = planRatingMerges(ratings, "keep", "prefer_highest");
    expect(plan.conflictCount).toBe(1);
    expect(plan.plans.find((p) => p.userId === "u1")?.keepRating.id).toBe("b");
    expect(plan.plans.find((p) => p.userId === "u2")?.keepRating.watchItemId).toBe("lose");
  });
});
