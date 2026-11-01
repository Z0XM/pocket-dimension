import { describe, expect, test } from "bun:test";
import { buildSettlementGraph, connectedIdsForNode, layoutSettlementGraph } from "./settlement-graph";

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
    expect(model.nodes).toHaveLength(4);
  });

  test("layout spreads nodes without columns", () => {
    const model = buildSettlementGraph(
      [
        { id: "in", type: "income", amountMinor: 10000_00, merchant: "Pay" },
        { id: "a", type: "expense", amountMinor: 4000_00, merchant: "A" },
        { id: "b", type: "expense", amountMinor: 6000_00, merchant: "B" },
      ],
      [
        { id: "e1", batchId: "b1", leftTransactionId: "in", rightTransactionId: "a", amountMinor: 4000_00 },
        { id: "e2", batchId: "b1", leftTransactionId: "in", rightTransactionId: "b", amountMinor: 6000_00 },
      ]
    );
    const layout = layoutSettlementGraph(model);
    expect(layout.positions.size).toBe(3);
    const coords = [...layout.positions.values()];
    const xs = coords.map((p) => p.x);
    const ys = coords.map((p) => p.y);
    // Not collapsed onto one vertical column
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(80);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(40);
  });

  test("connectedIdsForNode highlights neighbors and edges", () => {
    const model = buildSettlementGraph(
      [
        { id: "in", type: "income", amountMinor: 10000_00, merchant: "Pay" },
        { id: "a", type: "expense", amountMinor: 4000_00, merchant: "A" },
        { id: "b", type: "expense", amountMinor: 6000_00, merchant: "B" },
      ],
      [
        { id: "e1", batchId: "b1", leftTransactionId: "in", rightTransactionId: "a", amountMinor: 4000_00 },
        { id: "e2", batchId: "b1", leftTransactionId: "in", rightTransactionId: "b", amountMinor: 6000_00 },
      ]
    );
    const focus = connectedIdsForNode(model, "a");
    expect([...focus.nodeIds].sort()).toEqual(["a", "in"]);
    expect([...focus.linkIds]).toEqual(["e1"]);
  });
});
