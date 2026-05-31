import {
  getAnalytics,
  getCategorySpend,
  getCurrentBalance,
  getRefundLinkClusterIds,
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
  const groups = await listGroups(account.id);
  const groupParam = url.searchParams.get("group");
  const selectedGroupId = groupParam && groups.some((group) => group.id === groupParam) ? groupParam : null;
  const searchQuery = url.searchParams.get("search")?.trim() ?? "";
  const linkParam = url.searchParams.get("link");
  const linkClusterIds = linkParam ? await getRefundLinkClusterIds(account.id, linkParam) : null;
  const selectedLinkTransactionId = linkParam && linkClusterIds?.includes(linkParam) ? linkParam : null;
  const summarySelection = {
    ...buildSummarySelection(summaryPeriod, selectedMonth, selectedYear),
    ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
  };
  const dateRange = summarySelectionToDateRange(summarySelection);

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
      search: searchQuery || undefined,
      linkTransactionId: selectedLinkTransactionId ?? undefined,
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
    color: "#54dbee",
  }));

  const categorySpend = categorySpendRows.map((row, index) => ({
    name: row.category_name,
    pct: summary.expenseMinor > 0 ? Math.min(100, Math.round((Number(row.amount_minor) / summary.expenseMinor) * 100)) : 0,
    color: ["#bd93f9", "#50fa7b", "#54dbee", "#ee7c02", "#ffb86c"][index % 5],
  }));

  const meterRows = searchQuery ? categorySpend.slice(0, 5) : budgetUsage.length ? budgetUsage : categorySpend.slice(0, 5);

  return {
    account,
    categories,
    tags,
    groups,
    selectedGroupId,
    selectedLinkTransactionId,
    linkClusterSize: linkClusterIds?.length ?? 0,
    searchQuery,
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
    budgetUsage: meterRows,
  };
};
