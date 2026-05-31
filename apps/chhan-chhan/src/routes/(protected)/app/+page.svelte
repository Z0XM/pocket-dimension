<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { Tag, Plus, MessageSquare, Link, Layers, Eye, EyeOff, ArrowLeftRight, TriangleAlert } from "@lucide/svelte";
  import { formatMoney } from "$lib/finance/money";
  import { isRefundCategoryName } from "$lib/finance/refunds";
  import { buildSummarySelection, formatMonthKeyShort, summarySelectionToDateRange, type SummaryPeriod } from "$lib/finance/summary";
  import { infiniteScroll } from "$lib/actions/infinite-scroll";
  import AppNav from "$lib/components/app-nav.svelte";
  import AppSettings from "$lib/components/app-settings.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let rows = $state<PageData["transactions"]>([]);
  let pageIndex = $state(0);
  let loading = $state(false);
  let hasMore = $state(false);
  let searchInput = $state("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let savingCategoryId = $state<string | null>(null);
  let savingNotesId = $state<string | null>(null);
  let savingTagTxId = $state<string | null>(null);
  let openTagMenuTxId = $state<string | null>(null);
  let savingGroupTxId = $state<string | null>(null);
  let savingGroupHiddenId = $state<string | null>(null);
  let openGroupTxId = $state<string | null>(null);
  let openNoteTxId = $state<string | null>(null);
  let noteDraft = $state("");
  let openRefundLinkTxId = $state<string | null>(null);
  let refundLinkSearch = $state("");
  let refundLinkOptions = $state<Array<{ id: string; occurredOn: string; merchant: string | null; amountMinor: number }>>([]);
  let savingRefundLinkId = $state<string | null>(null);
  let refundLinkSearchTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    rows = [...data.transactions];
    pageIndex = 0;
    hasMore = data.hasMore;
    searchInput = data.searchQuery ?? "";
  });

  function handleSearchInput(value: string) {
    searchInput = value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const next = value.trim();
      const current = (data.searchQuery ?? "").trim();
      if (next === current) return;
      goto(appUrl({ search: next || null }), { keepFocus: true, noScroll: true, invalidateAll: true });
    }, 300);
  }

  function transactionQueryParams(page: number) {
    const params = new URLSearchParams({
      pageIndex: String(page),
      pageSize: String(data.pageSize),
      sortBy: "occurredOn",
      sortDirection: data.sortDirection,
    });
    if (data.transactionTypeFilter) {
      params.set("type", data.transactionTypeFilter);
    }
    const dateRange = summarySelectionToDateRange(buildSummarySelection(data.summaryPeriod, data.selectedMonth, data.selectedYear));
    if (dateRange.dateFrom) params.set("dateFrom", dateRange.dateFrom);
    if (dateRange.dateTo) params.set("dateTo", dateRange.dateTo);
    if (data.selectedGroupId) params.set("groupId", data.selectedGroupId);
    if (data.searchQuery?.trim()) params.set("search", data.searchQuery.trim());
    if (data.selectedLinkTransactionId) params.set("linkTransactionId", data.selectedLinkTransactionId);
    return params;
  }

  $effect(() => {
    if (!openTagMenuTxId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".tag-add-wrap")) {
        openTagMenuTxId = null;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") openTagMenuTxId = null;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  $effect(() => {
    if (!openNoteTxId) return;
    queueMicrotask(() => {
      document.querySelector<HTMLTextAreaElement>(".note-textarea")?.focus();
    });
  });

  $effect(() => {
    if (!openNoteTxId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".note-wrap")) return;

      const transaction = rows.find((row) => row.id === openNoteTxId);
      if (transaction) {
        void saveNoteEditor(transaction.id, transaction.notes ?? "");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && openNoteTxId) {
        const transaction = rows.find((row) => row.id === openNoteTxId);
        noteDraft = transaction?.notes ?? "";
        openNoteTxId = null;
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  $effect(() => {
    if (!openGroupTxId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".group-link-wrap")) return;
      openGroupTxId = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") openGroupTxId = null;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  $effect(() => {
    if (!openRefundLinkTxId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".refund-link-wrap")) return;
      openRefundLinkTxId = null;
      refundLinkSearch = "";
      refundLinkOptions = [];
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        openRefundLinkTxId = null;
        refundLinkSearch = "";
        refundLinkOptions = [];
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  $effect(() => {
    if (!openRefundLinkTxId) return;
    const query = refundLinkSearch;
    clearTimeout(refundLinkSearchTimer);
    refundLinkSearchTimer = setTimeout(() => {
      void loadRefundLinkOptions(query);
    }, 250);
  });

  function appUrl(
    updates: {
      sort?: "asc" | "desc";
      summary?: SummaryPeriod;
      month?: string;
      year?: number;
      type?: "income" | "expense" | null;
      group?: string | null;
      search?: string | null;
      link?: string | null;
    } = {}
  ) {
    const params = new URLSearchParams();
    const sort = updates.sort ?? data.sortDirection;
    const summary = updates.summary ?? data.summaryPeriod;
    const month = updates.month ?? data.selectedMonth;
    const year = updates.year ?? data.selectedYear;
    const typeFilter = updates.type === undefined ? data.transactionTypeFilter : updates.type;
    const groupFilter = updates.group === undefined ? data.selectedGroupId : updates.group;
    const searchFilter = updates.search === undefined ? (data.searchQuery ?? "") : (updates.search ?? "");
    const linkFilter = updates.link === undefined ? data.selectedLinkTransactionId : updates.link;

    if (sort === "asc") params.set("sort", "asc");

    if (summary === "year") {
      params.set("summary", "year");
      params.set("year", String(year));
    } else if (summary === "all") {
      params.set("summary", "all");
    } else {
      params.set("summary", "month");
      params.set("month", month);
    }

    if (typeFilter) params.set("type", typeFilter);
    if (groupFilter) params.set("group", groupFilter);
    if (searchFilter.trim()) params.set("search", searchFilter.trim());
    if (linkFilter) params.set("link", linkFilter);

    const query = params.toString();
    return query ? `/app?${query}` : "/app";
  }

  function setSummaryPeriod(period: SummaryPeriod) {
    const updates: {
      summary: SummaryPeriod;
      month?: string;
      year?: number;
    } = { summary: period };

    if (period === "year") {
      updates.year = data.summaryYears.includes(data.selectedYear) ? data.selectedYear : (data.summaryYears[0] ?? new Date().getFullYear());
    } else if (period === "month") {
      updates.month = data.selectedMonth;
    }

    goto(appUrl(updates), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setSummaryMonth(month: string) {
    goto(appUrl({ summary: "month", month }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setSummaryYear(year: number) {
    goto(appUrl({ summary: "year", year }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function toggleDateSort() {
    const next = data.sortDirection === "desc" ? "asc" : "desc";
    goto(appUrl({ sort: next }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setTypeFilter(type: "income" | "expense" | null) {
    goto(appUrl({ type }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setGroupFilter(groupId: string | null) {
    goto(appUrl({ group: groupId }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function toggleLinkClusterFilter(transactionId: string) {
    goto(appUrl({ link: data.selectedLinkTransactionId ? null : transactionId }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function clearLinkClusterFilter() {
    goto(appUrl({ link: null }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  async function loadRefundLinkOptions(query: string) {
    if (!openRefundLinkTxId) return;

    const transaction = rows.find((row) => row.id === openRefundLinkTxId);
    if (!transaction) return;

    const linkedIds = new Set(transaction.refundLinks.map((link) => link.id));
    const params = new URLSearchParams({
      pageIndex: "0",
      pageSize: "25",
      sortBy: "occurredOn",
      sortDirection: "desc",
      type: "expense",
    });
    if (query.trim()) params.set("search", query.trim());

    const response = await fetch(`/api/accounts/${data.account.id}/transactions?${params}`);
    if (!response.ok) return;

    const page = await response.json();
    refundLinkOptions = page.rows.filter((row: { id: string }) => row.id !== openRefundLinkTxId && !linkedIds.has(row.id));
  }

  function openRefundLinkEditor(transaction: PageData["transactions"][number]) {
    openRefundLinkTxId = openRefundLinkTxId === transaction.id ? null : transaction.id;
    refundLinkSearch = "";
    refundLinkOptions = [];
    if (openRefundLinkTxId) {
      void loadRefundLinkOptions("");
    }
  }

  async function attachRefundLink(creditTransactionId: string, expenseTransactionId: string) {
    savingRefundLinkId = creditTransactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${creditTransactionId}/refund-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseTransactionId }),
      });
      if (!response.ok) return;
      await invalidateAll();
    } finally {
      savingRefundLinkId = null;
    }
  }

  async function detachRefundLink(creditTransactionId: string, expenseTransactionId: string) {
    savingRefundLinkId = creditTransactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${creditTransactionId}/refund-links/${expenseTransactionId}`, {
        method: "DELETE",
      });
      if (!response.ok) return;
      await invalidateAll();
    } finally {
      savingRefundLinkId = null;
    }
  }

  function refundLinkLabel(link: PageData["transactions"][number]["refundLinks"][number]) {
    const merchant = link.merchant ?? "Expense";
    return `${link.occurredOn} · ${merchant}`;
  }

  function warningPreview(transaction: PageData["transactions"][number]) {
    return transaction.warnings.map((warning) => warning.message).join(" · ");
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    try {
      const nextPage = pageIndex + 1;
      const params = transactionQueryParams(nextPage);
      const response = await fetch(`/api/accounts/${data.account.id}/transactions?${params}`);
      if (!response.ok) return;
      const page = await response.json();
      rows = [...rows, ...page.rows];
      pageIndex = nextPage;
      hasMore = page.hasMore;
    } finally {
      loading = false;
    }
  }

  function displayAmount(type: string, amountMinor: number) {
    return type === "expense" ? -amountMinor : amountMinor;
  }

  function categoriesForType(type: string, categoryId?: string | null) {
    const matching = data.categories.filter((category) => category.kind === type);
    if (!categoryId || matching.some((category) => category.id === categoryId)) {
      return matching;
    }

    const current = data.categories.find((category) => category.id === categoryId);
    return current ? [current, ...matching] : matching;
  }

  async function updateTransactionCategory(transactionId: string, categoryId: string | null) {
    savingCategoryId = transactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!response.ok) return;

      const category = categoryId ? data.categories.find((entry) => entry.id === categoryId) : null;
      rows = rows.map((row) =>
        row.id === transactionId
          ? {
              ...row,
              categoryId: categoryId ?? null,
              categoryName: category?.name ?? null,
              categoryColor: category?.colorHex ?? null,
            }
          : row
      );
    } finally {
      savingCategoryId = null;
    }
  }

  async function updateTransactionNotes(transactionId: string, nextNotes: string, previousNotes: string) {
    const normalized = nextNotes.trim();
    if (normalized === previousNotes.trim()) return;

    savingNotesId = transactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: normalized }),
      });
      if (!response.ok) return;

      rows = rows.map((row) => (row.id === transactionId ? { ...row, notes: normalized || null } : row));
    } finally {
      savingNotesId = null;
    }
  }

  function openNoteEditor(transaction: PageData["transactions"][number]) {
    if (openNoteTxId && openNoteTxId !== transaction.id) {
      const previous = rows.find((row) => row.id === openNoteTxId);
      if (previous) void saveNoteEditor(previous.id, previous.notes ?? "");
    }

    if (openNoteTxId === transaction.id) {
      void saveNoteEditor(transaction.id, transaction.notes ?? "");
      return;
    }

    openNoteTxId = transaction.id;
    noteDraft = transaction.notes ?? "";
  }

  async function saveNoteEditor(transactionId: string, previousNotes: string) {
    await updateTransactionNotes(transactionId, noteDraft, previousNotes);
    openNoteTxId = null;
  }

  function handleNoteKeydown(event: KeyboardEvent, transaction: PageData["transactions"][number]) {
    if (event.key !== "Enter") return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const textarea = event.currentTarget as HTMLTextAreaElement;
      const start = textarea.selectionStart ?? noteDraft.length;
      const end = textarea.selectionEnd ?? noteDraft.length;
      noteDraft = `${noteDraft.slice(0, start)}\n${noteDraft.slice(end)}`;
      queueMicrotask(() => {
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = start + 1;
      });
      return;
    }

    event.preventDefault();
    void saveNoteEditor(transaction.id, transaction.notes ?? "");
  }

  function availableTagsFor(transaction: PageData["transactions"][number]) {
    const attached = new Set(transaction.tags.map((tag) => tag.id));
    return data.tags.filter((tag) => !attached.has(tag.id));
  }

  async function addTransactionTag(transactionId: string, tagId: string) {
    if (!tagId) return;

    savingTagTxId = transactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (!response.ok) return;

      const tag = data.tags.find((entry) => entry.id === tagId);
      if (!tag) return;

      rows = rows.map((row) =>
        row.id === transactionId
          ? {
              ...row,
              tags: [...row.tags, { id: tag.id, name: tag.name, colorHex: tag.colorHex }],
            }
          : row
      );
      openTagMenuTxId = null;
    } finally {
      savingTagTxId = null;
    }
  }

  async function removeTransactionTag(transactionId: string, tagId: string) {
    savingTagTxId = transactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/tags/${tagId}`, { method: "DELETE" });
      if (!response.ok) return;

      rows = rows.map((row) => (row.id === transactionId ? { ...row, tags: row.tags.filter((tag) => tag.id !== tagId) } : row));
    } finally {
      savingTagTxId = null;
    }
  }

  function groupLabelFor(transaction: PageData["transactions"][number]) {
    return transaction.groups.map((group) => group.name).join(", ");
  }

  function primaryGroupId(transaction: PageData["transactions"][number]) {
    return transaction.groups[0]?.id ?? "";
  }

  async function setTransactionGroup(transactionId: string, groupId: string | null) {
    const transaction = rows.find((row) => row.id === transactionId);
    if (!transaction) return;

    savingGroupTxId = transactionId;
    try {
      for (const group of transaction.groups) {
        const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/groups/${group.id}`, { method: "DELETE" });
        if (!response.ok) return;
      }

      if (groupId) {
        const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId }),
        });
        if (!response.ok) return;
      }

      const group = groupId ? data.groups.find((entry) => entry.id === groupId) : null;
      if (data.selectedGroupId && groupId !== data.selectedGroupId) {
        rows = rows.filter((row) => row.id !== transactionId);
      } else {
        rows = rows.map((row) =>
          row.id === transactionId
            ? {
                ...row,
                groups: group ? [{ id: group.id, name: group.name, colorHex: group.colorHex }] : [],
              }
            : row
        );
      }
      openGroupTxId = null;
    } finally {
      savingGroupTxId = null;
    }
  }

  async function toggleGroupHidden(transactionId: string, hidden: boolean) {
    if (!data.selectedGroupId) return;

    savingGroupHiddenId = transactionId;
    try {
      const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/groups/${data.selectedGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!response.ok) return;

      rows = rows.map((row) => (row.id === transactionId ? { ...row, groupHidden: hidden } : row));
      await invalidateAll();
    } finally {
      savingGroupHiddenId = null;
    }
  }
</script>

<svelte:head><title>Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1><span>CHHAN</span><span class="acid"> CHHAN</span></h1>
    <AppNav />
  </div>
  <div class="actions">
    <input
      type="search"
      placeholder="search…"
      aria-label="Search transactions"
      value={searchInput}
      oninput={(e) => handleSearchInput(e.currentTarget.value)}
    />
    <a class="cta" href="/app/control">IMPORT</a>
    <AppSettings />
  </div>
</header>

{#if data.currentBalance}
  <section class="balance-card" class:stale={data.currentBalance.isStale}>
    <span class="balance-k">Balance</span>
    <span class="balance-v">{formatMoney(data.currentBalance.balanceMinor, data.account.currencyCode)}</span>
    <span class="balance-asof dim">
      {#if data.currentBalance.isStale}
        as of {data.currentBalance.asOf} · latest txn {data.currentBalance.latestTransactionOn} —
        <a href="/app/control">re-import statement</a> to refresh
      {:else}
        as of {data.currentBalance.asOf}
      {/if}
    </span>
  </section>
{/if}

<section class="stats-block">
  <div class="stats-head">
    <div class="stats-label">
      <span>Summary</span>
      {#if data.summaryPeriod === "month"}
        <select class="period-select" aria-label="Select month" value={data.selectedMonth} onchange={(e) => setSummaryMonth(e.currentTarget.value)}>
          {#each data.summaryMonths as monthKey}
            <option value={monthKey}>{formatMonthKeyShort(monthKey)}</option>
          {/each}
        </select>
      {:else if data.summaryPeriod === "year"}
        <select
          class="period-select"
          aria-label="Select year"
          value={String(data.selectedYear)}
          onchange={(e) => setSummaryYear(Number(e.currentTarget.value))}
        >
          {#each data.summaryYears as year (year)}
            <option value={String(year)}>{year}</option>
          {/each}
        </select>
      {:else}
        <span class="period-static">All time</span>
      {/if}
    </div>
    <div class="head-filters">
      <div class="period-tabs" role="tablist" aria-label="Summary period">
        <button
          type="button"
          role="tab"
          class:active={data.summaryPeriod === "month"}
          aria-selected={data.summaryPeriod === "month"}
          onclick={() => setSummaryPeriod("month")}
        >
          Month
        </button>
        <button
          type="button"
          role="tab"
          class:active={data.summaryPeriod === "year"}
          aria-selected={data.summaryPeriod === "year"}
          onclick={() => setSummaryPeriod("year")}
        >
          Year
        </button>
        <button
          type="button"
          role="tab"
          class:active={data.summaryPeriod === "all"}
          aria-selected={data.summaryPeriod === "all"}
          onclick={() => setSummaryPeriod("all")}
        >
          All
        </button>
      </div>
      {#if data.groups.length > 0}
        <div class="period-tabs group-filter-wrap">
          <select
            class="group-filter"
            aria-label="Filter by group"
            value={data.selectedGroupId ?? ""}
            onchange={(e) => setGroupFilter(e.currentTarget.value || null)}
          >
            <option value="">All groups</option>
            {#each data.groups as group (group.id)}
              <option value={group.id}>{group.name}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
  </div>
  <section class="stats">
    <button
      type="button"
      class="stat net"
      class:active={!data.transactionTypeFilter}
      aria-pressed={!data.transactionTypeFilter}
      onclick={() => setTypeFilter(null)}
    >
      <span class="k">{data.summaryPrefix} NET</span>
      <span class="v">{formatMoney(data.summary.netMinor, data.account.currencyCode)}</span>
    </button>
    <button
      type="button"
      class="stat"
      class:active={data.transactionTypeFilter === "income"}
      aria-pressed={data.transactionTypeFilter === "income"}
      onclick={() => setTypeFilter("income")}
    >
      <span class="k">{data.summaryPrefix} IN</span>
      <span class="v pos">{formatMoney(data.summary.incomeMinor, data.account.currencyCode)}</span>
    </button>
    <button
      type="button"
      class="stat"
      class:active={data.transactionTypeFilter === "expense"}
      aria-pressed={data.transactionTypeFilter === "expense"}
      onclick={() => setTypeFilter("expense")}
    >
      <span class="k">{data.summaryPrefix} OUT</span>
      <span class="v neg">{formatMoney(-data.summary.expenseMinor, data.account.currencyCode)}</span>
    </button>
    <article class="stat">
      <span class="k">{data.summaryPrefix} SAVED</span>
      <span class="v">{Math.round(data.summary.savingsRate * 100)}%</span>
    </article>
  </section>
</section>

{#if data.budgetUsage.length}
  <section class="meters">
    {#each data.budgetUsage as b}
      <div class="meter">
        <div class="meter-top"><span>{b.name}</span><span>{b.pct}%</span></div>
        <div class="track"><div class="fill" style="width:{b.pct}%; background:{b.color}"></div></div>
      </div>
    {/each}
  </section>
{/if}

{#if data.selectedLinkTransactionId}
  <div class="link-filter-banner">
    <span>
      Showing {data.linkClusterSize} linked refund{data.linkClusterSize === 1 ? "" : "s"}
      <span class="dim">· period filter ignored</span>
    </span>
    <button type="button" class="link-filter-clear" onclick={clearLinkClusterFilter}>Show all</button>
  </div>
{/if}

<section class="table-block">
  <table>
    <thead>
      <tr>
        <th>
          <button
            type="button"
            class="sort-btn"
            aria-label="Sort by date, {data.sortDirection === 'desc' ? 'newest first' : 'oldest first'}"
            onclick={toggleDateSort}
          >
            Date
            <span class="sort-mark" aria-hidden="true">{data.sortDirection === "desc" ? "↓" : "↑"}</span>
          </button>
        </th>
        <th>Merchant</th>
        <th>Category</th>
        <th>Tags</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      {#if rows.length === 0}
        <tr>
          <td colspan="5" class="dim empty-row">
            {#if data.searchQuery?.trim()}
              No transactions match “{data.searchQuery}”.
            {:else if data.selectedLinkTransactionId}
              No linked transactions found for this refund set.
            {:else if data.selectedGroupId}
              No transactions in this group for the selected period.
            {:else if data.transactionTypeFilter === "income"}
              No credits match this filter.
            {:else if data.transactionTypeFilter === "expense"}
              No debits match this filter.
            {:else}
              No transactions yet. Import a bank statement from Control.
            {/if}
          </td>
        </tr>
      {:else}
        {#each rows as t (t.id)}
          <tr class:group-hidden={Boolean(data.selectedGroupId && t.groupHidden)}>
            <td class="mono dim">{t.occurredOn}</td>
            <td class="merchant-cell">
              <div class="merchant-row">
                <span class="merchant">{t.merchant ?? "—"}</span>
                {#if t.refundLinks.length > 0}
                  <div class="refund-cluster-wrap">
                    <button
                      type="button"
                      class="refund-cluster-btn"
                      class:active={Boolean(data.selectedLinkTransactionId)}
                      aria-label={data.selectedLinkTransactionId ? "Show all transactions" : "Show linked transactions only"}
                      aria-pressed={Boolean(data.selectedLinkTransactionId)}
                      onclick={() => toggleLinkClusterFilter(t.id)}
                    >
                      <ArrowLeftRight size={12} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <span class="refund-cluster-preview" role="tooltip">
                      {t.refundLinks.length} linked · click to {data.selectedLinkTransactionId ? "show all" : "filter"}
                    </span>
                  </div>
                {/if}
                {#if t.warnings.length > 0}
                  <div class="warning-wrap">
                    <span class="warning-btn" aria-label="Transaction warning">
                      <TriangleAlert size={12} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span class="warning-preview" role="tooltip">{warningPreview(t)}</span>
                  </div>
                {/if}
                {#if isRefundCategoryName(t.categoryName)}
                  <div class="refund-link-wrap">
                    <button
                      type="button"
                      class="refund-link-btn"
                      class:has-links={t.refundLinks.length > 0}
                      aria-label="{t.refundLinks.length ? 'Edit refund links' : 'Link to expenses'} for {t.merchant ?? 'transaction'}"
                      aria-expanded={openRefundLinkTxId === t.id}
                      disabled={savingRefundLinkId === t.id}
                      onclick={() => openRefundLinkEditor(t)}
                    >
                      <Link size={12} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    {#if openRefundLinkTxId === t.id}
                      <div class="refund-link-popup" role="dialog" aria-label="Refund links">
                        {#if t.refundLinks.length > 0}
                          <ul class="refund-link-list">
                            {#each t.refundLinks as link (link.id)}
                              <li>
                                <span>{refundLinkLabel(link)}</span>
                                <span class="mono dim">{formatMoney(link.amountMinor, data.account.currencyCode)}</span>
                                <button
                                  type="button"
                                  class="refund-link-remove"
                                  aria-label="Remove link to {link.merchant ?? 'expense'}"
                                  disabled={savingRefundLinkId === t.id}
                                  onclick={() => detachRefundLink(t.id, link.id)}
                                >
                                  ×
                                </button>
                              </li>
                            {/each}
                          </ul>
                        {/if}
                        <input
                          type="search"
                          class="refund-link-search"
                          placeholder="Search expenses…"
                          aria-label="Search expenses to link"
                          bind:value={refundLinkSearch}
                        />
                        <ul class="refund-link-options">
                          {#if refundLinkOptions.length === 0}
                            <li class="dim">No matching expenses</li>
                          {:else}
                            {#each refundLinkOptions as option (option.id)}
                              <li>
                                <button
                                  type="button"
                                  class="refund-link-option"
                                  disabled={savingRefundLinkId === t.id}
                                  onclick={() => attachRefundLink(t.id, option.id)}
                                >
                                  <span>{option.occurredOn} · {option.merchant ?? "—"}</span>
                                  <span class="mono dim">{formatMoney(option.amountMinor, data.account.currencyCode)}</span>
                                </button>
                              </li>
                            {/each}
                          {/if}
                        </ul>
                      </div>
                    {:else if t.refundLinks.length > 0}
                      <span class="refund-link-preview" role="tooltip">
                        {t.refundLinks.map((link) => refundLinkLabel(link)).join(", ")}
                      </span>
                    {/if}
                  </div>
                {/if}
                {#if data.selectedGroupId}
                  <button
                    type="button"
                    class="group-hidden-btn"
                    class:is-hidden={t.groupHidden}
                    aria-label="{t.groupHidden ? 'Show in group' : 'Hide in group'} for {t.merchant ?? 'transaction'}"
                    disabled={savingGroupHiddenId === t.id}
                    onclick={() => toggleGroupHidden(t.id, !t.groupHidden)}
                  >
                    {#if t.groupHidden}
                      <EyeOff size={12} strokeWidth={1.5} aria-hidden="true" />
                    {:else}
                      <Eye size={12} strokeWidth={1.5} aria-hidden="true" />
                    {/if}
                  </button>
                {/if}
                <div class="note-wrap">
                  <button
                    type="button"
                    class="note-btn"
                    class:has-note={Boolean(t.notes)}
                    aria-label="{t.notes ? 'Edit note' : 'Add note'} for {t.merchant ?? 'transaction'}"
                    aria-expanded={openNoteTxId === t.id}
                    disabled={savingNotesId === t.id}
                    onclick={() => openNoteEditor(t)}
                  >
                    <MessageSquare size={12} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                  {#if openNoteTxId === t.id}
                    <div class="note-popup" role="dialog" aria-label="Transaction note">
                      <textarea
                        class="note-textarea"
                        bind:value={noteDraft}
                        placeholder="Add a note…"
                        disabled={savingNotesId === t.id}
                        rows="3"
                        onkeydown={(e) => handleNoteKeydown(e, t)}
                      ></textarea>
                    </div>
                  {:else if t.notes}
                    <span class="note-preview" role="tooltip">{t.notes}</span>
                  {/if}
                </div>
                {#if data.groups.length > 0}
                  <div class="group-link-wrap">
                    <button
                      type="button"
                      class="group-link-btn"
                      class:has-group={t.groups.length > 0}
                      aria-label="{t.groups.length ? `Linked to ${groupLabelFor(t)}` : 'Link to group'} for {t.merchant ?? 'transaction'}"
                      aria-expanded={openGroupTxId === t.id}
                      disabled={savingGroupTxId === t.id}
                      onclick={() => (openGroupTxId = openGroupTxId === t.id ? null : t.id)}
                    >
                      <Layers size={12} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    {#if openGroupTxId === t.id}
                      <div class="group-popup" role="dialog" aria-label="Transaction group">
                        <select
                          id="group-{t.id}"
                          class="group-select"
                          aria-label="Link transaction to group"
                          value={primaryGroupId(t)}
                          disabled={savingGroupTxId === t.id}
                          onchange={(e) => setTransactionGroup(t.id, e.currentTarget.value ? e.currentTarget.value : null)}
                        >
                          <option value="">None</option>
                          {#each data.groups as group (group.id)}
                            <option value={group.id}>{group.name}</option>
                          {/each}
                        </select>
                      </div>
                    {:else if t.groups.length > 0}
                      <span class="group-preview" role="tooltip">{groupLabelFor(t)}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </td>
            <td class="category-cell">
              <label class="sr-only" for="category-{t.id}">Category for {t.merchant ?? "transaction"}</label>
              <div class="cat-picker">
                <span class="cat-bar" style="background:{t.categoryColor ?? 'var(--chrome-line)'}" aria-hidden="true"></span>
                <select
                  id="category-{t.id}"
                  class="cat-select"
                  value={t.categoryId ?? ""}
                  disabled={savingCategoryId === t.id}
                  onchange={(e) => updateTransactionCategory(t.id, e.currentTarget.value ? e.currentTarget.value : null)}
                >
                  <option value="">Uncategorized</option>
                  {#each categoriesForType(t.type, t.categoryId) as category (category.id)}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                </select>
              </div>
            </td>
            <td class="tags">
              <div class="tag-list">
                {#each t.tags as tag (tag.id)}
                  <span class="tag tx-tag" style="--tag-color: {tag.colorHex ?? '#ee7c02'}">
                    <Tag size={12} strokeWidth={1.25} class="tag-icon" aria-hidden="true" />
                    {tag.name}
                    <button
                      type="button"
                      class="tag-remove"
                      aria-label="Remove {tag.name}"
                      disabled={savingTagTxId === t.id}
                      onclick={() => removeTransactionTag(t.id, tag.id)}
                    >
                      ×
                    </button>
                  </span>
                {/each}
                {#if data.tags.length > 0 && availableTagsFor(t).length > 0}
                  <div class="tag-add-wrap">
                    <button
                      type="button"
                      class="tag-add-btn"
                      aria-label="Add tag to {t.merchant ?? 'transaction'}"
                      aria-expanded={openTagMenuTxId === t.id}
                      disabled={savingTagTxId === t.id}
                      onclick={() => (openTagMenuTxId = openTagMenuTxId === t.id ? null : t.id)}
                    >
                      <Plus size={12} strokeWidth={2} aria-hidden="true" />
                    </button>
                    {#if openTagMenuTxId === t.id}
                      <div class="tag-add-menu" role="menu">
                        {#each availableTagsFor(t) as tag (tag.id)}
                          <button type="button" role="menuitem" onclick={() => addTransactionTag(t.id, tag.id)}>
                            {tag.name}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else if t.tags.length === 0}
                  <span class="dim">—</span>
                {/if}
              </div>
            </td>
            <td class="right mono amt" class:pos={t.type === "income"} class:neg={t.type === "expense"}>
              {formatMoney(displayAmount(t.type, t.amountMinor), data.account.currencyCode)}
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>

  <div class="sentinel" use:infiniteScroll={{ onLoad: loadMore, disabled: loading || !hasMore }}>
    {#if loading}■ LOADING ■{:else if !hasMore}— END —{:else}↓ SCROLL ↓{/if}
  </div>
</section>

<style>
  .balance-card {
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    flex-wrap: wrap;
    margin-bottom: 0.85rem;
    padding: 0.75rem 0.9rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .balance-k {
    font-size: 0.66rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .balance-v {
    font-family: "Archivo Black", sans-serif;
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
    color: var(--main-text);
  }

  .balance-card.stale {
    border-color: color-mix(in srgb, var(--hi-purple) 55%, var(--chrome-line));
  }

  .balance-asof {
    font-size: 0.72rem;
    margin-left: auto;
    text-align: right;
    line-height: 1.4;
  }

  .balance-asof a {
    color: var(--hi-cyan);
  }

  .stats-block {
    margin-bottom: 0.85rem;
  }

  .stats-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.45rem;
    flex-wrap: wrap;
  }

  .head-filters {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .group-filter-wrap {
    padding: 0;
    overflow: hidden;
  }

  .period-tabs button,
  .group-filter {
    --period-tab-height: 1.625rem;
    box-sizing: border-box;
    height: var(--period-tab-height);
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
  }

  .group-filter {
    display: block;
    min-width: 7rem;
    width: 100%;
    margin: 0;
    padding: 0 1.65rem 0 0.65rem;
    border: none;
    background: var(--surface2)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23e8e4f0' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")
      no-repeat right 0.55rem center;
    color: var(--main-text);
    line-height: var(--period-tab-height);
    text-transform: uppercase;
    cursor: pointer;
    appearance: none;
  }

  .group-filter:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--hi-focus);
  }

  .group-filter option {
    text-transform: none;
    letter-spacing: 0.04em;
  }

  .stats-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .period-select {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.35rem 0.45rem;
    font-family: inherit;
    font-size: 0.68rem;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: none;
    min-width: 0;
    width: auto;
    cursor: pointer;
    vertical-align: middle;
  }

  .period-select:focus {
    outline: none;
    border-color: var(--hi-focus);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--hi-focus) 45%, transparent);
  }

  .period-static {
    font-size: 0.68rem;
    line-height: 1;
    color: var(--main-text);
    letter-spacing: 0.04em;
    text-transform: none;
  }

  .period-tabs {
    display: inline-flex;
    border: 2px solid var(--chrome-line);
  }

  .period-tabs button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    border: none;
    border-right: 2px solid var(--chrome-line);
    color: var(--muted);
    padding: 0 0.65rem;
    text-transform: uppercase;
    cursor: pointer;
  }

  .period-tabs button:last-child {
    border-right: none;
  }

  .period-tabs button.active {
    background: var(--hi-purple);
    color: var(--background);
  }

  .period-tabs button:hover:not(.active) {
    color: var(--hi-purple);
  }

  .empty-row {
    text-align: center;
    padding: 1.5rem !important;
  }

  .merchant-cell {
    min-width: 8rem;
  }

  .merchant-row {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 100%;
  }

  .merchant-row .merchant {
    min-width: 0;
  }

  .note-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .note-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .note-btn.has-note,
  .note-btn:hover,
  .note-btn[aria-expanded="true"] {
    color: var(--hi-cyan);
  }

  .note-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .note-preview {
    position: absolute;
    left: calc(100% + 0.35rem);
    top: 50%;
    transform: translateY(-50%);
    z-index: 15;
    width: max-content;
    max-width: 16rem;
    padding: 0.45rem 0.55rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 3px 3px 0 rgba(234, 242, 240, 0.12);
    color: var(--main-text);
    font-size: 0.72rem;
    line-height: 1.35;
    white-space: normal;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
  }

  .note-wrap:has(.note-btn.has-note):hover .note-preview {
    opacity: 1;
    visibility: visible;
  }

  .note-popup {
    position: absolute;
    left: calc(100% + 0.35rem);
    top: 50%;
    transform: translateY(-50%);
    z-index: 25;
    width: 14rem;
    padding: 0.45rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .note-textarea {
    width: 100%;
    min-height: 4.5rem;
    resize: vertical;
    background: var(--surface2);
    border: none;
    color: var(--main-text);
    padding: 0.4rem 0.45rem;
    font-family: inherit;
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .note-textarea:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--hi-focus);
  }

  .group-link-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .group-link-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .group-link-btn.has-group,
  .group-link-btn:hover,
  .group-link-btn[aria-expanded="true"] {
    color: var(--hi-purple);
  }

  .group-link-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  tr.group-hidden {
    opacity: 0.45;
  }

  tr.group-hidden .merchant,
  tr.group-hidden .amt {
    color: var(--muted);
  }

  .group-hidden-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .group-hidden-btn:hover,
  .group-hidden-btn.is-hidden {
    color: var(--hi-cyan);
  }

  .group-hidden-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .link-filter-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
    padding: 0.55rem 0.75rem;
    background: color-mix(in srgb, var(--hi-green) 12%, var(--surface));
    border: 2px solid color-mix(in srgb, var(--hi-green) 45%, var(--chrome-line));
    font-size: 0.74rem;
  }

  .link-filter-clear {
    border: none;
    background: transparent;
    color: var(--hi-green);
    cursor: pointer;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .refund-cluster-wrap,
  .refund-link-wrap,
  .warning-wrap {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }

  .refund-cluster-btn,
  .refund-link-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .refund-cluster-btn:hover,
  .refund-cluster-btn.active {
    color: var(--hi-green);
  }

  .refund-link-btn.has-links,
  .refund-link-btn:hover,
  .refund-link-btn[aria-expanded="true"] {
    color: var(--brand-accent-light);
  }

  .refund-link-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .warning-btn {
    display: inline-flex;
    align-items: center;
    color: var(--brand-accent);
  }

  .refund-cluster-preview,
  .refund-link-preview,
  .warning-preview {
    position: absolute;
    left: calc(100% + 0.35rem);
    top: 50%;
    transform: translateY(-50%);
    z-index: 15;
    width: max-content;
    max-width: 16rem;
    padding: 0.45rem 0.55rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 3px 3px 0 rgba(234, 242, 240, 0.12);
    color: var(--main-text);
    font-size: 0.72rem;
    line-height: 1.35;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .refund-cluster-wrap:hover .refund-cluster-preview,
  .refund-link-wrap:has(.refund-link-btn.has-links):hover .refund-link-preview,
  .warning-wrap:hover .warning-preview {
    opacity: 1;
    visibility: visible;
  }

  .refund-link-popup {
    position: absolute;
    left: 0;
    top: calc(100% + 0.35rem);
    z-index: 20;
    width: min(18rem, 70vw);
    padding: 0.55rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .refund-link-list,
  .refund-link-options {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .refund-link-list li,
  .refund-link-options li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
  }

  .refund-link-list li + li,
  .refund-link-options li + li {
    margin-top: 0.35rem;
  }

  .refund-link-remove {
    margin-left: auto;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .refund-link-search {
    width: 100%;
    margin-top: 0.45rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--chrome-line);
    background: transparent;
    color: var(--main-text);
    font-size: 0.72rem;
  }

  .refund-link-options {
    margin-top: 0.45rem;
    max-height: 10rem;
    overflow: auto;
  }

  .refund-link-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.25rem 0;
    border: none;
    background: transparent;
    color: var(--main-text);
    cursor: pointer;
    text-align: left;
    font-size: 0.72rem;
  }

  .refund-link-option:hover {
    color: var(--hi-cyan);
  }

  .group-preview {
    position: absolute;
    left: calc(100% + 0.35rem);
    top: 50%;
    transform: translateY(-50%);
    z-index: 15;
    width: max-content;
    max-width: 14rem;
    padding: 0.45rem 0.55rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 3px 3px 0 rgba(234, 242, 240, 0.12);
    color: var(--main-text);
    font-size: 0.72rem;
    line-height: 1.35;
    white-space: normal;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
  }

  .group-link-wrap:has(.group-link-btn.has-group):hover .group-preview {
    opacity: 1;
    visibility: visible;
  }

  .group-popup {
    position: absolute;
    left: calc(100% + 0.35rem);
    top: 50%;
    transform: translateY(-50%);
    z-index: 25;
    width: 12rem;
    padding: 0.45rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .group-select {
    width: 100%;
    background: var(--surface2);
    border: none;
    color: var(--main-text);
    padding: 0.4rem 0.45rem;
    font-family: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .group-select:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--hi-focus);
  }

  .note-textarea:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    cursor: pointer;
  }

  .sort-btn:hover {
    color: var(--hi-green);
  }

  .sort-mark {
    color: var(--hi-cyan);
    font-size: 0.75rem;
    line-height: 1;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .category-cell {
    min-width: 9rem;
  }

  .cat-picker {
    display: flex;
    align-items: stretch;
    max-width: 12rem;
    background: var(--surface2);
  }

  .cat-bar {
    width: 4px;
    flex-shrink: 0;
  }

  .cat-select {
    flex: 1;
    min-width: 0;
    width: 100%;
    background: var(--surface2);
    border: none;
    color: var(--main-text);
    padding: 0.3rem 0.45rem;
    font-family: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    appearance: none;
  }

  .cat-select:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--hi-focus);
  }

  .cat-select option {
    background: var(--surface2);
    color: var(--main-text);
  }

  .cat-select:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .tx-tag {
    gap: 0.25rem;
  }

  .tag-remove {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    margin-left: 0.1rem;
    line-height: 1;
    font-size: 0.85rem;
  }

  .tag-remove:hover:not(:disabled) {
    color: var(--main-text);
  }

  .tag-remove:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .tag-add-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .tag-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.35rem;
    height: 1.35rem;
    background: var(--surface2);
    border: 1px solid color-mix(in srgb, var(--hi-purple) 32%, transparent);
    color: var(--muted);
    padding: 0;
    cursor: pointer;
  }

  .tag-add-btn:hover:not(:disabled),
  .tag-add-wrap:has(.tag-add-menu) .tag-add-btn {
    color: var(--hi-green);
    border-color: var(--hi-green);
  }

  .tag-add-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .tag-add-menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    min-width: 8rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 3px 3px 0 color-mix(in srgb, var(--hi-purple) 25%, transparent);
    z-index: 15;
    display: flex;
    flex-direction: column;
  }

  .tag-add-menu button {
    background: none;
    border: none;
    border-bottom: 1px solid var(--table-line);
    color: var(--main-text);
    font-family: inherit;
    font-size: 0.68rem;
    padding: 0.45rem 0.55rem;
    text-align: left;
    cursor: pointer;
  }

  .tag-add-menu button:last-child {
    border-bottom: none;
  }

  .tag-add-menu button:hover {
    background: color-mix(in srgb, var(--hi-cyan) 10%, var(--surface2));
    color: var(--hi-green);
  }
</style>
