import { meterColor } from "$lib/finance/dashboard-widgets";
import type { SummarySelection } from "$lib/finance/summary";

export type TagMerchantBillRow = {
  tag_id: string | null;
  tag_name: string;
  tag_color: string | null;
  merchant_name: string;
  month_key: string;
  amount_minor: number;
  txn_count: number;
};

export type BillingMonthAmount = {
  monthKey: string;
  amountMinor: number;
  txnCount: number;
};

export type BillingMerchantRow = {
  merchant: string;
  totalMinor: number;
  txnCount: number;
  months: BillingMonthAmount[];
};

export type BillingTagGroup = {
  tagId: string | null;
  tagName: string;
  tagColor: string;
  totalMinor: number;
  merchants: BillingMerchantRow[];
};

export function resolveBillingYear(selection: SummarySelection, availableYears: number[]): number {
  if (selection.period === "year" && selection.year != null) return selection.year;
  if (selection.period === "month" && selection.month) return Number(selection.month.slice(0, 4));
  return availableYears[0] ?? new Date().getFullYear();
}

export function resolveBillingMonthKey(selection: SummarySelection): string | null {
  if (selection.period === "month" && selection.month) return selection.month;
  return null;
}

function tagKey(tagId: string | null, tagName: string): string {
  return tagId ?? `name:${tagName}`;
}

export function buildBillingByTag(rows: TagMerchantBillRow[], options: { monthKey?: string | null } = {}): BillingTagGroup[] {
  const monthKey = options.monthKey ?? null;
  const filtered = monthKey ? rows.filter((row) => row.month_key === monthKey) : rows;

  const tags = new Map<
    string,
    {
      tagId: string | null;
      tagName: string;
      tagColor: string | null;
      merchants: Map<
        string,
        {
          totalMinor: number;
          txnCount: number;
          months: Map<string, BillingMonthAmount>;
        }
      >;
    }
  >();

  for (const row of filtered) {
    const key = tagKey(row.tag_id, row.tag_name);
    const tag =
      tags.get(key) ??
      (() => {
        const entry = {
          tagId: row.tag_id,
          tagName: row.tag_name,
          tagColor: row.tag_color,
          merchants: new Map(),
        };
        tags.set(key, entry);
        return entry;
      })();

    const amountMinor = Number(row.amount_minor);
    const txnCount = Number(row.txn_count);
    const merchant =
      tag.merchants.get(row.merchant_name) ??
      (() => {
        const entry = {
          totalMinor: 0,
          txnCount: 0,
          months: new Map<string, BillingMonthAmount>(),
        };
        tag.merchants.set(row.merchant_name, entry);
        return entry;
      })();

    merchant.totalMinor += amountMinor;
    merchant.txnCount += txnCount;

    const monthEntry = merchant.months.get(row.month_key) ?? {
      monthKey: row.month_key,
      amountMinor: 0,
      txnCount: 0,
    };
    monthEntry.amountMinor += amountMinor;
    monthEntry.txnCount += txnCount;
    merchant.months.set(row.month_key, monthEntry);
  }

  return [...tags.values()]
    .map((tag, tagIndex) => {
      const merchants = [...tag.merchants.entries()]
        .map(([merchant, data]) => ({
          merchant,
          totalMinor: data.totalMinor,
          txnCount: data.txnCount,
          months: [...data.months.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
        }))
        .sort((a, b) => b.totalMinor - a.totalMinor || a.merchant.localeCompare(b.merchant));

      const totalMinor = merchants.reduce((sum, entry) => sum + entry.totalMinor, 0);

      return {
        tagId: tag.tagId,
        tagName: tag.tagName,
        tagColor: meterColor(tagIndex, tag.tagColor),
        totalMinor,
        merchants,
      };
    })
    .filter((tag) => tag.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor || a.tagName.localeCompare(b.tagName));
}
