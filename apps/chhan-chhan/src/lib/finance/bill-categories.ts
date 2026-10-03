import { sql, type SQL } from "drizzle-orm";

/** Tag names containing the word "bill", e.g. Monthly Bill, Yearly Bill. */
export function isBillTagName(name: string | null | undefined) {
  if (!name?.trim()) return false;
  return /\bbill\b/i.test(name.trim());
}

/** @deprecated Use isBillTagName */
export const isBillCategoryName = isBillTagName;

/** SQL filter: transaction has a bill tag. */
export function billTagSqlFilter(): SQL {
  return sql`exists (
    select 1
    from chhanchhan.finance_transaction_tags ftt
    inner join chhanchhan.finance_tags tg on tg.id = ftt.tag_id
    where ftt.transaction_id = t.id
      and tg.name ~* '\\mbill\\M'
  )`;
}

/** @deprecated Use billTagSqlFilter */
export const billCategorySqlFilter = billTagSqlFilter;

export function filterBillTagRows<T extends { tag_name?: string; category_name?: string }>(rows: T[]): T[] {
  return rows.filter((row) => isBillTagName(row.tag_name ?? row.category_name));
}

/** @deprecated Use filterBillTagRows */
export const filterBillCategoryRows = filterBillTagRows;
