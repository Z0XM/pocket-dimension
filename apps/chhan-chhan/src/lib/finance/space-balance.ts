export type SpaceBalanceTxn = {
  id: string;
  amountMinor: number;
  type: "income" | "expense" | "transfer" | string;
  occurredOn: string;
  sortOrder?: number | null;
};

/**
 * Running space balance for each transaction, computed chronologically
 * (occurredOn asc, then sortOrder, then id) — not the stored bank balance.
 * Income adds, expense subtracts; transfers are ignored for space net.
 */
export function computeSpaceRunningBalances(transactions: SpaceBalanceTxn[]): Map<string, number> {
  const chronological = [...transactions].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? -1 : 1;
    const aOrder = a.sortOrder ?? 0;
    const bOrder = b.sortOrder ?? 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const balances = new Map<string, number>();
  let running = 0;
  for (const txn of chronological) {
    if (txn.type === "income") running += txn.amountMinor;
    else if (txn.type === "expense") running -= txn.amountMinor;
    balances.set(txn.id, running);
  }
  return balances;
}
