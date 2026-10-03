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
