import {
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
import { parseMultiFilterParam } from "$lib/finance/filter-params";
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
  const [groups, categories, tags] = await Promise.all([listGroups(account.id), listCategories(account.id), listTags(account.id)]);
  const groupParam = url.searchParams.get("group");
  const selectedGroupId = groupParam && groups.some((group) => group.id === groupParam) ? groupParam : null;
  const categoryParam = url.searchParams.get("category");
  const categoryParts = parseMultiFilterParam(categoryParam);
  const selectedCategoryFilters = [
    ...new Set(categoryParts.filter((part) => part === "uncategorized" || categories.some((category) => category.id === part))),
  ];
  const tagParam = url.searchParams.get("tag");
  const tagParts = parseMultiFilterParam(tagParam);
  const selectedTagIds = [...new Set(tagParts.filter((part) => tags.some((tag) => tag.id === part)))];
  const searchQuery = url.searchParams.get("search")?.trim() ?? "";
  const linkParam = url.searchParams.get("link");
  const linkClusterIds = linkParam ? await getRefundLinkClusterIds(account.id, linkParam) : null;
  const selectedLinkTransactionId = linkParam && linkClusterIds?.includes(linkParam) ? linkParam : null;
  const summarySelection = {
    ...buildSummarySelection(summaryPeriod, selectedMonth, selectedYear),
    ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(selectedCategoryFilters.length ? { categoryFilters: selectedCategoryFilters } : {}),
    ...(selectedTagIds.length ? { tagIds: selectedTagIds } : {}),
  };
  const dateRange = summarySelectionToDateRange(summarySelection);

  const [transactions, summary, currentBalance] = await Promise.all([
    listTransactions(account.id, {
      pageIndex: 0,
      pageSize,
      sortBy: "occurredOn",
      sortDirection,
      type: transactionTypeFilter,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      groupId: selectedGroupId ?? undefined,
      categoryIds: selectedCategoryFilters.length ? selectedCategoryFilters : undefined,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      search: searchQuery || undefined,
      linkTransactionId: selectedLinkTransactionId ?? undefined,
    }),
    getTransactionSummary(account.id, summarySelection),
    getCurrentBalance(account.id),
  ]);

  const savingsRate = summary.incomeMinor > 0 ? summary.netMinor / summary.incomeMinor : 0;

  return {
    account,
    categories,
    tags,
    groups,
    selectedGroupId,
    selectedCategoryFilters,
    selectedTagIds,
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
  };
};
