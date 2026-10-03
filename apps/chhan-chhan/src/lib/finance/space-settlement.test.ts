import { describe, expect, test } from "bun:test";
import {
  allocatedByTransaction,
  canAllocateTransactionTypes,
  equalSplitShares,
  maxAllocationMinor,
  maxItemPaymentMinor,
  remainderMinor,
  sharesSumToAmount,
  spacePersonBalances,
  spaceRemainders,
  spaceShareOpens,
  suggestedAllocationMinor,
  totalOpenRemainderMinor,
  weightedSplitShares,
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

  test("unified txn open subtracts item payments too", () => {
    const txns = [{ id: "e1", amountMinor: 2000 }];
    const allocations = [{ id: "a1", leftTransactionId: "e1", rightTransactionId: "r1", amountMinor: 500 }];
    const payments = [{ id: "p1", itemId: "i1", transactionId: "e1", coversPersonId: "me", amountMinor: 700 }];
    const rows = spaceRemainders(txns, allocations, payments);
    expect(rows[0]?.remainderMinor).toBe(800);
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

  test("equalSplitShares distributes remainder pennies", () => {
    const shares = equalSplitShares(["a", "b", "c"], 100);
    expect(sharesSumToAmount(shares, 100)).toBe(true);
    expect(shares.map((row) => row.shareMinor).sort((x, y) => x - y)).toEqual([33, 33, 34]);
  });

  test("weightedSplitShares follows ratios and sums exactly", () => {
    const shares = weightedSplitShares(
      [
        { personId: "a", weight: 1 },
        { personId: "b", weight: 2 },
        { personId: "c", weight: 1 },
      ],
      100
    );
    expect(sharesSumToAmount(shares, 100)).toBe(true);
    expect(shares).toEqual([
      { personId: "a", shareMinor: 25 },
      { personId: "b", shareMinor: 50 },
      { personId: "c", shareMinor: 25 },
    ]);
  });

  test("weightedSplitShares skips zero weights", () => {
    const shares = weightedSplitShares(
      [
        { personId: "a", weight: 0 },
        { personId: "b", weight: 1 },
        { personId: "c", weight: 1 },
      ],
      99
    );
    expect(sharesSumToAmount(shares, 99)).toBe(true);
    expect(shares.map((row) => row.personId)).toEqual(["b", "c"]);
  });

  test("maxItemPaymentMinor caps by txn, share, and item open", () => {
    expect(maxItemPaymentMinor(500, 300, 400)).toBe(300);
    expect(maxItemPaymentMinor(100, 300, 400)).toBe(100);
    expect(maxItemPaymentMinor(500, 300, 0)).toBe(0);
  });

  test("spaceShareOpens and person balances", () => {
    const people = [
      { id: "me", name: "Me", isSelf: true },
      { id: "rahul", name: "Rahul", isSelf: false },
    ];
    const shares = [
      { itemId: "tv", personId: "me", shareMinor: 1500 },
      { itemId: "tv", personId: "rahul", shareMinor: 1500 },
    ];
    const payments = [{ id: "p1", itemId: "tv", transactionId: "e1", coversPersonId: "rahul", amountMinor: 500 }];
    const shareOpens = spaceShareOpens(shares, payments);
    expect(shareOpens.find((row) => row.personId === "rahul")?.openMinor).toBe(1000);
    expect(shareOpens.find((row) => row.personId === "me")?.openMinor).toBe(1500);

    const balances = spacePersonBalances(people, shares, payments);
    expect(balances.find((row) => row.personId === "rahul")?.openMinor).toBe(1000);
    expect(balances.find((row) => row.personId === "me")?.openMinor).toBe(1500);
  });
});
