import { describe, expect, test } from "bun:test";
import { isFuzzyMerchantMatch, merchantSimilarity, normalizeMerchant, rankFuzzyMerchants } from "$lib/finance/merchant-match";

describe("normalizeMerchant", () => {
  test("lowercases and collapses whitespace", () => {
    expect(normalizeMerchant("  Amazon   Pay ")).toBe("amazon pay");
  });
});

describe("merchantSimilarity", () => {
  test("returns 1 for exact normalized matches", () => {
    expect(merchantSimilarity("Amazon Pay", "amazon pay")).toBe(1);
  });

  test("scores substring merchants highly", () => {
    expect(merchantSimilarity("Amazon Pay", "Amazon Pay UPI")).toBeGreaterThan(0.7);
  });
});

describe("isFuzzyMerchantMatch", () => {
  test("matches similar merchants but not exact ones", () => {
    expect(isFuzzyMerchantMatch("Amazon Pay", "Amazon Pay")).toBe(false);
    expect(isFuzzyMerchantMatch("Amazon Pay", "Amazon Pay UPI")).toBe(true);
  });
});

describe("rankFuzzyMerchants", () => {
  test("returns ranked fuzzy candidates excluding exact match", () => {
    const ranked = rankFuzzyMerchants("Amazon Pay", ["Amazon Pay", "Amazon Pay UPI", "Totally Different", "AMAZON PAY"]);

    expect(ranked).toContain("Amazon Pay UPI");
    expect(ranked).not.toContain("Amazon Pay");
    expect(ranked).not.toContain("Totally Different");
  });
});
