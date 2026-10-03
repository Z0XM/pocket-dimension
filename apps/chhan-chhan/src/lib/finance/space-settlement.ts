export type SpaceTxnLike = {
  id: string;
  amountMinor: number;
};

export type SpaceAllocationLike = {
  id: string;
  leftTransactionId: string;
  rightTransactionId: string;
  amountMinor: number;
};

export type SpaceItemPaymentLike = {
  id: string;
  itemId: string;
  transactionId: string;
  coversPersonId: string;
  amountMinor: number;
};

export type SpaceItemShareLike = {
  itemId: string;
  personId: string;
  shareMinor: number;
};

export type SpaceItemLike = {
  id: string;
  amountMinor: number;
};

export type SpacePersonLike = {
  id: string;
  name: string;
  isSelf: boolean;
};

/** Sum of allocation amounts touching each transaction. */
export function allocatedByTransaction(allocations: SpaceAllocationLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const allocation of allocations) {
    map.set(allocation.leftTransactionId, (map.get(allocation.leftTransactionId) ?? 0) + allocation.amountMinor);
    map.set(allocation.rightTransactionId, (map.get(allocation.rightTransactionId) ?? 0) + allocation.amountMinor);
  }
  return map;
}

/** Sum of item-payment amounts per transaction. */
export function itemPaidByTransaction(payments: SpaceItemPaymentLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const payment of payments) {
    map.set(payment.transactionId, (map.get(payment.transactionId) ?? 0) + payment.amountMinor);
  }
  return map;
}

/** Unmatched remainder for a txn: max(0, amount − allocated). */
export function remainderMinor(amountMinor: number, allocatedMinor: number): number {
  return Math.max(0, amountMinor - allocatedMinor);
}

/**
 * Unified txn open: amount − txn↔txn allocated − item-payment allocated.
 */
export function spaceRemainders(transactions: SpaceTxnLike[], allocations: SpaceAllocationLike[], itemPayments: SpaceItemPaymentLike[] = []) {
  const allocated = allocatedByTransaction(allocations);
  const itemPaid = itemPaidByTransaction(itemPayments);
  return transactions.map((txn) => {
    const allocatedMinor = (allocated.get(txn.id) ?? 0) + (itemPaid.get(txn.id) ?? 0);
    return {
      transactionId: txn.id,
      amountMinor: txn.amountMinor,
      allocatedMinor,
      remainderMinor: remainderMinor(txn.amountMinor, allocatedMinor),
    };
  });
}

export function totalOpenRemainderMinor(
  transactions: SpaceTxnLike[],
  allocations: SpaceAllocationLike[],
  itemPayments: SpaceItemPaymentLike[] = []
): number {
  return spaceRemainders(transactions, allocations, itemPayments).reduce((sum, row) => sum + row.remainderMinor, 0);
}

export function suggestedAllocationMinor(leftRemainderMinor: number, rightRemainderMinor: number): number {
  return maxAllocationMinor(leftRemainderMinor, rightRemainderMinor);
}

/** Hard cap for a new edge: cannot exceed either side's open remainder. */
export function maxAllocationMinor(leftRemainderMinor: number, rightRemainderMinor: number): number {
  return Math.max(0, Math.min(leftRemainderMinor, rightRemainderMinor));
}

/** Sum of open remainders (used as multi-settlement ceiling). */
export function sumOpenMinor(opens: Array<{ openMinor: number }>): number {
  return opens.reduce((sum, row) => sum + Math.max(0, row.openMinor), 0);
}

export type SettlementSideOpen = {
  id: string;
  openMinor: number;
};

export type PlannedSettlementEdge = {
  leftTransactionId: string;
  rightTransactionId: string;
  amountMinor: number;
};

/**
 * Greedily pair selected incoming (income) opens with outgoing (expense) opens up to `amountMinor`.
 * `left` is always income id, `right` always expense id. Returns [] if nothing can be settled.
 */
export function planMultiSettlement(incomings: SettlementSideOpen[], outgoings: SettlementSideOpen[], amountMinor: number): PlannedSettlementEdge[] {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return [];

  const incomeLeft = incomings.filter((row) => row.openMinor > 0).map((row) => ({ id: row.id, openMinor: row.openMinor }));
  const expenseLeft = outgoings.filter((row) => row.openMinor > 0).map((row) => ({ id: row.id, openMinor: row.openMinor }));

  const maxPossible = Math.min(sumOpenMinor(incomeLeft), sumOpenMinor(expenseLeft));
  let remaining = Math.min(amountMinor, maxPossible);
  const edges: PlannedSettlementEdge[] = [];

  let i = 0;
  let j = 0;
  while (remaining > 0 && i < incomeLeft.length && j < expenseLeft.length) {
    const income = incomeLeft[i]!;
    const expense = expenseLeft[j]!;
    if (income.openMinor <= 0) {
      i += 1;
      continue;
    }
    if (expense.openMinor <= 0) {
      j += 1;
      continue;
    }
    const chunk = Math.min(income.openMinor, expense.openMinor, remaining);
    if (chunk <= 0) break;
    edges.push({
      leftTransactionId: income.id,
      rightTransactionId: expense.id,
      amountMinor: chunk,
    });
    income.openMinor -= chunk;
    expense.openMinor -= chunk;
    remaining -= chunk;
  }

  return edges;
}

