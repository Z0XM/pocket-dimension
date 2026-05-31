import { getAnalytics, getCategorySpend, getCurrentBalance, getTransactionSummary, listTransactionPeriods } from "$lib/server/finance";
import {
  buildSummarySelection,
  getSummaryLabel,
  getSummaryPrefix,
  normalizeSummaryYears,
  parseSummaryPeriod,
  resolveMonthKey,
  resolveYearValue,
} from "$lib/finance/summary";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { account } = await parent();
  const summaryPeriod = parseSummaryPeriod(url.searchParams.get("summary"));
  const periods = await listTransactionPeriods(account.id);
  const summaryYears = normalizeSummaryYears(periods.years);
  const selectedMonth = resolveMonthKey(url.searchParams.get("month"), periods.months);
  const selectedYear = resolveYearValue(url.searchParams.get("year"), periods.years);
  const summarySelection = buildSummarySelection(summaryPeriod, selectedMonth, selectedYear);

  const [analytics, summary, currentBalance, categorySpendRows] = await Promise.all([
    getAnalytics(account.id),
    getTransactionSummary(account.id, summarySelection),
    getCurrentBalance(account.id),
    getCategorySpend(account.id, summarySelection),
  ]);

  const savingsRate = summary.incomeMinor > 0 ? summary.netMinor / summary.incomeMinor : 0;

  const categorySpend = categorySpendRows.map((row, index) => ({
    name: row.category_name,
    amountMinor: Number(row.amount_minor),
    pct: summary.expenseMinor > 0 ? Math.min(100, Math.round((Number(row.amount_minor) / summary.expenseMinor) * 100)) : 0,
    color: ["#bd93f9", "#50fa7b", "#54dbee", "#ee7c02", "#ffb86c"][index % 5],
  }));

  const budgetUsage = analytics.budgetUsage.map((budget) => ({
    id: budget.id,
    name: budget.name,
    spentMinor: Number(budget.spent_minor),
    limitMinor: Number(budget.limit_minor),
    pct: budget.limit_minor > 0 ? Math.min(100, Math.round((Number(budget.spent_minor) / Number(budget.limit_minor)) * 100)) : 0,
    color: "#50fa7b",
  }));

  const goals = analytics.goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    status: goal.status,
    currentMinor: Number(goal.current_minor),
    targetMinor: Number(goal.target_minor),
    pct: goal.target_minor > 0 ? Math.min(100, Math.round((Number(goal.current_minor) / Number(goal.target_minor)) * 100)) : 0,
  }));

  return {
    account,
    summaryPeriod,
    selectedMonth,
    selectedYear,
    summaryMonths: periods.months,
    summaryYears,
    summaryLabel: getSummaryLabel(summarySelection),
    summaryPrefix: getSummaryPrefix(summarySelection),
    summary: { ...summary, savingsRate },
    currentBalance,
    categorySpend,
    budgetUsage,
    goals,
    monthly: analytics.monthly,
    allTime: analytics.allTime,
  };
};
