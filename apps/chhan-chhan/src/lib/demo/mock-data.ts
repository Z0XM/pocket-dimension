// Deterministic mock data for the ledger UI (until live API wiring).
// Everything is seeded so SSR and client render identically (no hydration drift).

export type TxnType = "expense" | "income" | "transfer";

export type SampleTransaction = {
  id: string;
  occurredOn: string;
  merchant: string;
  category: string;
  categoryColor: string;
  tags: string[];
  type: TxnType;
  amountMinor: number;
  account: string;
};

export type SampleCategory = {
  name: string;
  color: string;
  kind: TxnType;
  monthlyMinor: number;
};

export type SampleTag = { name: string; count: number };

export type SamplePivot = {
  name: string;
  groupBy: "category" | "merchant" | "tag" | "account";
  range: string;
};

export type SampleCardConfig = {
  id: string;
  label: string;
  metric: string;
  enabled: boolean;
};

export const sampleCategories: SampleCategory[] = [
  { name: "Groceries", color: "#4ade80", kind: "expense", monthlyMinor: 42000 },
  { name: "Dining", color: "#fb923c", kind: "expense", monthlyMinor: 28000 },
  { name: "Transport", color: "#38bdf8", kind: "expense", monthlyMinor: 16000 },
  { name: "Utilities", color: "#a78bfa", kind: "expense", monthlyMinor: 21000 },
  { name: "Rent", color: "#f472b6", kind: "expense", monthlyMinor: 120000 },
  { name: "Salary", color: "#34d399", kind: "income", monthlyMinor: 360000 },
  { name: "Freelance", color: "#facc15", kind: "income", monthlyMinor: 85000 },
  { name: "Savings", color: "#22d3ee", kind: "transfer", monthlyMinor: 60000 },
  { name: "Shopping", color: "#e879f9", kind: "expense", monthlyMinor: 34000 },
  { name: "Health", color: "#f87171", kind: "expense", monthlyMinor: 18000 },
];

export const sampleTags: SampleTag[] = [
  { name: "monthly", count: 48 },
  { name: "family", count: 31 },
  { name: "subscription", count: 22 },
  { name: "work", count: 19 },
  { name: "essential", count: 64 },
  { name: "treat", count: 12 },
  { name: "recurring", count: 27 },
  { name: "one-off", count: 15 },
];

export const samplePivots: SamplePivot[] = [
  { name: "Spend by Category", groupBy: "category", range: "This Month" },
  { name: "Top Merchants", groupBy: "merchant", range: "Last 30 Days" },
  { name: "Tag Breakdown", groupBy: "tag", range: "This Quarter" },
  { name: "Account Flow", groupBy: "account", range: "Year to Date" },
];

export const sampleCardConfigs: SampleCardConfig[] = [
  { id: "net", label: "Net Balance", metric: "income − expense", enabled: true },
  { id: "income", label: "Income", metric: "sum(income)", enabled: true },
  { id: "expense", label: "Expenses", metric: "sum(expense)", enabled: true },
  { id: "savings", label: "Savings Rate", metric: "net ÷ income", enabled: true },
  { id: "top", label: "Top Category", metric: "max(category)", enabled: false },
  { id: "avg", label: "Avg / Day", metric: "expense ÷ days", enabled: false },
];

const merchants = [
  "Greenmart",
  "Brew & Co",
  "Metro Transit",
  "PowerGrid",
  "Skyline Rentals",
  "Acme Payroll",
  "Pixel Studio",
  "Vault Savings",
  "Urban Outfit",
  "CityCare Clinic",
  "Cloudstream",
  "Daily Roast",
  "FreshFarm",
  "RideNow",
  "Bookhive",
];

const accounts = ["Everyday", "Credit", "Savings", "Cash"];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export const PAGE_SIZE = 25;

/** Generate a deterministic page of transactions for infinite scroll. */
export function generateTransactions(pageIndex: number, pageSize = PAGE_SIZE): SampleTransaction[] {
  const rows: SampleTransaction[] = [];
  for (let i = 0; i < pageSize; i++) {
    const globalIndex = pageIndex * pageSize + i;
    const rand = mulberry32(globalIndex * 2654435761 + 97);
    const category = pick(rand, sampleCategories);
    const type = category.kind;
    const baseAmount = Math.floor(rand() * 18000) + 500;
    const amountMinor = type === "income" ? baseAmount + 30000 : type === "transfer" ? baseAmount + 5000 : -baseAmount;

    const date = new Date(Date.UTC(2026, 4, 30));
    date.setUTCDate(date.getUTCDate() - globalIndex);

    const tagPool = sampleTags.map((t) => t.name);
    const tags = rand() > 0.5 ? [pick(rand, tagPool)] : [];
    if (rand() > 0.8) tags.push(pick(rand, tagPool));

    rows.push({
      id: `txn-${globalIndex}`,
      occurredOn: date.toISOString().slice(0, 10),
      merchant: pick(rand, merchants),
      category: category.name,
      categoryColor: category.color,
      tags: [...new Set(tags)],
      type,
      amountMinor,
      account: pick(rand, accounts),
    });
  }
  return rows;
}

export const MAX_PAGES = 40;

export function formatMoney(amountMinor: number): string {
  const value = amountMinor / 100;
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type SampleSummary = {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  savingsRate: number;
  topCategory: string;
  avgPerDayMinor: number;
};

export const sampleSummary: SampleSummary = (() => {
  const income = sampleCategories.filter((c) => c.kind === "income").reduce((s, c) => s + c.monthlyMinor, 0);
  const expense = sampleCategories.filter((c) => c.kind === "expense").reduce((s, c) => s + c.monthlyMinor, 0);
  const net = income - expense;
  const top = [...sampleCategories].filter((c) => c.kind === "expense").sort((a, b) => b.monthlyMinor - a.monthlyMinor)[0];
  return {
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: net,
    savingsRate: income > 0 ? net / income : 0,
    topCategory: top?.name ?? "—",
    avgPerDayMinor: Math.round(expense / 30),
  };
})();

/** Budget usage rows derived from categories (for meters). */
export const sampleBudgetUsage = sampleCategories
  .filter((c) => c.kind === "expense")
  .slice(0, 5)
  .map((c, i) => ({
    name: c.name,
    color: c.color,
    pct: [68, 42, 31, 86, 54][i] ?? 50,
  }));