export type SettlementBatchAllocationLike = {
  id: string;
  batchId: string;
  leftTransactionId: string;
  rightTransactionId: string;
  amountMinor: number;
  createdAt?: Date | string | null;
};

export type SettlementBatchView = {
  batchId: string;
  allocationIds: string[];
  leftTransactionIds: string[];
  rightTransactionIds: string[];
  amountMinor: number;
  createdAt: Date | string | null;
};

/** Collapse pairwise allocation edges into one row per settlement batch. */
export function groupSettlementBatches(allocations: SettlementBatchAllocationLike[]): SettlementBatchView[] {
  const order: string[] = [];
  const byBatch = new Map<string, SettlementBatchAllocationLike[]>();

  for (const row of allocations) {
    const key = row.batchId || row.id;
    if (!byBatch.has(key)) {
      byBatch.set(key, []);
      order.push(key);
    }
    byBatch.get(key)!.push(row);
  }

  return order.map((batchId) => {
    const rows = byBatch.get(batchId)!;
    const leftTransactionIds: string[] = [];
    const rightTransactionIds: string[] = [];
    for (const row of rows) {
      if (!leftTransactionIds.includes(row.leftTransactionId)) leftTransactionIds.push(row.leftTransactionId);
      if (!rightTransactionIds.includes(row.rightTransactionId)) rightTransactionIds.push(row.rightTransactionId);
    }
    return {
      batchId,
      allocationIds: rows.map((row) => row.id),
      leftTransactionIds,
      rightTransactionIds,
      amountMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0),
      createdAt: rows[0]?.createdAt ?? null,
    };
  });
}

export type SettlementBatchMembersLike = {
  id: string;
  amountMinor: number;
  incomingTransactionIds: string[];
  outgoingTransactionIds: string[];
};

export type SpaceTxnSettlementGroup = {
  id: string;
  amountMinor: number;
  incomingTransactionIds: string[];
  outgoingTransactionIds: string[];
  transactionIds: string[];
};

/** Group space txns under settlement batches; leftovers are ungrouped. */
export function groupSpaceTransactionsBySettlements(
  transactionIds: string[],
  batches: SettlementBatchMembersLike[]
): { groups: SpaceTxnSettlementGroup[]; ungroupedIds: string[] } {
  const txnSet = new Set(transactionIds);
  const claimed = new Set<string>();
  const groups: SpaceTxnSettlementGroup[] = [];

  for (const batch of batches) {
    const ordered: string[] = [];
    for (const id of [...batch.incomingTransactionIds, ...batch.outgoingTransactionIds]) {
      if (!txnSet.has(id) || ordered.includes(id)) continue;
      ordered.push(id);
      claimed.add(id);
    }
    if (ordered.length === 0) continue;
    groups.push({
      id: batch.id,
      amountMinor: batch.amountMinor,
      incomingTransactionIds: batch.incomingTransactionIds.filter((id) => txnSet.has(id)),
      outgoingTransactionIds: batch.outgoingTransactionIds.filter((id) => txnSet.has(id)),
      transactionIds: ordered,
    });
  }

  return {
    groups,
    ungroupedIds: transactionIds.filter((id) => !claimed.has(id)),
  };
}

export type SpaceTxnEventGroup = {
  id: string;
  name: string;
  amountMinor: number;
  paidMinor: number;
  transactionIds: string[];
};

/** Group space txns under events via item payments; leftovers are ungrouped. */
export function groupSpaceTransactionsByEvents(
  transactionIds: string[],
  items: Array<{ id: string; name: string; amountMinor: number }>,
  payments: Array<{ itemId: string; transactionId: string; amountMinor: number }>
): { groups: SpaceTxnEventGroup[]; ungroupedIds: string[] } {
  const txnSet = new Set(transactionIds);
  const claimed = new Set<string>();
  const groups: SpaceTxnEventGroup[] = [];

  for (const item of items) {
    const ordered: string[] = [];
    let paidMinor = 0;
    for (const payment of payments) {
      if (payment.itemId !== item.id) continue;
      if (!txnSet.has(payment.transactionId)) continue;
      paidMinor += payment.amountMinor;
      if (!ordered.includes(payment.transactionId)) {
        ordered.push(payment.transactionId);
        claimed.add(payment.transactionId);
      }
    }
    if (ordered.length === 0) continue;
    groups.push({
      id: item.id,
      name: item.name,
      amountMinor: item.amountMinor,
      paidMinor,
      transactionIds: ordered,
    });
  }

  return {
    groups,
    ungroupedIds: transactionIds.filter((id) => !claimed.has(id)),
  };
}

