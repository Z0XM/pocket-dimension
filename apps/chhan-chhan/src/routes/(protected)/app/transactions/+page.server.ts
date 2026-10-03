import { getCurrentBalance, getTransactionSummary, listSpaces, listTags, listTransactionPeriods, listTransactions } from "$lib/server/finance";
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
  const [spaces, tags] = await Promise.all([listSpaces(account.id), listTags(account.id)]);
  const spaceParam = url.searchParams.get("space");
  const selectedSpaceId = spaceParam && spaces.some((space) => space.id === spaceParam) ? spaceParam : null;
  const tagParam = url.searchParams.get("tag");
  const tagParts = parseMultiFilterParam(tagParam);
  const selectedTagIds = [...new Set(tagParts.filter((part) => part === "untagged" || tags.some((tag) => tag.id === part)))];
  const searchQuery = url.searchParams.get("search")?.trim() ?? "";
  const summarySelection = {
    ...buildSummarySelection(summaryPeriod, selectedMonth, selectedYear),
    ...(selectedSpaceId ? { spaceId: selectedSpaceId } : {}),
    ...(searchQuery ? { search: searchQuery } : {}),
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
      spaceId: selectedSpaceId ?? undefined,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      search: searchQuery || undefined,
    }),
    getTransactionSummary(account.id, summarySelection),
    getCurrentBalance(account.id),
  ]);

  const savingsRate = summary.incomeMinor > 0 ? summary.netMinor / summary.incomeMinor : 0;

  return {
    account,
    tags,
    spaces,
    selectedSpaceId,
    selectedTagIds,
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
