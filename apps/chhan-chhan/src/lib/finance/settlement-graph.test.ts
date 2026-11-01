import { describe, expect, test } from "bun:test";
import { buildSettlementGraph } from "./settlement-graph";

describe("buildSettlementGraph", () => {
  test("one income can fan out to multiple expenses with leftovers", () => {
    const model = buildSettlementGraph(
      [
        { id: "in", type: "income", amountMinor: 15000_00, merchant: "Refund" },
        { id: "a", type: "expense", amountMinor: 5000_00, merchant: "Rent share" },
        { id: "b", type: "expense", amountMinor: 2000_00, merchant: "Snacks" },
        { id: "c", type: "expense", amountMinor: 3000_00, merchant: "Cab" },
      ],
      [
        { id: "e1", batchId: "b1", leftTransactionId: "in", rightTransactionId: "a", amountMinor: 5000_00 },
        { id: "e2", batchId: "b1", leftTransactionId: "in", rightTransactionId: "b", amountMinor: 2000_00 },
        { id: "e3", batchId: "b1", leftTransactionId: "in", rightTransactionId: "c", amountMinor: 3000_00 },
      ]
    );

    expect(model.links).toHaveLength(3);
    const income = model.nodes.find((n) => n.id === "in");
    expect(income?.usedMinor).toBe(10000_00);
    expect(income?.leftoverMinor).toBe(5000_00);
    expect(model.nodes.filter((n) => n.column === 1)).toHaveLength(3);
  });
});
