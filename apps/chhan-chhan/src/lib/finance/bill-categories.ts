import { sql, type SQL } from "drizzle-orm";

/** Category names containing the word "bill", e.g. Monthly Bill, Yearly Bill. */
export function isBillCategoryName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return /\bbill\b/i.test(name.trim());
}

/** SQL filter: transaction category (or its parent) is a bill category. */
export function billCategorySqlFilter(): SQL {
  return sql`(
    c.name ~* '\\mbill\\M'
    or coalesce(parent.name, '') ~* '\\mbill\\M'
  )`;
}

export function filterBillCategoryRows<T extends { category_name: string }>(rows: T[]): T[] {
  return rows.filter((row) => isBillCategoryName(row.category_name));
}
