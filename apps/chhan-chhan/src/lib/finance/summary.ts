export type SummaryPeriod = "month" | "year" | "all";

export type SummarySelection = {
  period: SummaryPeriod;
  month?: string;
  year?: number;
};

export function parseSummaryPeriod(value: string | null): SummaryPeriod {
  if (value === "year" || value === "all") return value;
  return "month";
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [, month] = value.split("-");
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) return null;
  return value;
}

export function resolveMonthKey(requested: string | null, available: string[], fallback = currentMonthKey()): string {
  const parsed = parseMonthKey(requested);
  if (parsed && available.includes(parsed)) return parsed;
  if (available.includes(fallback)) return fallback;
  return available[0] ?? fallback;
}

export function parseYearValue(value: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  if (year < 1970 || year > 2100) return null;
  return year;
}

export function readRowYear(row: Record<string, unknown>): number | null {
  const raw = row.year ?? row.Year;
  if (raw == null) return null;
  const year = typeof raw === "number" ? raw : Number(String(raw).replace(/\.0+$/, ""));
  if (!Number.isFinite(year) || year < 1970 || year > 2100) return null;
  return year;
}

export function normalizeSummaryYears(available: number[], now = new Date()): number[] {
  const years = new Set(available.filter((year) => Number.isFinite(year) && year >= 1970 && year <= 2100));
  years.add(now.getFullYear());
  return [...years].sort((a, b) => b - a);
}

export function resolveYearValue(requested: string | null, available: number[], fallback = new Date().getFullYear()): number {
  const options = normalizeSummaryYears(available);
  const parsed = parseYearValue(requested);
  if (parsed != null && options.includes(parsed)) return parsed;
  if (options.includes(fallback)) return fallback;
  return options[0] ?? fallback;
}

export function monthKeyToDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function formatMonthKey(monthKey: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(monthKeyToDate(monthKey));
}

export function formatMonthKeyShort(monthKey: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(monthKeyToDate(monthKey));
}

export function getSummaryLabel(selection: SummarySelection): string {
  if (selection.period === "month" && selection.month) {
    return formatMonthKey(selection.month);
  }
  if (selection.period === "year" && selection.year) {
    return new Intl.DateTimeFormat("en-IN", { year: "numeric" }).format(new Date(selection.year, 0, 1));
  }
  if (selection.period === "all") return "All time";
  return formatMonthKey(currentMonthKey());
}

export function getSummaryPrefix(selection: SummarySelection): string {
  if (selection.period === "month" && selection.month) {
    return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(monthKeyToDate(selection.month)).toUpperCase();
  }
  if (selection.period === "year" && selection.year) {
    return String(selection.year);
  }
  return "ALL";
}

export function buildSummarySelection(period: SummaryPeriod, month: string, year: number): SummarySelection {
  if (period === "month") return { period, month };
  if (period === "year") return { period, year };
  return { period: "all" };
}

export function summarySelectionToDateRange(selection: SummarySelection): {
  dateFrom?: string;
  dateTo?: string;
} {
  if (selection.period === "month" && selection.month) {
    const [year, month] = selection.month.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      dateFrom: `${selection.month}-01`,
      dateTo: `${selection.month}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  if (selection.period === "year" && selection.year != null) {
    return {
      dateFrom: `${selection.year}-01-01`,
      dateTo: `${selection.year}-12-31`,
    };
  }

  return {};
}
