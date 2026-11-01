import { describe, expect, test } from "bun:test";
import { computeSpaceRunningBalances } from "./space-balance";

describe("computeSpaceRunningBalances", () => {
  test("accumulates income and expense in chronological order", () => {
    const balances = computeSpaceRunningBalances([
      { id: "b", amountMinor: 500_00, type: "expense", occurredOn: "2025-02-02", sortOrder: 1 },
      { id: "a", amountMinor: 1500_00, type: "income", occurredOn: "2025-02-01", sortOrder: 1 },
      { id: "c", amountMinor: 200_00, type: "expense", occurredOn: "2025-02-02", sortOrder: 2 },
    ]);

    expect(balances.get("a")).toBe(1500_00);
    expect(balances.get("b")).toBe(1000_00);
    expect(balances.get("c")).toBe(800_00);
  });

  test("ignores transfers for the space net", () => {
    const balances = computeSpaceRunningBalances([
      { id: "a", amountMinor: 100_00, type: "income", occurredOn: "2025-01-01" },
      { id: "t", amountMinor: 40_00, type: "transfer", occurredOn: "2025-01-02" },
      { id: "b", amountMinor: 25_00, type: "expense", occurredOn: "2025-01-03" },
    ]);

    expect(balances.get("a")).toBe(100_00);
    expect(balances.get("t")).toBe(100_00);
    expect(balances.get("b")).toBe(75_00);
  });
});
