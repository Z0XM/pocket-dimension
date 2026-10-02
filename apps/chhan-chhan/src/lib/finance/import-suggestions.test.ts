import { describe, expect, test } from "bun:test";
import { normalizeMerchant, rankFuzzyMerchants } from "./merchant-match";

describe("import suggestion merchant matching", () => {
  test("exact normalize matches case and spacing", () => {
    expect(normalizeMerchant("  Swiggy  Foods ")).toBe("swiggy foods");
  });

  test("fuzzy ranks similar merchant names", () => {
    const ranked = rankFuzzyMerchants("SWIGGY", ["Swiggy Bangalore", "Uber", "Amazon"], 2);
    expect(ranked[0]).toBe("Swiggy Bangalore");
  });
});
