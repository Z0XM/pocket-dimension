import { describe, expect, test } from "bun:test";
import {
  allocatedByTransaction,
  canAllocateTransactionTypes,
  maxAllocationMinor,
  remainderMinor,
  spaceRemainders,
  suggestedAllocationMinor,
  totalOpenRemainderMinor,
} from "./space-settlement";

describe("space-settlement", () => {
  test("allocatedByTransaction sums both sides", () => {
    const map = allocatedByTransaction([
      { id: "a1", leftTransactionId: "e1", rightTransactionId: "r1", amountMinor: 500 },
      { id: "a2", leftTransactionId: "e1", rightTransactionId: "r2", amountMinor: 300 },
    ]);
    expect(map.get("e1")).toBe(800);
    expect(map.get("r1")).toBe(500);
    expect(map.get("r2")).toBe(300);
  });

  test("remainderMinor never goes negative", () => {
    expect(remainderMinor(1000, 400)).toBe(600);
    expect(remainderMinor(1000, 1000)).toBe(0);
    expect(remainderMinor(1000, 1200)).toBe(0);
  });

  test("spaceRemainders and open total", () => {
    const txns = [
      { id: "e1", amountMinor: 2000 },
      { id: "r1", amountMinor: 1000 },
    ];
    const allocations = [{ id: "a1", leftTransactionId: "e1", rightTransactionId: "r1", amountMinor: 1000 }];
    const rows = spaceRemainders(txns, allocations);
    expect(rows.find((row) => row.transactionId === "e1")?.remainderMinor).toBe(1000);
    expect(rows.find((row) => row.transactionId === "r1")?.remainderMinor).toBe(0);
    expect(totalOpenRemainderMinor(txns, allocations)).toBe(1000);
  });

  test("suggestedAllocationMinor / maxAllocationMinor use the smaller remainder", () => {
    expect(suggestedAllocationMinor(800, 500)).toBe(500);
    expect(maxAllocationMinor(800, 500)).toBe(500);
    expect(suggestedAllocationMinor(0, 500)).toBe(0);
  });

  test("canAllocateTransactionTypes requires opposite directions", () => {
    expect(canAllocateTransactionTypes("income", "expense")).toBe(true);
    expect(canAllocateTransactionTypes("expense", "income")).toBe(true);
    expect(canAllocateTransactionTypes("expense", "expense")).toBe(false);
    expect(canAllocateTransactionTypes("income", "income")).toBe(false);
    expect(canAllocateTransactionTypes("transfer", "expense")).toBe(false);
    expect(canAllocateTransactionTypes("income", "transfer")).toBe(false);
  });
});
