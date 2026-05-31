import { describe, expect, test } from "bun:test";
import { parseMultiFilterParam, serializeMultiFilterParam } from "$lib/finance/filter-params";

describe("parseMultiFilterParam", () => {
  test("parses comma-separated values and dedupes", () => {
    expect(parseMultiFilterParam("a,b,a")).toEqual(["a", "b"]);
  });

  test("returns empty array for missing param", () => {
    expect(parseMultiFilterParam(null)).toEqual([]);
  });
});

describe("serializeMultiFilterParam", () => {
  test("joins values", () => {
    expect(serializeMultiFilterParam(["a", "b"])).toBe("a,b");
  });
});
