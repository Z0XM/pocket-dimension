import { meterColor } from "$lib/finance/dashboard-widgets";
import type { SummarySelection } from "$lib/finance/summary";

export type CategoryMerchantBillRow = {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
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

export type BillingCategoryGroup = {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
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

function categoryKey(categoryId: string | null, categoryName: string): string {
  return categoryId ?? `name:${categoryName}`;
}

export function buildBillingByCategory(rows: CategoryMerchantBillRow[], options: { monthKey?: string | null } = {}): BillingCategoryGroup[] {
  const monthKey = options.monthKey ?? null;
  const filtered = monthKey ? rows.filter((row) => row.month_key === monthKey) : rows;

  const categories = new Map<
    string,
    {
      categoryId: string | null;
      categoryName: string;
      categoryColor: string | null;
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
    const key = categoryKey(row.category_id, row.category_name);
    const category =
      categories.get(key) ??
      (() => {
        const entry = {
          categoryId: row.category_id,
          categoryName: row.category_name,
          categoryColor: row.category_color,
          merchants: new Map(),
        };
        categories.set(key, entry);
        return entry;
      })();

    const amountMinor = Number(row.amount_minor);
    const txnCount = Number(row.txn_count);
    const merchant =
      category.merchants.get(row.merchant_name) ??
      (() => {
        const entry = {
          totalMinor: 0,
          txnCount: 0,
          months: new Map<string, BillingMonthAmount>(),
        };
        category.merchants.set(row.merchant_name, entry);
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

  return [...categories.values()]
    .map((category, categoryIndex) => {
      const merchants = [...category.merchants.entries()]
        .map(([merchant, data]) => ({
          merchant,
          totalMinor: data.totalMinor,
          txnCount: data.txnCount,
          months: [...data.months.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
        }))
        .sort((a, b) => b.totalMinor - a.totalMinor || a.merchant.localeCompare(b.merchant));

      const totalMinor = merchants.reduce((sum, entry) => sum + entry.totalMinor, 0);

      return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryColor: meterColor(categoryIndex, category.categoryColor),
        totalMinor,
        merchants,
      };
    })
    .filter((category) => category.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor || a.categoryName.localeCompare(b.categoryName));
}