export type AllocatableTxnType = "expense" | "income" | "transfer";

/**
 * Allocations settle money across directions: one incoming (income) with one outgoing (expense).
 * Same-direction and transfers are not allocatable pairs.
 */
export function canAllocateTransactionTypes(leftType: AllocatableTxnType, rightType: AllocatableTxnType): boolean {
  return (leftType === "income" && rightType === "expense") || (leftType === "expense" && rightType === "income");
}

export function coveredByShare(payments: SpaceItemPaymentLike[], itemId: string, personId: string): number {
  let sum = 0;
  for (const payment of payments) {
    if (payment.itemId === itemId && payment.coversPersonId === personId) sum += payment.amountMinor;
  }
  return sum;
}

export function coveredByItem(payments: SpaceItemPaymentLike[], itemId: string): number {
  let sum = 0;
  for (const payment of payments) {
    if (payment.itemId === itemId) sum += payment.amountMinor;
  }
  return sum;
}

export function shareOpenMinor(shareMinor: number, coveredMinor: number): number {
  return Math.max(0, shareMinor - coveredMinor);
}

export function itemOpenMinor(amountMinor: number, coveredMinor: number): number {
  return Math.max(0, amountMinor - coveredMinor);
}

/** Cap for applying bank money to a person's share on an item. */
export function maxItemPaymentMinor(txnOpenMinor: number, shareOpen: number, itemOpen: number): number {
  return Math.max(0, Math.min(txnOpenMinor, shareOpen, itemOpen));
}

export function equalSplitShares(personIds: string[], totalMinor: number): Array<{ personId: string; shareMinor: number }> {
  return weightedSplitShares(
    personIds.map((personId) => ({ personId, weight: 1 })),
    totalMinor
  );
}

/**
 * Split `totalMinor` by positive integer weights (largest-remainder so the pennies sum exactly).
 * Zero/negative weights are skipped. Returns [] if nothing to split.
 */
export function weightedSplitShares(
  weights: Array<{ personId: string; weight: number }>,
  totalMinor: number
): Array<{ personId: string; shareMinor: number }> {
  if (totalMinor < 0) return [];
  const positive = weights.filter((row) => Number.isFinite(row.weight) && row.weight > 0);
  if (positive.length === 0) return [];

  const weightSum = positive.reduce((sum, row) => sum + row.weight, 0);
  const rows = positive.map((row, index) => {
    const exact = (totalMinor * row.weight) / weightSum;
    const floor = Math.floor(exact);
    return { personId: row.personId, shareMinor: floor, frac: exact - floor, index };
  });

  let remainder = totalMinor - rows.reduce((sum, row) => sum + row.shareMinor, 0);
  const byFrac = [...rows].sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let i = 0; i < byFrac.length && remainder > 0; i++) {
    byFrac[i]!.shareMinor += 1;
    remainder -= 1;
  }

  return rows.sort((a, b) => a.index - b.index).map(({ personId, shareMinor }) => ({ personId, shareMinor }));
}

export function sharesSumToAmount(shares: Array<{ shareMinor: number }>, amountMinor: number): boolean {
  return shares.reduce((sum, row) => sum + row.shareMinor, 0) === amountMinor;
}

export function spaceShareOpens(shares: SpaceItemShareLike[], payments: SpaceItemPaymentLike[]) {
  return shares.map((share) => {
    const coveredMinor = coveredByShare(payments, share.itemId, share.personId);
    return {
      itemId: share.itemId,
      personId: share.personId,
      shareMinor: share.shareMinor,
      coveredMinor,
      openMinor: shareOpenMinor(share.shareMinor, coveredMinor),
    };
  });
}

export function spaceItemOpens(items: SpaceItemLike[], payments: SpaceItemPaymentLike[]) {
  return items.map((item) => {
    const coveredMinor = coveredByItem(payments, item.id);
    return {
      itemId: item.id,
      amountMinor: item.amountMinor,
      coveredMinor,
      openMinor: itemOpenMinor(item.amountMinor, coveredMinor),
    };
  });
}

/** Person open = sum of their share opens across items (still owed toward shares). */
export function spacePersonBalances(people: SpacePersonLike[], shares: SpaceItemShareLike[], payments: SpaceItemPaymentLike[]) {
  const shareOpens = spaceShareOpens(shares, payments);
  return people.map((person) => {
    const openMinor = shareOpens.filter((row) => row.personId === person.id).reduce((sum, row) => sum + row.openMinor, 0);
    const shareTotalMinor = shares.filter((row) => row.personId === person.id).reduce((sum, row) => sum + row.shareMinor, 0);
    const coveredMinor = shareTotalMinor - openMinor;
    return {
      personId: person.id,
      name: person.name,
      isSelf: person.isSelf,
      shareTotalMinor,
      coveredMinor,
      openMinor,
    };
  });
}
