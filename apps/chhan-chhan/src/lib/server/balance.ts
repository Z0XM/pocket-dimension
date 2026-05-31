import type { ImportRow } from "$lib/importers/types";

export type BalanceSnapshot = {
  balanceMinor: number;
  asOf: string;
  sortOrder: number;
};

export function latestBalanceFromRows(rows: ImportRow[]): BalanceSnapshot | null {
  let latest: BalanceSnapshot | null = null;

  for (const row of rows) {
    if (row.balanceMinor == null) continue;
    const sortOrder = row.sortOrder ?? 0;

    if (!latest || row.occurredOn > latest.asOf || (row.occurredOn === latest.asOf && sortOrder >= latest.sortOrder)) {
      latest = {
        balanceMinor: row.balanceMinor,
        asOf: row.occurredOn,
        sortOrder,
      };
    }
  }

  return latest;
}

export function isBalanceSnapshotNewer(candidate: BalanceSnapshot, current: BalanceSnapshot | null): boolean {
  if (!current) return true;
  if (candidate.asOf > current.asOf) return true;
  if (candidate.asOf < current.asOf) return false;
  return candidate.sortOrder >= current.sortOrder;
}
