import { describe, expect, test } from "bun:test";
import { extractAmountDigitPattern, parseAmountSearchTerm, transactionSearchMatchesAmount } from "$lib/finance/transaction-search";

describe("parseAmountSearchTerm", () => {
  test("parses plain major amounts", () => {
    expect(parseAmountSearchTerm("1234")).toBe(123_400);
    expect(parseAmountSearchTerm("1234.56")).toBe(123_456);
    expect(parseAmountSearchTerm("₹1,234.56")).toBe(123_456);
  });

  test("returns null for non-amount text", () => {
    expect(parseAmountSearchTerm("amazon")).toBeNull();
    expect(parseAmountSearchTerm("")).toBeNull();
  });
});

describe("extractAmountDigitPattern", () => {
  test("extracts at least two digits", () => {
    expect(extractAmountDigitPattern("1234.56")).toBe("123456");
    expect(extractAmountDigitPattern("5")).toBeNull();
  });
});

describe("transactionSearchMatchesAmount", () => {
  test("matches exact parsed amounts", () => {
    expect(transactionSearchMatchesAmount(123_456, "1234.56")).toBe(true);
    expect(transactionSearchMatchesAmount(123_400, "1234")).toBe(true);
  });

  test("matches digit substrings in minor units", () => {
    expect(transactionSearchMatchesAmount(123_456, "345")).toBe(true);
    expect(transactionSearchMatchesAmount(50_000, "500")).toBe(true);
  });

  test("does not match unrelated amounts", () => {
    expect(transactionSearchMatchesAmount(100_000, "amazon")).toBe(false);
  });
});
