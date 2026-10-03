export type DashboardWidgetId =
  | "summary-month"
  | "summary-all"
  | "tag-spend"
  | "merchant-spend"
  | "space-spend"
  | "monthly-trend"
  | "tag-trend"
  | "budgets"
  | "goals"
  | "monthly-bills"
  | "yearly-bills";

export type DashboardWidgetCategory = "summary" | "spending" | "trends" | "goals" | "billing";

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  label: string;
  description: string;
  category: DashboardWidgetCategory;
};

export const DASHBOARD_WIDGET_CATALOG: DashboardWidgetDefinition[] = [
  {
    id: "summary-month",
    label: "This month",
    description: "Income, out, and net for the current calendar month",
    category: "summary",
  },
  {
    id: "summary-all",
    label: "All time",
    description: "Lifetime income, out, and net totals",
    category: "summary",
  },
  {
    id: "tag-spend",
    label: "Tag spend",
    description: "Top tagged expenses for the selected period",
    category: "spending",
  },
  {
    id: "merchant-spend",
    label: "Top merchants",
    description: "Largest merchants by spend for the selected period",
    category: "spending",
  },
  {
    id: "space-spend",
    label: "Space spend",
    description: "Expenses grouped by space for the selected period",
    category: "spending",
  },
  {
    id: "monthly-trend",
    label: "Monthly trend",
    description: "Income and expense lines over the last 12 months",
    category: "trends",
  },
  {
    id: "tag-trend",
    label: "Tag trend",
    description: "Top tag spend lines by month over the last 12 months",
    category: "trends",
  },
  {
    id: "budgets",
    label: "Budgets",
    description: "Active budget usage meters",
    category: "goals",
  },
  {
    id: "goals",
    label: "Goals",
    description: "Savings goal progress meters",
    category: "goals",
  },
  {
    id: "monthly-bills",
    label: "Monthly bills",
    description: "Bill-tagged merchants grouped by tag for the selected month",
    category: "billing",
  },
  {
    id: "yearly-bills",
    label: "Yearly bills",
    description: "Bill-tagged merchants with monthly breakdown for the year",
    category: "billing",
  },
];

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetId[] = DASHBOARD_WIDGET_CATALOG.map((widget) => widget.id);

const VALID_WIDGET_IDS = new Set<DashboardWidgetId>(DASHBOARD_WIDGET_CATALOG.map((widget) => widget.id));

export const DASHBOARD_WIDGETS_STORAGE_KEY = "chhan-dashboard-widgets";

export function parseDashboardWidgets(raw: string | null): DashboardWidgetId[] {
  if (!raw?.trim()) return [...DEFAULT_DASHBOARD_WIDGETS];

  const parsed = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is DashboardWidgetId => VALID_WIDGET_IDS.has(part as DashboardWidgetId));

  return parsed.length ? parsed : [...DEFAULT_DASHBOARD_WIDGETS];
}

export function serializeDashboardWidgets(widgets: Iterable<DashboardWidgetId>): string {
  return [...widgets].join(",");
}

export function isDashboardWidgetEnabled(widgets: DashboardWidgetId[], id: DashboardWidgetId): boolean {
  return widgets.includes(id);
}

export const METER_COLORS = ["#bd93f9", "#50fa7b", "#54dbee", "#ee7c02", "#ffb86c"];

export function meterColor(index: number, override?: string | null): string {
  return override?.trim() || METER_COLORS[index % METER_COLORS.length];
}

export type MeterRow = {
  name: string;
  amountMinor: number;
  pct: number;
  color: string;
};

export function toSpendMeters(rows: Array<{ name: string; amountMinor: number; colorHex?: string | null }>, totalMinor: number): MeterRow[] {
  return rows.map((row, index) => ({
    name: row.name,
    amountMinor: row.amountMinor,
    pct: totalMinor > 0 ? Math.min(100, Math.round((row.amountMinor / totalMinor) * 100)) : 0,
    color: meterColor(index, row.colorHex),
  }));
}

export type BudgetMeterRow = MeterRow & {
  id: string;
  spentMinor: number;
  limitMinor: number;
};

