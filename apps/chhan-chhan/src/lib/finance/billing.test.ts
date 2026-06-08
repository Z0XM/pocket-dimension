import { describe, expect, test } from "bun:test";
import { buildBillingByCategory, resolveBillingMonthKey, resolveBillingYear } from "$lib/finance/billing";

describe("resolveBillingYear", () => {
  test("uses selected year in year mode", () => {
    expect(resolveBillingYear({ period: "year", year: 2024 }, [2026, 2025])).toBe(2024);
  });

  test("uses month year in month mode", () => {
    expect(resolveBillingYear({ period: "month", month: "2025-03" }, [2026])).toBe(2025);
  });
});

describe("resolveBillingMonthKey", () => {
  test("returns month key in month mode", () => {
    expect(resolveBillingMonthKey({ period: "month", month: "2025-03" })).toBe("2025-03");
  });

  test("returns null outside month mode", () => {
    expect(resolveBillingMonthKey({ period: "year", year: 2025 })).toBeNull();
  });
});

describe("buildBillingByCategory", () => {
  const rows = [
    {
      category_id: "c1",
      category_name: "Utilities",
      category_color: "#ff0000",
      merchant_name: "Netflix",
      month_key: "2026-03",
      amount_minor: 49900,
      txn_count: 1,
    },
    {
      category_id: "c1",
      category_name: "Utilities",
      category_color: "#ff0000",
      merchant_name: "Netflix",
      month_key: "2026-04",
      amount_minor: 49900,
      txn_count: 1,
    },
    {
      category_id: "c1",
      category_name: "Utilities",
      category_color: "#ff0000",
      merchant_name: "Airtel",
      month_key: "2026-03",
      amount_minor: 79900,
      txn_count: 1,
    },
    {
      category_id: null,
      category_name: "Uncategorized",
      category_color: null,
      merchant_name: "Unknown Shop",
      month_key: "2026-03",
      amount_minor: 10000,
      txn_count: 1,
    },
  ];

  test("groups merchants under categories for a month", () => {
    const report = buildBillingByCategory(rows, { monthKey: "2026-03" });
    expect(report).toHaveLength(2);
    expect(report[0].categoryName).toBe("Utilities");
    expect(report[0].merchants.map((merchant) => merchant.merchant)).toEqual(["Airtel", "Netflix"]);
    expect(report[0].merchants[0].totalMinor).toBe(79900);
  });

  test("aggregates months when no month filter is set", () => {
    const report = buildBillingByCategory(rows);
    const netflix = report[0].merchants.find((merchant) => merchant.merchant === "Netflix");
    expect(netflix?.totalMinor).toBe(99800);
    expect(netflix?.months).toHaveLength(2);
  });
});
