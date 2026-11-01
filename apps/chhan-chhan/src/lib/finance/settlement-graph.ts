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

/** Build a settlement graph: edges are income→expense settlement flows; nodes are unpartitioned. */
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

  const nodes: SettlementGraphNode[] = [...involved]
    .map((id) => txnById.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.amountMinor - a.amountMinor || a.id.localeCompare(b.id))
    .map((txn) => {
      const usedMinor = usedById.get(txn.id) ?? 0;
      return {
        id: txn.id,
        label: txn.merchant?.trim() || "Txn",
        type: txn.type,
        amountMinor: txn.amountMinor,
        usedMinor,
        leftoverMinor: Math.max(0, txn.amountMinor - usedMinor),
      };
    });

  return { nodes, links };
}

export type SettlementGraphLayout = {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
};

/**
 * Spread nodes on a roomy canvas via a light force pass (no incoming/outgoing columns).
 * Deterministic for a given node/link set.
 */
export function layoutSettlementGraph(
  model: SettlementGraphModel,
  options: { width?: number; height?: number; iterations?: number } = {}
): SettlementGraphLayout {
  const n = model.nodes.length;
  const width = options.width ?? Math.max(900, 220 + n * 90);
  const height = options.height ?? Math.max(560, 200 + n * 70);
  const iterations = options.iterations ?? 80;

  if (n === 0) {
    return { width, height, positions: new Map() };
  }

  const cx = width / 2;
  const cy = height / 3;
  // Start on a wide ring so the force pass has room to breathe.
  const radius = Math.min(width, height) * 0.34;
  const positions = new Map<string, { x: number; y: number }>();
  model.nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    positions.set(node.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.85,
    });
  });

  if (n === 1) {
    positions.set(model.nodes[0]!.id, { x: cx, y: cy });
    return { width, height, positions };
  }

  const ideal = Math.max(160, Math.min(260, Math.sqrt((width * height) / Math.max(n, 1)) * 0.85));
  const margin = 70;

  for (let iter = 0; iter < iterations; iter += 1) {
    const temp = 1 - iter / iterations;
    const forces = new Map<string, { x: number; y: number }>();
    for (const node of model.nodes) forces.set(node.id, { x: 0, y: 0 });

    // Repulsion between all pairs
    for (let i = 0; i < model.nodes.length; i += 1) {
      for (let j = i + 1; j < model.nodes.length; j += 1) {
        const a = model.nodes[i]!;
        const b = model.nodes[j]!;
        const pa = positions.get(a.id)!;
        const pb = positions.get(b.id)!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const push = ((ideal * ideal) / dist) * 0.08 * temp;
        dx = (dx / dist) * push;
        dy = (dy / dist) * push;
        const fa = forces.get(a.id)!;
        const fb = forces.get(b.id)!;
        fa.x += dx;
        fa.y += dy;
        fb.x -= dx;
        fb.y -= dy;
      }
    }

    // Attraction along edges
    for (const link of model.links) {
      const pa = positions.get(link.fromId);
      const pb = positions.get(link.toId);
      if (!pa || !pb) continue;
      let dx = pb.x - pa.x;
      let dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const pull = ((dist - ideal) / dist) * 0.05 * temp;
      dx *= pull;
      dy *= pull;
      const fa = forces.get(link.fromId)!;
      const fb = forces.get(link.toId)!;
      fa.x += dx;
      fa.y += dy;
      fb.x -= dx;
      fb.y -= dy;
    }

    // Mild center gravity so the graph doesn't drift off-canvas
    for (const node of model.nodes) {
      const p = positions.get(node.id)!;
      const f = forces.get(node.id)!;
      f.x += (cx - p.x) * 0.01;
      f.y += (cy - p.y) * 0.01;
      p.x = Math.min(width - margin, Math.max(margin, p.x + f.x));
      p.y = Math.min(height - margin, Math.max(margin, p.y + f.y));
    }
  }

  return { width, height, positions };
}

export function connectedIdsForNode(model: SettlementGraphModel, nodeId: string): {
  nodeIds: Set<string>;
  linkIds: Set<string>;
} {
  const nodeIds = new Set<string>([nodeId]);
  const linkIds = new Set<string>();
  for (const link of model.links) {
    if (link.fromId === nodeId || link.toId === nodeId) {
      linkIds.add(link.id);
      nodeIds.add(link.fromId);
      nodeIds.add(link.toId);
    }
  }
  return { nodeIds, linkIds };
}
