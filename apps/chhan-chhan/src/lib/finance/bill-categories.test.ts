import { describe, expect, test } from "bun:test";
import { filterBillCategoryRows, isBillCategoryName } from "$lib/finance/bill-categories";

describe("isBillCategoryName", () => {
  test("matches bill categories", () => {
    expect(isBillCategoryName("Monthly Bill")).toBe(true);
    expect(isBillCategoryName("Yearly Bill")).toBe(true);
    expect(isBillCategoryName("Bill")).toBe(true);
  });

  test("rejects non-bill categories", () => {
    expect(isBillCategoryName("Food")).toBe(false);
    expect(isBillCategoryName("Miscellaneous")).toBe(false);
    expect(isBillCategoryName(null)).toBe(false);
  });
});

describe("filterBillCategoryRows", () => {
  test("keeps only bill category rows", () => {
    const rows = [
      { category_name: "Monthly Bill", merchant_name: "Netflix" },
      { category_name: "Food", merchant_name: "Swiggy" },
    ];
    expect(filterBillCategoryRows(rows)).toHaveLength(1);
  });
});
