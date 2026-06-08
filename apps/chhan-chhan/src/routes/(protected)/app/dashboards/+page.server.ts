import {
  getAnalytics,
  getCategoryMerchantBills,
  getCategoryMerchantBillsForYear,
  getCategorySpend,
  getCategoryTrend,
  getCurrentBalance,
  getGroupSpend,
  getMerchantSpend,
  getMonthlyTrend,
  getTagSpend,
  getTransactionSummary,
  listTransactionPeriods,
} from "$lib/server/finance";
import { buildBillingByCategory, resolveBillingMonthKey, resolveBillingYear } from "$lib/finance/billing";
import {
  buildCategoryTrendChart,
  isDashboardWidgetEnabled,
  parseDashboardWidgets,
  toBudgetMeters,
  toGoalMeters,
  toSpendMeters,
} from "$lib/finance/dashboard-widgets";
import {
  buildSummarySelection,
  getSummaryLabel,
  getSummaryPrefix,
  normalizeSummaryYears,
  parseSummaryPeriod,
  resolveMonthKey,
  resolveYearValue,
  formatMonthKeyShort,
} from "$lib/finance/summary";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { account } = await parent();
  const summaryPeriod = parseSummaryPeriod(url.searchParams.get("summary"));
  const enabledWidgets = parseDashboardWidgets(url.searchParams.get("widgets"));
  const periods = await listTransactionPeriods(account.id);
  const summaryYears = normalizeSummaryYears(periods.years);
  const selectedMonth = resolveMonthKey(url.searchParams.get("month"), periods.months);
  const selectedYear = resolveYearValue(url.searchParams.get("year"), periods.years);
  const summarySelection = buildSummarySelection(summaryPeriod, selectedMonth, selectedYear);

  const needsSummaryMonth = isDashboardWidgetEnabled(enabledWidgets, "summary-month");
  const needsSummaryAll = isDashboardWidgetEnabled(enabledWidgets, "summary-all");
  const needsCategorySpend = isDashboardWidgetEnabled(enabledWidgets, "category-spend");
  const needsTagSpend = isDashboardWidgetEnabled(enabledWidgets, "tag-spend");
  const needsMerchantSpend = isDashboardWidgetEnabled(enabledWidgets, "merchant-spend");
  const needsGroupSpend = isDashboardWidgetEnabled(enabledWidgets, "group-spend");
  const needsMonthlyTrend = isDashboardWidgetEnabled(enabledWidgets, "monthly-trend");
  const needsCategoryTrend = isDashboardWidgetEnabled(enabledWidgets, "category-trend");
  const needsIncomeExpense = isDashboardWidgetEnabled(enabledWidgets, "income-expense");
  const needsBudgets = isDashboardWidgetEnabled(enabledWidgets, "budgets");
  const needsGoals = isDashboardWidgetEnabled(enabledWidgets, "goals");
  const needsMonthlyBills = isDashboardWidgetEnabled(enabledWidgets, "monthly-bills");
  const needsYearlyBills = isDashboardWidgetEnabled(enabledWidgets, "yearly-bills");
  const needsAnalytics = needsSummaryMonth || needsSummaryAll || needsBudgets || needsGoals;
  const billingYear = resolveBillingYear(summarySelection, summaryYears);

  const [
    analytics,
    summary,
    currentBalance,
    categorySpendRows,
    tagSpendRows,
    merchantSpendRows,
    groupSpendRows,
    monthlyTrendRows,
    categoryTrendRows,
    monthlyBillRows,
    yearlyBillRows,
  ] = await Promise.all([
    needsAnalytics ? getAnalytics(account.id) : Promise.resolve(null),
    getTransactionSummary(account.id, summarySelection),
    getCurrentBalance(account.id),
    needsCategorySpend ? getCategorySpend(account.id, summarySelection) : Promise.resolve([]),
    needsTagSpend ? getTagSpend(account.id, summarySelection) : Promise.resolve([]),
    needsMerchantSpend ? getMerchantSpend(account.id, summarySelection) : Promise.resolve([]),
    needsGroupSpend ? getGroupSpend(account.id, summarySelection) : Promise.resolve([]),
    needsMonthlyTrend ? getMonthlyTrend(account.id, 12) : Promise.resolve([]),
    needsCategoryTrend ? getCategoryTrend(account.id, 12) : Promise.resolve([]),
    needsMonthlyBills ? getCategoryMerchantBills(account.id, summarySelection) : Promise.resolve([]),
    needsYearlyBills ? getCategoryMerchantBillsForYear(account.id, billingYear) : Promise.resolve([]),
  ]);

  const savingsRate = summary.incomeMinor > 0 ? summary.netMinor / summary.incomeMinor : 0;

  const categorySpend = toSpendMeters(
    categorySpendRows.map((row) => ({
      name: row.category_name,
      amountMinor: Number(row.amount_minor),
    })),
    summary.expenseMinor
  );

  const tagSpend = toSpendMeters(
    tagSpendRows.map((row) => ({
      name: row.tag_name,
      amountMinor: Number(row.amount_minor),
      colorHex: row.color_hex,
    })),
    summary.expenseMinor
  );

  const merchantSpend = toSpendMeters(
    merchantSpendRows.map((row) => ({
      name: row.merchant_name,
      amountMinor: Number(row.amount_minor),
    })),
    summary.expenseMinor
  );

  const groupSpend = toSpendMeters(
    groupSpendRows.map((row) => ({
      name: row.group_name,
      amountMinor: Number(row.amount_minor),
      colorHex: row.color_hex,
    })),
    summary.expenseMinor
  );

  const budgetUsage = analytics
    ? toBudgetMeters(
        analytics.budgetUsage.map((budget) => ({
          id: budget.id,
          name: budget.name,
          spentMinor: Number(budget.spent_minor),
          limitMinor: Number(budget.limit_minor),
        }))
      )
    : [];

  const goals = analytics
    ? toGoalMeters(
        analytics.goals.map((goal) => ({
          id: goal.id,
          name: goal.name,
          status: goal.status,
          currentMinor: Number(goal.current_minor),
          targetMinor: Number(goal.target_minor),
        }))
      )
    : [];

  const billingMonthKey = resolveBillingMonthKey(summarySelection);
  const monthlyBills = needsMonthlyBills ? buildBillingByCategory(monthlyBillRows, { monthKey: billingMonthKey }) : [];
  const yearlyBills = needsYearlyBills ? buildBillingByCategory(yearlyBillRows) : [];
  const monthlyBillsLabel =
    summarySelection.period === "month" && summarySelection.month ? formatMonthKeyShort(summarySelection.month) : getSummaryLabel(summarySelection);

  return {
    account,
    enabledWidgets,
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
    tagSpend,
    merchantSpend,
    groupSpend,
    monthlyTrend: monthlyTrendRows,
    categoryTrend: needsCategoryTrend ? buildCategoryTrendChart(categoryTrendRows, 12, 6) : null,
    budgetUsage,
    goals,
    monthly: needsSummaryMonth && analytics ? analytics.monthly : null,
    allTime: needsSummaryAll && analytics ? analytics.allTime : null,
    showIncomeExpense: needsIncomeExpense,
    monthlyBills,
    yearlyBills,
    billingYear,
    monthlyBillsLabel,
  };
};
