import { describe, expect, test } from "bun:test";
import {
  allocatedByTransaction,
  canAllocateTransactionTypes,
  equalSplitShares,
  maxAllocationMinor,
  maxItemPaymentMinor,
  planMultiSettlement,
  groupSettlementBatches,
  groupSpaceTransactionsByEvents,
  groupSpaceTransactionsBySettlements,
  leftoverOpensAfterSettlement,
  planSettlementPockets,
  remainderMinor,
  sharesSumToAmount,
  spacePersonBalances,
  spaceRemainders,
  spaceShareOpens,
  suggestedAllocationMinor,
  sumOpenMinor,
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

  test("planMultiSettlement pairs many income↔expense opens up to amount", () => {
    const edges = planMultiSettlement(
      [
        { id: "in1", openMinor: 300 },
        { id: "in2", openMinor: 200 },
      ],
      [
        { id: "out1", openMinor: 250 },
        { id: "out2", openMinor: 400 },
      ],
      450
    );
    expect(edges.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(450);
    expect(edges).toEqual([
      { leftTransactionId: "in1", rightTransactionId: "out1", amountMinor: 250 },
      { leftTransactionId: "in1", rightTransactionId: "out2", amountMinor: 50 },
      { leftTransactionId: "in2", rightTransactionId: "out2", amountMinor: 150 },
    ]);
    expect(sumOpenMinor([{ openMinor: 300 }, { openMinor: 200 }])).toBe(500);
  });

  test("planMultiSettlement caps by the thinner side", () => {
    const edges = planMultiSettlement([{ id: "in1", openMinor: 100 }], [{ id: "out1", openMinor: 50 }], 1000);
    expect(edges).toEqual([{ leftTransactionId: "in1", rightTransactionId: "out1", amountMinor: 50 }]);
  });

  test("groupSettlementBatches collapses multi edges into one row", () => {
    const groups = groupSettlementBatches([
      {
        id: "a1",
        batchId: "b1",
        leftTransactionId: "in1",
        rightTransactionId: "out1",
        amountMinor: 250,
      },
      {
        id: "a2",
        batchId: "b1",
        leftTransactionId: "in1",
        rightTransactionId: "out2",
        amountMinor: 50,
      },
      {
        id: "a3",
        batchId: "b1",
        leftTransactionId: "in2",
        rightTransactionId: "out2",
        amountMinor: 150,
      },
      {
        id: "a4",
        batchId: "b2",
        leftTransactionId: "in3",
        rightTransactionId: "out3",
        amountMinor: 10,
      },
    ]);
    expect(groups).toEqual([
      {
        batchId: "b1",
        allocationIds: ["a1", "a2", "a3"],
        leftTransactionIds: ["in1", "in2"],
        rightTransactionIds: ["out1", "out2"],
        amountMinor: 450,
        createdAt: null,
      },
      {
        batchId: "b2",
        allocationIds: ["a4"],
        leftTransactionIds: ["in3"],
        rightTransactionIds: ["out3"],
        amountMinor: 10,
        createdAt: null,
      },
    ]);
  });

  test("groupSpaceTransactionsBySettlements keeps full selection and leftovers", () => {
    const result = groupSpaceTransactionsBySettlements(
      ["in1", "out1", "out2", "out3", "lonely"],
      [
        {
          id: "b1",
          amountMinor: 401,
          incomingTransactionIds: ["in1"],
          outgoingTransactionIds: ["out1", "out2", "out3"],
        },
      ]
    );
    expect(result.groups).toEqual([
      {
        id: "b1",
        amountMinor: 401,
        incomingTransactionIds: ["in1"],
        outgoingTransactionIds: ["out1", "out2", "out3"],
        transactionIds: ["in1", "out1", "out2", "out3"],
      },
    ]);
    expect(result.ungroupedIds).toEqual(["lonely"]);
  });

  test("groupSpaceTransactionsByEvents groups payers under items", () => {
    const result = groupSpaceTransactionsByEvents(
      ["t1", "t2", "t3"],
      [
        { id: "i1", name: "Rent", amountMinor: 1000 },
        { id: "i2", name: "Groceries", amountMinor: 500 },
      ],
      [
        { itemId: "i1", transactionId: "t1", amountMinor: 400 },
        { itemId: "i1", transactionId: "t2", amountMinor: 200 },
        { itemId: "i2", transactionId: "t2", amountMinor: 100 },
      ]
    );
    expect(result.groups).toEqual([
      { id: "i1", name: "Rent", amountMinor: 1000, paidMinor: 600, transactionIds: ["t1", "t2"] },
      { id: "i2", name: "Groceries", amountMinor: 500, paidMinor: 100, transactionIds: ["t2"] },
    ]);
    expect(result.ungroupedIds).toEqual(["t3"]);
  });

  test("leftoverOpensAfterSettlement and planSettlementPockets close expense remainder as out of pocket", () => {
    const leftover = leftoverOpensAfterSettlement(
      [{ id: "in1", openMinor: 1_000_000 }],
      [{ id: "out1", openMinor: 1_500_000 }],
      [{ leftTransactionId: "in1", rightTransactionId: "out1", amountMinor: 1_000_000 }]
    );
    expect(leftover.incomingLeftoverMinor).toBe(0);
    expect(leftover.outgoingLeftoverMinor).toBe(500_000);
    expect(planSettlementPockets(leftover, { markOutPocket: true })).toEqual([{ transactionId: "out1", kind: "out_pocket", amountMinor: 500_000 }]);
  });

  test("spaceRemainders subtracts pocketed leftovers", () => {
    const rows = spaceRemainders(
      [{ id: "out1", amountMinor: 1_500_000 }],
      [{ id: "a1", leftTransactionId: "in1", rightTransactionId: "out1", amountMinor: 1_000_000 }],
      [],
      [{ transactionId: "out1", amountMinor: 500_000, kind: "out_pocket" }]
    );
    expect(rows[0]?.remainderMinor).toBe(0);
  });
});
