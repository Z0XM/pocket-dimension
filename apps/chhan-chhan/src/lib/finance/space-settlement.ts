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

/** Sum of allocation amounts touching each transaction. */
export function allocatedByTransaction(allocations: SpaceAllocationLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const allocation of allocations) {
    map.set(allocation.leftTransactionId, (map.get(allocation.leftTransactionId) ?? 0) + allocation.amountMinor);
    map.set(allocation.rightTransactionId, (map.get(allocation.rightTransactionId) ?? 0) + allocation.amountMinor);
  }
  return map;
}

/** Unmatched remainder for a txn: max(0, amount − allocated). */
export function remainderMinor(amountMinor: number, allocatedMinor: number): number {
  return Math.max(0, amountMinor - allocatedMinor);
}

export function spaceRemainders(transactions: SpaceTxnLike[], allocations: SpaceAllocationLike[]) {
  const allocated = allocatedByTransaction(allocations);
  return transactions.map((txn) => {
    const allocatedMinor = allocated.get(txn.id) ?? 0;
    return {
      transactionId: txn.id,
      amountMinor: txn.amountMinor,
      allocatedMinor,
      remainderMinor: remainderMinor(txn.amountMinor, allocatedMinor),
    };
  });
}

export function totalOpenRemainderMinor(transactions: SpaceTxnLike[], allocations: SpaceAllocationLike[]): number {
  return spaceRemainders(transactions, allocations).reduce((sum, row) => sum + row.remainderMinor, 0);
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
