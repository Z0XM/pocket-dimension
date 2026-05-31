import {
  getAnalytics,
  getCategorySpend,
  getCurrentBalance,
  getTransactionSummary,
  listCategories,
  listGroups,
  listTags,
  listTransactionPeriods,
  listTransactions,
} from "$lib/server/finance";
import {
  buildSummarySelection,
  getSummaryLabel,
  getSummaryPrefix,
  normalizeSummaryYears,
  parseSummaryPeriod,
  resolveMonthKey,
  resolveYearValue,
  summarySelectionToDateRange,
} from "$lib/finance/summary";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { account } = await parent();
  const pageSize = 50;
  const sortDirection = url.searchParams.get("sort") === "asc" ? "asc" : "desc";
  const summaryPeriod = parseSummaryPeriod(url.searchParams.get("summary"));
  const typeParam = url.searchParams.get("type");
  const transactionTypeFilter = typeParam === "income" || typeParam === "expense" ? typeParam : undefined;

  const periods = await listTransactionPeriods(account.id);
  const summaryYears = normalizeSummaryYears(periods.years);
  const selectedMonth = resolveMonthKey(url.searchParams.get("month"), periods.months);
  const selectedYear = resolveYearValue(url.searchParams.get("year"), periods.years);
  const summarySelection = buildSummarySelection(summaryPeriod, selectedMonth, selectedYear);
  const dateRange = summarySelectionToDateRange(summarySelection);
  const groups = await listGroups(account.id);
  const groupParam = url.searchParams.get("group");
  const selectedGroupId = groupParam && groups.some((group) => group.id === groupParam) ? groupParam : null;

  const [transactions, analytics, summary, currentBalance, categories, tags, categorySpendRows] = await Promise.all([
    listTransactions(account.id, {
      pageIndex: 0,
      pageSize,
      sortBy: "occurredOn",
      sortDirection,
      type: transactionTypeFilter,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      groupId: selectedGroupId ?? undefined,
    }),
    getAnalytics(account.id),
    getTransactionSummary(account.id, summarySelection),
    getCurrentBalance(account.id),
    listCategories(account.id),
    listTags(account.id),
    getCategorySpend(account.id, summarySelection),
  ]);

  const savingsRate = summary.incomeMinor > 0 ? summary.netMinor / summary.incomeMinor : 0;

  const budgetUsage = analytics.budgetUsage.map((budget) => ({
    id: budget.id,
    name: budget.name,
    pct: budget.limit_minor > 0 ? Math.min(100, Math.round((budget.spent_minor / budget.limit_minor) * 100)) : 0,
    color: "#634bdd",
  }));

  const categorySpend = categorySpendRows.map((row, index) => ({
    name: row.category_name,
    pct: summary.expenseMinor > 0 ? Math.min(100, Math.round((Number(row.amount_minor) / summary.expenseMinor) * 100)) : 0,
    color: ["#634bdd", "#00a553", "#a50036", "#9180e3", "#21094e"][index % 5],
  }));

  return {
    account,
    categories,
    tags,
    groups,
    selectedGroupId,
    transactions: transactions.rows,
    hasMore: transactions.hasMore,
    total: transactions.total,
    pageSize,
    sortDirection,
    transactionTypeFilter,
    summaryPeriod,
    selectedMonth,
    selectedYear,
    summaryMonths: periods.months,
    summaryYears,
    summaryLabel: getSummaryLabel(summarySelection),
    summaryPrefix: getSummaryPrefix(summarySelection),
    summary: { ...summary, savingsRate },
    currentBalance,
    budgetUsage: budgetUsage.length ? budgetUsage : categorySpend.slice(0, 5),
  };
};