export function toBudgetMeters(rows: Array<{ id: string; name: string; spentMinor: number; limitMinor: number }>): BudgetMeterRow[] {
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    spentMinor: row.spentMinor,
    limitMinor: row.limitMinor,
    amountMinor: row.spentMinor,
    pct: row.limitMinor > 0 ? Math.min(100, Math.round((row.spentMinor / row.limitMinor) * 100)) : 0,
    color: meterColor(index, "#50fa7b"),
  }));
}

export type GoalMeterRow = MeterRow & {
  id: string;
  status: string;
  currentMinor: number;
  targetMinor: number;
};

export function toGoalMeters(rows: Array<{ id: string; name: string; status: string; currentMinor: number; targetMinor: number }>): GoalMeterRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    currentMinor: row.currentMinor,
    targetMinor: row.targetMinor,
    amountMinor: row.currentMinor,
    pct: row.targetMinor > 0 ? Math.min(100, Math.round((row.currentMinor / row.targetMinor) * 100)) : 0,
    color: "#00a553",
  }));
}

export type TagTrendSegment = {
  name: string;
  amountMinor: number;
  color: string;
};

export type TagTrendMonth = {
  monthKey: string;
  totalMinor: number;
  segments: TagTrendSegment[];
};

export type TagTrendChartData = {
  months: TagTrendMonth[];
  tags: Array<{ name: string; color: string }>;
};

export function buildMonthKeys(monthCount: number, now = new Date()): string[] {
  const safeCount = Math.min(24, Math.max(3, monthCount));
  const keys: string[] = [];
  const cursor = new Date(now);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() - (safeCount - 1));

  for (let index = 0; index < safeCount; index += 1) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

export function buildTagTrendChart(
  rows: Array<{ month_key: string; tag_name: string; amount_minor: number; color_hex?: string | null }>,
  monthCount = 12,
  topN = 6,
  now = new Date()
): TagTrendChartData {
  const monthKeys = buildMonthKeys(monthCount, now);
  const totalsByTag = new Map<string, { totalMinor: number; colorHex?: string | null }>();

  for (const row of rows) {
    const name = row.tag_name;
    const amountMinor = Number(row.amount_minor);
    const existing = totalsByTag.get(name) ?? { totalMinor: 0, colorHex: row.color_hex };
    existing.totalMinor += amountMinor;
    if (!existing.colorHex && row.color_hex) existing.colorHex = row.color_hex;
    totalsByTag.set(name, existing);
  }

  const rankedTags = [...totalsByTag.entries()].sort((a, b) => b[1].totalMinor - a[1].totalMinor).slice(0, topN);

  const trackedNames = new Set(rankedTags.map(([name]) => name));
  const tags = rankedTags.map(([name, meta], index) => ({
    name,
    color: meterColor(index, meta.colorHex),
  }));

  const colorByName = new Map(tags.map((tag) => [tag.name, tag.color]));
  const amountsByMonth = new Map<string, Map<string, number>>();
  let hasOther = false;

  for (const row of rows) {
    const monthKey = row.month_key;
    if (!monthKeys.includes(monthKey)) continue;

    const tagName = trackedNames.has(row.tag_name) ? row.tag_name : "Other";
    if (tagName === "Other") hasOther = true;

    const monthMap = amountsByMonth.get(monthKey) ?? new Map<string, number>();
    monthMap.set(tagName, (monthMap.get(tagName) ?? 0) + Number(row.amount_minor));
    amountsByMonth.set(monthKey, monthMap);
  }

  if (hasOther) {
    tags.push({ name: "Other", color: "#666666" });
    colorByName.set("Other", "#666666");
  }

  const months = monthKeys.map((monthKey) => {
    const monthMap = amountsByMonth.get(monthKey) ?? new Map<string, number>();
    const segments: TagTrendSegment[] = tags
      .map((tag) => ({
        name: tag.name,
        amountMinor: monthMap.get(tag.name) ?? 0,
        color: colorByName.get(tag.name) ?? tag.color,
      }))
      .filter((segment) => segment.amountMinor > 0);

    const totalMinor = segments.reduce((sum, segment) => sum + segment.amountMinor, 0);
    return { monthKey, totalMinor, segments };
  });

  return {
    months,
    tags: tags.filter((tag) => months.some((month) => month.segments.some((segment) => segment.name === tag.name))),
  };
}
