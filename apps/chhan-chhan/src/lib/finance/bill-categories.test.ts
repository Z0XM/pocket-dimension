import { describe, expect, test } from "bun:test";
import { filterBillTagRows, isBillTagName } from "$lib/finance/bill-categories";

describe("isBillTagName", () => {
  test("matches bill tags", () => {
    expect(isBillTagName("Monthly Bill")).toBe(true);
    expect(isBillTagName("Yearly Bill")).toBe(true);
    expect(isBillTagName("Bill")).toBe(true);
  });

  test("rejects non-bill tags", () => {
    expect(isBillTagName("Food")).toBe(false);
    expect(isBillTagName("Miscellaneous")).toBe(false);
    expect(isBillTagName(null)).toBe(false);
  });
});

describe("filterBillTagRows", () => {
  test("keeps only bill tag rows", () => {
    const rows = [
      { tag_name: "Monthly Bill", merchant_name: "Netflix" },
      { tag_name: "Food", merchant_name: "Swiggy" },
    ];
    expect(filterBillTagRows(rows)).toHaveLength(1);
  });
});
