import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DASHBOARD_WIDGETS,
  parseDashboardWidgets,
  serializeDashboardWidgets,
  toSpendMeters,
  buildTagTrendChart,
} from "$lib/finance/dashboard-widgets";

describe("parseDashboardWidgets", () => {
  test("returns defaults when param is missing", () => {
    expect(parseDashboardWidgets(null)).toEqual(DEFAULT_DASHBOARD_WIDGETS);
  });

  test("parses comma-separated widget ids", () => {
    expect(parseDashboardWidgets("tag-spend,monthly-trend,budgets")).toEqual(["tag-spend", "monthly-trend", "budgets"]);
  });

  test("ignores unknown ids and falls back to defaults when empty", () => {
    expect(parseDashboardWidgets("nope,also-nope")).toEqual(DEFAULT_DASHBOARD_WIDGETS);
  });
});

describe("serializeDashboardWidgets", () => {
  test("joins widget ids", () => {
    expect(serializeDashboardWidgets(["tag-spend", "goals"])).toBe("tag-spend,goals");
  });
});

describe("toSpendMeters", () => {
  test("computes percentages against total spend", () => {
    const rows = toSpendMeters(
      [
        { name: "Food", amountMinor: 3000 },
        { name: "Travel", amountMinor: 7000 },
      ],
      10000
    );

    expect(rows[0].pct).toBe(30);
    expect(rows[1].pct).toBe(70);
  });
});

describe("buildTagTrendChart", () => {
  test("builds stacked monthly series for top tags", () => {
    const now = new Date(2026, 3, 15);
    const chart = buildTagTrendChart(
      [
        { month_key: "2026-03", tag_name: "Food", amount_minor: 1000 },
        { month_key: "2026-03", tag_name: "Travel", amount_minor: 2000 },
        { month_key: "2026-04", tag_name: "Food", amount_minor: 1500 },
        { month_key: "2026-04", tag_name: "Misc", amount_minor: 500 },
      ],
      3,
      2,
      now
    );

    expect(chart.tags.map((tag) => tag.name)).toEqual(["Food", "Travel", "Other"]);
    expect(chart.months).toHaveLength(3);
    expect(chart.months.find((month) => month.monthKey === "2026-03")?.totalMinor).toBe(3000);
    expect(chart.months.find((month) => month.monthKey === "2026-04")?.segments.find((segment) => segment.name === "Other")?.amountMinor).toBe(500);
  });
});
