import { describe, expect, it } from "vitest";
import { bareEpicId, bareStoryId, formatEpicId, formatStoryId } from "./formatIds";

describe("formatIds", () => {
  it("prefixes epic/story when idPrefix is set", () => {
    expect(formatEpicId({ number: 1, idPrefix: "H" })).toBe("H1");
    expect(formatStoryId({ epicNumber: 1, number: 2, idPrefix: "H" })).toBe("H1.2");
    expect(formatEpicId({ number: 1, idPrefix: "SQL" })).toBe("SQL1");
    expect(formatStoryId({ epicNumber: 1, number: 1, idPrefix: "SQL" })).toBe("SQL1.1");
  });

  it("ignores parser code when idPrefix is set", () => {
    expect(formatEpicId({ number: 1, code: "C1", idPrefix: "H" })).toBe("H1");
    expect(formatStoryId({ epicNumber: 1, number: 1, code: "C1.1", idPrefix: "H" })).toBe("H1.1");
  });

  it("falls back to code or bare number without idPrefix", () => {
    expect(formatEpicId({ number: 3 })).toBe("3");
    expect(formatEpicId({ number: 3, code: "C3" })).toBe("C3");
    expect(formatStoryId({ epicNumber: 2, number: 4 })).toBe("2.4");
    expect(formatStoryId({ epicNumber: 2, number: 4, code: "C2.4" })).toBe("C2.4");
  });

  it("exposes bare ids for search", () => {
    expect(bareEpicId({ number: 1 })).toBe("1");
    expect(bareStoryId({ epicNumber: 1, number: 2 })).toBe("1.2");
  });
});
