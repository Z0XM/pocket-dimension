export type SettlementGraphTxn = {
  id: string;
  type: "income" | "expense" | "transfer" | string;
  amountMinor: number;
  merchant: string | null;
};

export type SettlementGraphEdge = {
  id: string;
  batchId: string;
  leftTransactionId: string;
  rightTransactionId: string;
  amountMinor: number;
};

export type SettlementGraphNode = {
  id: string;
  label: string;
  type: string;
  amountMinor: number;
  usedMinor: number;
  leftoverMinor: number;
  /** 0 = incoming column, 1 = outgoing column */
  column: 0 | 1;
  row: number;
};

export type SettlementGraphLink = {
  id: string;
  batchId: string;
  fromId: string;
  toId: string;
  amountMinor: number;
};

export type SettlementGraphModel = {
  nodes: SettlementGraphNode[];
  links: SettlementGraphLink[];
};

/** Build a bipartite settlement graph: income (left) → expense (right) with used/leftover per node. */
export function buildSettlementGraph(
  transactions: SettlementGraphTxn[],
  edges: SettlementGraphEdge[]
): SettlementGraphModel {
  const txnById = new Map(transactions.map((txn) => [txn.id, txn]));
  const usedById = new Map<string, number>();
  const links: SettlementGraphLink[] = [];

  for (const edge of edges) {
    const left = txnById.get(edge.leftTransactionId);
    const right = txnById.get(edge.rightTransactionId);
    if (!left || !right) continue;

    const incomeId = left.type === "income" ? left.id : right.type === "income" ? right.id : left.id;
    const expenseId = left.type === "expense" ? left.id : right.type === "expense" ? right.id : right.id;
    if (incomeId === expenseId) continue;

    usedById.set(incomeId, (usedById.get(incomeId) ?? 0) + edge.amountMinor);
    usedById.set(expenseId, (usedById.get(expenseId) ?? 0) + edge.amountMinor);
    links.push({
      id: edge.id,
      batchId: edge.batchId,
      fromId: incomeId,
      toId: expenseId,
      amountMinor: edge.amountMinor,
    });
  }

  const involved = new Set<string>();
  for (const link of links) {
    involved.add(link.fromId);
    involved.add(link.toId);
  }

  const incoming = [...involved]
    .map((id) => txnById.get(id)!)
    .filter((txn) => txn.type === "income")
    .sort((a, b) => b.amountMinor - a.amountMinor);
  const outgoing = [...involved]
    .map((id) => txnById.get(id)!)
    .filter((txn) => txn.type === "expense")
    .sort((a, b) => b.amountMinor - a.amountMinor);

  const nodes: SettlementGraphNode[] = [
    ...incoming.map((txn, row) => {
      const usedMinor = usedById.get(txn.id) ?? 0;
      return {
        id: txn.id,
        label: txn.merchant?.trim() || "Txn",
        type: txn.type,
        amountMinor: txn.amountMinor,
        usedMinor,
        leftoverMinor: Math.max(0, txn.amountMinor - usedMinor),
        column: 0 as const,
        row,
      };
    }),
    ...outgoing.map((txn, row) => {
      const usedMinor = usedById.get(txn.id) ?? 0;
      return {
        id: txn.id,
        label: txn.merchant?.trim() || "Txn",
        type: txn.type,
        amountMinor: txn.amountMinor,
        usedMinor,
        leftoverMinor: Math.max(0, txn.amountMinor - usedMinor),
        column: 1 as const,
        row,
      };
    }),
  ];

  return { nodes, links };
}

export type SettlementGraphLayout = {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
};

export function layoutSettlementGraph(model: SettlementGraphModel, options: { width?: number; rowGap?: number } = {}): SettlementGraphLayout {
  const width = options.width ?? 640;
  const rowGap = options.rowGap ?? 72;
  const leftX = 110;
  const rightX = width - 110;
  const top = 48;
  const maxRows = Math.max(
    1,
    ...model.nodes.filter((n) => n.column === 0).map((n) => n.row + 1),
    ...model.nodes.filter((n) => n.column === 1).map((n) => n.row + 1)
  );
  const height = Math.max(220, top * 2 + (maxRows - 1) * rowGap + 40);
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of model.nodes) {
    positions.set(node.id, {
      x: node.column === 0 ? leftX : rightX,
      y: top + node.row * rowGap,
    });
  }
  return { width, height, positions };
}
