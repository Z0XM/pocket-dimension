import { eq, ilike, or, sql, type SQL } from "drizzle-orm";

export function parseAmountSearchTerm(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[₹$€£,\s]/g, "").replace(/^\+/, "");
  if (!/^-?\d*\.?\d+$/.test(normalized)) return null;

  const major = Number.parseFloat(normalized);
  if (!Number.isFinite(major)) return null;

  return Math.round(Math.abs(major) * 100);
}

export function extractAmountDigitPattern(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 2 ? digits : null;
}

export function transactionSearchMatchesAmount(amountMinor: number, search: string): boolean {
  const trimmed = search.trim();
  if (!trimmed) return false;

  const parsed = parseAmountSearchTerm(trimmed);
  if (parsed !== null && amountMinor === parsed) return true;

  const digitPattern = extractAmountDigitPattern(trimmed);
  if (digitPattern && String(amountMinor).includes(digitPattern)) return true;

  return false;
}

type TransactionSearchColumns = {
  merchant: Parameters<typeof ilike>[0];
  notes: Parameters<typeof ilike>[0];
  amountMinor: Parameters<typeof eq>[0];
};

export function buildTransactionSearchCondition(search: string, columns: TransactionSearchColumns): SQL {
  const trimmed = search.trim();
  const parts: SQL[] = [ilike(columns.merchant, `%${trimmed}%`), ilike(columns.notes, `%${trimmed}%`)];

  const parsed = parseAmountSearchTerm(trimmed);
  if (parsed !== null) {
    parts.push(eq(columns.amountMinor, parsed));
  }

  const digitPattern = extractAmountDigitPattern(trimmed);
  if (digitPattern) {
    parts.push(sql`cast(${columns.amountMinor} as text) ilike ${`%${digitPattern}%`}`);
  }

  return or(...parts)!;
}

export function buildSummarySearchFilterSql(search?: string) {
  if (!search?.trim()) return sql`true`;

  const trimmed = search.trim();
  const term = `%${trimmed}%`;
  const parts: SQL[] = [sql`t.merchant ilike ${term}`, sql`coalesce(t.notes, '') ilike ${term}`];

  const parsed = parseAmountSearchTerm(trimmed);
  if (parsed !== null) {
    parts.push(sql`t.amount_minor = ${parsed}`);
  }

  const digitPattern = extractAmountDigitPattern(trimmed);
  if (digitPattern) {
    parts.push(sql`cast(t.amount_minor as text) ilike ${`%${digitPattern}%`}`);
  }

  return sql`(${sql.join(parts, sql` or `)})`;
}
