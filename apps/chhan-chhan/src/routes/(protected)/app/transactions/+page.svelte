<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import Tag from "@lucide/svelte/icons/tag";
  import Plus from "@lucide/svelte/icons/plus";
  import StickyNote from "@lucide/svelte/icons/sticky-note";
  import Layers from "@lucide/svelte/icons/layers";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import Calculator from "@lucide/svelte/icons/calculator";
  import { formatMoney } from "$lib/finance/money";
  import { buildSummarySelection, formatMonthKeyShort, summarySelectionToDateRange, type SummaryPeriod } from "$lib/finance/summary";
  import { serializeMultiFilterParam } from "$lib/finance/filter-params";
  import { infiniteScroll } from "$lib/actions/infinite-scroll";
  import FilterMultiselect from "$lib/components/filter-multiselect.svelte";
  import AppNav from "$lib/components/app-nav.svelte";
  import AppSettings from "$lib/components/app-settings.svelte";
  import SmartTagPopup, { type SmartTagToggle } from "$lib/components/smart-tag-popup.svelte";
  import CalculateWidget from "$lib/components/calculate-widget.svelte";
  import SketchSelect from "$lib/components/sketch-select.svelte";
  import BrandMark from "$lib/components/brand-mark.svelte";
  import type { SmartTagApplyMode, SmartTaggingPreview } from "$lib/server/finance";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let rows = $state<PageData["transactions"]>([]);
  let pageIndex = $state(0);
  let loading = $state(false);
  let hasMore = $state(false);
  let searchInput = $state("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let savingNotesId = $state<string | null>(null);
  let savingTagTxId = $state<string | null>(null);
  let openTagMenuTxId = $state<string | null>(null);
  let savingSpaceTxId = $state<string | null>(null);
  let openSpaceTxId = $state<string | null>(null);
  let openNoteTxId = $state<string | null>(null);
  let noteDraft = $state("");
  let smartTagOpen = $state(false);
  let smartTagApplying = $state(false);
  let smartTagMode = $state<SmartTagApplyMode>("append");
  let smartTagPreview = $state<SmartTaggingPreview | null>(null);
  let smartTagToggles = $state<SmartTagToggle[]>([]);
  let smartTagContext = $state<{
    transactionId: string;
    merchant: string;
    type: PageData["transactions"][number]["type"];
    newTagId: string;
    previousTags: PageData["transactions"][number]["tags"];
  } | null>(null);
  let calculateModeActive = $state(false);
  let calculateSelectionIds = $state<string[]>([]);

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
    if (data.selectedSpaceId) params.set("spaceId", data.selectedSpaceId);
    if (data.selectedTagIds.length) {
      params.set("tagIds", serializeMultiFilterParam(data.selectedTagIds));
    }
    if (data.searchQuery?.trim()) params.set("search", data.searchQuery.trim());
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
    if (!smartTagOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !smartTagApplying) closeSmartTag(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  $effect(() => {
    if (!openSpaceTxId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".space-link-wrap")) return;
      openSpaceTxId = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") openSpaceTxId = null;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  $effect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;

      if (event.key === "Escape" && calculateModeActive) {
        exitCalculateMode();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
        event.preventDefault();
        toggleCalculateMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function appUrl(
    updates: {
      sort?: "asc" | "desc";
      summary?: SummaryPeriod;
      month?: string;
      year?: number;
      type?: "income" | "expense" | null;
      space?: string | null;
      tag?: string[] | null;
      search?: string | null;
    } = {}
  ) {
    const params = new URLSearchParams();
    const sort = updates.sort ?? data.sortDirection;
    const summary = updates.summary ?? data.summaryPeriod;
    const month = updates.month ?? data.selectedMonth;
    const year = updates.year ?? data.selectedYear;
    const typeFilter = updates.type === undefined ? data.transactionTypeFilter : updates.type;
    const spaceFilter = updates.space === undefined ? data.selectedSpaceId : updates.space;
    const tagFilter = updates.tag === undefined ? data.selectedTagIds : (updates.tag ?? []);
    const searchFilter = updates.search === undefined ? (data.searchQuery ?? "") : (updates.search ?? "");

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
    if (spaceFilter) params.set("space", spaceFilter);
    if (tagFilter.length) params.set("tag", serializeMultiFilterParam(tagFilter));
    if (searchFilter.trim()) params.set("search", searchFilter.trim());

    const query = params.toString();
    return query ? `/app/transactions?${query}` : "/app/transactions";
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

  function setSpaceFilter(spaceId: string | null) {
    goto(appUrl({ space: spaceId }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setTagFilters(tagIds: string[]) {
    goto(appUrl({ tag: tagIds }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function selectedTagLabels(): string {
    return data.selectedTagIds
      .map((id) => {
        if (id === "untagged") return "Untagged";
        return data.tags.find((entry) => entry.id === id)?.name ?? "tag";
      })
      .join(", ");
  }

  const tagFilterOptions = $derived([{ id: "untagged", label: "Untagged" }, ...data.tags.map((tag) => ({ id: tag.id, label: tag.name }))]);

  const selectedSpaceName = $derived(data.spaces.find((space) => space.id === data.selectedSpaceId)?.name ?? "this space");

  const calculateStats = $derived.by(() => {
    const selected = new Set(calculateSelectionIds);
    let count = 0;
    let sumMinor = 0;

    for (const row of rows) {
      if (!selected.has(row.id)) continue;
      count += 1;
      sumMinor += displayAmount(row.type, row.amountMinor);
    }

    return { count, sumMinor };
  });

  function isCalculateSelected(transactionId: string) {
    return calculateSelectionIds.includes(transactionId);
  }

  function toggleCalculateSelection(transactionId: string) {
    if (calculateSelectionIds.includes(transactionId)) {
      calculateSelectionIds = calculateSelectionIds.filter((id) => id !== transactionId);
      return;
    }
    calculateSelectionIds = [...calculateSelectionIds, transactionId];
  }

  function enterCalculateMode() {
    openNoteTxId = null;
    openSpaceTxId = null;
    openTagMenuTxId = null;
    closeSmartTag(true);
    calculateModeActive = true;
  }

  function exitCalculateMode() {
    calculateModeActive = false;
    calculateSelectionIds = [];
  }

  function toggleCalculateMode() {
    if (calculateModeActive) exitCalculateMode();
    else enterCalculateMode();
  }

  function clearCalculateSelection() {
    calculateSelectionIds = [];
  }

  function isRowInteractiveTarget(target: HTMLElement) {
    return Boolean(target.closest("button, select, textarea, input, a"));
  }

  function handleCalculateRowClick(event: MouseEvent, transaction: PageData["transactions"][number]) {
    if (!calculateModeActive) return;
    if (isRowInteractiveTarget(event.target as HTMLElement)) return;
    toggleCalculateSelection(transaction.id);
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

  function applyTagToRows(transactionId: string, tags: PageData["transactions"][number]["tags"]) {
    rows = rows.map((row) => (row.id === transactionId ? { ...row, tags: [...tags] } : row));
  }

  function tagProfileKey(tagIds: string[] | null): string {
    return tagIds?.length ? [...tagIds].sort().join(",") : "none";
  }

  function buildSmartTagToggles(preview: SmartTaggingPreview): SmartTagToggle[] {
    const toggles: SmartTagToggle[] = [];
    if (preview.exact) {
      for (const profile of preview.exact.profiles) {
        toggles.push({
          merchant: preview.exact.merchant,
          fromTagIds: profile.tagIds.length ? profile.tagIds : null,
          enabled: true,
        });
      }
    }
    for (const group of preview.fuzzy) {
      for (const profile of group.profiles) {
        toggles.push({
          merchant: group.merchant,
          fromTagIds: profile.tagIds.length ? profile.tagIds : null,
          enabled: true,
        });
      }
    }
    return toggles;
  }

  function closeSmartTag(revertTransaction = true) {
    if (revertTransaction && smartTagContext) {
      applyTagToRows(smartTagContext.transactionId, smartTagContext.previousTags);
    }
    smartTagOpen = false;
    smartTagPreview = null;
    smartTagContext = null;
    smartTagToggles = [];
    smartTagMode = "append";
  }

  function handleSmartTagToggle(key: string, enabled: boolean) {
    smartTagToggles = smartTagToggles.map((toggle) =>
      `${toggle.merchant}::${tagProfileKey(toggle.fromTagIds)}` === key ? { ...toggle, enabled } : toggle
    );
  }

  function rowMatchesTagMigration(row: PageData["transactions"][number], migration: SmartTagToggle, newTagId: string, mode: SmartTagApplyMode) {
    if (!migration.enabled) return false;
    if (migration.merchant.trim().toLowerCase() !== (row.merchant ?? "").trim().toLowerCase()) {
      return false;
    }

    const rowTagIds = row.tags.map((tag) => tag.id).sort();
    const fromTagIds = migration.fromTagIds?.slice().sort() ?? [];
    const matchesProfile =
      migration.fromTagIds === null
        ? rowTagIds.length === 0
        : rowTagIds.length === fromTagIds.length && rowTagIds.every((id, index) => id === fromTagIds[index]);

    if (!matchesProfile) return false;
    if (mode === "append" && rowTagIds.includes(newTagId)) return false;
    return true;
  }

  function tagsAfterSmartApply(
    currentTags: PageData["transactions"][number]["tags"],
    newTag: { id: string; name: string; colorHex: string | null },
    mode: SmartTagApplyMode
  ) {
    if (mode === "replace") {
      return [{ id: newTag.id, name: newTag.name, colorHex: newTag.colorHex }];
    }
    if (currentTags.some((tag) => tag.id === newTag.id)) return currentTags;
    return [...currentTags, { id: newTag.id, name: newTag.name, colorHex: newTag.colorHex }];
  }

  async function applySmartTag(includeBulk: boolean) {
    if (!smartTagContext) return;

    smartTagApplying = true;
    try {
      if (!includeBulk) {
        const ok = await addTransactionTagDirect(smartTagContext.transactionId, smartTagContext.newTagId);
        if (ok) closeSmartTag(false);
        return;
      }

      const response = await fetch(`/api/accounts/${data.account.id}/transactions/smart-tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTransactionId: smartTagContext.transactionId,
          newTagId: smartTagContext.newTagId,
          type: smartTagContext.type,
          mode: smartTagMode,
          migrations: smartTagToggles,
        }),
      });
      if (!response.ok) return;

      const tag = data.tags.find((entry) => entry.id === smartTagContext!.newTagId);
      if (!tag) return;

      rows = rows.map((row) => {
        const matched = smartTagToggles.some((migration) => rowMatchesTagMigration(row, migration, smartTagContext!.newTagId, smartTagMode));

        if (row.id === smartTagContext!.transactionId || matched) {
          return {
            ...row,
            tags: tagsAfterSmartApply(row.tags, tag, smartTagMode),
          };
        }
        return row;
      });

      closeSmartTag(false);
      await invalidateAll();
    } finally {
      smartTagApplying = false;
    }
  }

  async function addTransactionTagDirect(transactionId: string, tagId: string): Promise<boolean> {
    const response = await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (!response.ok) return false;

    const tag = data.tags.find((entry) => entry.id === tagId);
    if (!tag) return false;

    rows = rows.map((row) =>
      row.id === transactionId
        ? {
            ...row,
            tags: [...row.tags, { id: tag.id, name: tag.name, colorHex: tag.colorHex }],
          }
        : row
    );
    openTagMenuTxId = null;
    return true;
  }

  async function handleAddTag(transaction: PageData["transactions"][number], tagId: string) {
    if (!tagId || transaction.tags.some((tag) => tag.id === tagId)) return;

    const merchant = transaction.merchant?.trim();
    if (!merchant) {
      await addTransactionTag(transaction.id, tagId);
      return;
    }

    const tag = data.tags.find((entry) => entry.id === tagId);
    if (!tag) return;

    const previousTags = transaction.tags.map((entry) => ({ ...entry }));
    applyTagToRows(transaction.id, tagsAfterSmartApply(previousTags, tag, "append"));
    savingTagTxId = transaction.id;
    openTagMenuTxId = null;

    try {
      const params = new URLSearchParams({
        merchant,
        newTagId: tagId,
        sourceTransactionId: transaction.id,
        type: transaction.type,
      });

      const response = await fetch(`/api/accounts/${data.account.id}/transactions/smart-tag?${params.toString()}`);
      if (!response.ok) {
        applyTagToRows(transaction.id, previousTags);
        return;
      }

      const body = (await response.json()) as { preview: SmartTaggingPreview | null };
      if (!body.preview) {
        await addTransactionTagDirect(transaction.id, tagId);
        return;
      }

      smartTagContext = {
        transactionId: transaction.id,
        merchant,
        type: transaction.type,
        newTagId: tagId,
        previousTags,
      };
      smartTagPreview = body.preview;
      smartTagToggles = buildSmartTagToggles(body.preview);
      smartTagMode = "append";
      smartTagOpen = true;
    } catch {
      applyTagToRows(transaction.id, previousTags);
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

  function spaceLabelFor(transaction: PageData["transactions"][number]) {
    return transaction.spaces.map((space) => space.name).join(", ");
  }

  function isInSpace(transaction: PageData["transactions"][number], spaceId: string) {
    return transaction.spaces.some((space) => space.id === spaceId);
  }

  async function toggleTransactionSpace(transactionId: string, spaceId: string) {
    const transaction = rows.find((row) => row.id === transactionId);
    if (!transaction) return;

    const attached = isInSpace(transaction, spaceId);

    savingSpaceTxId = transactionId;
    try {
      const response = attached
        ? await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/spaces/${spaceId}`, { method: "DELETE" })
        : await fetch(`/api/accounts/${data.account.id}/transactions/${transactionId}/spaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spaceId }),
          });
      if (!response.ok) return;

      if (attached) {
        if (data.selectedSpaceId === spaceId) {
          rows = rows.filter((row) => row.id !== transactionId);
          openSpaceTxId = null;
        } else {
          rows = rows.map((row) => (row.id === transactionId ? { ...row, spaces: row.spaces.filter((space) => space.id !== spaceId) } : row));
        }
        return;
      }

      const space = data.spaces.find((entry) => entry.id === spaceId);
      if (!space) return;

      rows = rows.map((row) =>
        row.id === transactionId
          ? {
              ...row,
              spaces: [...row.spaces, { id: space.id, name: space.name, colorHex: space.colorHex }].sort((a, b) => a.name.localeCompare(b.name)),
            }
          : row
      );
    } finally {
      savingSpaceTxId = null;
    }
  }
</script>

<svelte:head><title>Chhan Chhan</title></svelte:head>

<div class="tx-page">
  <header class="topbar">
    <div>
      <h1 class="brand-lockup">
        <BrandMark />
        <span class="brand-word"><span>CHHAN</span><span class="acid"> CHHAN</span></span>
      </h1>
      <AppNav />
    </div>
    <div class="actions">
      <AppSettings />
    </div>
  </header>

  <section class="balance-combo">
    <div class="balance-open" class:stale={data.currentBalance?.isStale}>
      {#if data.currentBalance}
        <span class="k">balance</span>
        <div class="balance-value-wrap">
          <span class="v">
            <span class="rough-mark is-balance">
              <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                <rect x="1" y="3" width="118" height="20" rx="2" fill="color-mix(in srgb, var(--yellow) 78%, transparent)" />
              </svg>
              <span class="txt">{formatMoney(data.currentBalance.balanceMinor, data.account.currencyCode)}</span>
            </span>
          </span>
          <span class="balance-txn-count">{data.currentBalance.transactionCount.toLocaleString()} txns</span>
        </div>
        <span class="meta">
          {#if data.currentBalance.isStale}
            as of {data.currentBalance.asOf} · latest txn {data.currentBalance.latestTransactionOn} —
            <a href="/app/control">re-import statement</a> to refresh
          {:else}
            as of {data.currentBalance.asOf}
          {/if}
        </span>
      {:else}
        <span class="k">balance</span>
        <span class="meta">No balance yet — import a statement to start</span>
      {/if}
    </div>

    <div class="stats-controls">
      <div class="stats-label">
        <span>Summary</span>
        {#if data.summaryPeriod === "month"}
          {#if data.summaryMonths.length}
            <SketchSelect
              name="summary-month"
              compact
              alignEnd
              aria-label="Select month"
              value={data.selectedMonth}
              options={data.summaryMonths.map((monthKey) => ({ value: monthKey, label: formatMonthKeyShort(monthKey) }))}
              onChange={setSummaryMonth}
            />
          {/if}
        {:else if data.summaryPeriod === "year"}
          {#if data.summaryYears.length}
            <SketchSelect
              name="summary-year"
              compact
              alignEnd
              aria-label="Select year"
              value={String(data.selectedYear)}
              options={data.summaryYears.map((year) => ({ value: String(year), label: String(year) }))}
              onChange={(next) => setSummaryYear(Number(next))}
            />
          {/if}
        {:else}
          <span class="period-static">All time</span>
        {/if}
      </div>

      <div class="summary-tabs" role="tablist" aria-label="Summary period">
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

      {#if data.spaces.length > 0}
        <div class="flow-tools">
          <div class="space-filter-wrap">
            <SketchSelect
              name="space-filter"
              compact
              alignEnd
              aria-label="Filter by space"
              value={data.selectedSpaceId ?? ""}
              options={[{ value: "", label: "All spaces" }, ...data.spaces.map((space) => ({ value: space.id, label: space.name }))]}
              onChange={(next) => setSpaceFilter(next || null)}
            />
          </div>
        </div>
      {/if}
    </div>
  </section>

  <section class="stats-block">
    <div class="table-toolbar">
      <div class="flow" aria-label="Period flow">
        <button
          type="button"
          class="node"
          class:active={data.transactionTypeFilter === "income"}
          aria-pressed={data.transactionTypeFilter === "income"}
          onclick={() => setTypeFilter("income")}
        >
          <span class="node-k">in</span>
          <span class="node-v pos">
            <span class="rough-mark is-in">
              <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                <rect x="1" y="4" width="118" height="18" rx="2" fill="color-mix(in srgb, var(--green) 72%, transparent)" />
              </svg>
              <span class="txt">{formatMoney(data.summary.incomeMinor, data.account.currencyCode)}</span>
            </span>
          </span>
        </button>
        <span class="arrow" aria-hidden="true">→</span>
        <span class="node period-node">{data.summaryLabel.toLowerCase()}</span>
        <span class="arrow" aria-hidden="true">→</span>
        <button
          type="button"
          class="node"
          class:active={data.transactionTypeFilter === "expense"}
          aria-pressed={data.transactionTypeFilter === "expense"}
          onclick={() => setTypeFilter("expense")}
        >
          <span class="node-k">out</span>
          <span class="node-v neg">
            <span class="rough-mark is-out">
              <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                <rect x="1" y="5" width="118" height="17" rx="2" fill="color-mix(in srgb, var(--pink) 70%, transparent)" />
              </svg>
              <span class="txt">{formatMoney(-data.summary.expenseMinor, data.account.currencyCode)}</span>
            </span>
          </span>
        </button>
        <span class="arrow" aria-hidden="true">=</span>
        <button
          type="button"
          class="node net-node"
          class:active={!data.transactionTypeFilter}
          aria-pressed={!data.transactionTypeFilter}
          onclick={() => setTypeFilter(null)}
        >
          <span class="node-k">net</span>
          <span class="node-v">
            <span class="rough-mark is-net">
              <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                <rect x="1" y="3" width="118" height="20" rx="2" fill="color-mix(in srgb, var(--purple) 75%, transparent)" />
              </svg>
              <span class="txt">{formatMoney(data.summary.netMinor, data.account.currencyCode)}</span>
            </span>
          </span>
        </button>
        <span class="saved-chip" title="Savings rate">{Math.round(data.summary.savingsRate * 100)}% saved</span>
      </div>

      <div class="stats-tools">
        <input
          type="search"
          class="stats-search"
          placeholder="search…"
          aria-label="Search transactions"
          value={searchInput}
          oninput={(e) => handleSearchInput(e.currentTarget.value)}
        />
        <button
          type="button"
          class="calc-mode-btn"
          class:active={calculateModeActive}
          aria-pressed={calculateModeActive}
          aria-label="Calculate mode (Ctrl+X)"
          title="Calculate mode (Ctrl+X)"
          onclick={() => toggleCalculateMode()}
        >
          <Calculator size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>

  {#if calculateModeActive}
    <div class="calc-mode-banner">
      <span>Calculate mode — click rows to add or remove from sum</span>
      <button type="button" class="calc-mode-exit-btn" aria-label="Exit calculate mode" onclick={() => exitCalculateMode()}>
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  {/if}

  <section class="table-block table-sheet" class:calc-mode-on={calculateModeActive}>
    <div class="table-scroll">
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
            <th class="th-filter">
              <FilterMultiselect variant="icon" label="Tags" options={tagFilterOptions} selected={data.selectedTagIds} onchange={setTagFilters} />
            </th>
            <th class="right">Amount</th>
            <th class="right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {#if rows.length === 0}
            <tr>
              <td colspan="5" class="dim empty-row">
                {#if data.searchQuery?.trim()}
                  No transactions match “{data.searchQuery}”.
                {:else if data.selectedSpaceId}
                  No transactions in {selectedSpaceName} for the selected period.
                {:else if data.selectedTagIds.length}
                  No transactions tagged {selectedTagLabels()} for the selected period.
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
              <tr
                class:calc-mode-active={calculateModeActive}
                class:calc-mode-selected={isCalculateSelected(t.id)}
                onclick={(event) => handleCalculateRowClick(event, t)}
              >
                <td class="mono dim">{t.occurredOn}</td>
                <td class="merchant-cell">
                  <div class="merchant-row">
                    <span class="merchant">{t.merchant ?? "—"}</span>
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
                        <StickyNote size={12} strokeWidth={1.6} aria-hidden="true" />
                      </button>
                      {#if openNoteTxId === t.id}
                        <div class="note-popup" role="dialog" aria-label="Transaction note">
                          <span class="note-popup-label" aria-hidden="true">note</span>
                          <textarea
                            class="note-textarea"
                            bind:value={noteDraft}
                            placeholder="Scribble a note…"
                            disabled={savingNotesId === t.id}
                            rows="3"
                            onkeydown={(e) => handleNoteKeydown(e, t)}
                          ></textarea>
                          <p class="note-hint dim">Enter to save · Esc to cancel</p>
                        </div>
                      {:else if t.notes}
                        <span class="note-preview" role="tooltip">{t.notes}</span>
                      {/if}
                    </div>
                    {#if data.spaces.length > 0}
                      <div class="space-link-wrap">
                        <button
                          type="button"
                          class="space-link-btn"
                          class:has-space={t.spaces.length > 0}
                          aria-label="{t.spaces.length ? `In ${spaceLabelFor(t)}` : 'Add to space'} for {t.merchant ?? 'transaction'}"
                          aria-expanded={openSpaceTxId === t.id}
                          disabled={savingSpaceTxId === t.id}
                          onclick={() => (openSpaceTxId = openSpaceTxId === t.id ? null : t.id)}
                        >
                          <Layers size={12} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                        {#if openSpaceTxId === t.id}
                          <div class="space-popup" role="menu" aria-label="Transaction spaces">
                            <span class="space-popup-label" aria-hidden="true">spaces</span>
                            {#each data.spaces as space (space.id)}
                              {@const attached = isInSpace(t, space.id)}
                              <button
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={attached}
                                class="space-option"
                                class:selected={attached}
                                disabled={savingSpaceTxId === t.id}
                                onclick={() => toggleTransactionSpace(t.id, space.id)}
                              >
                                <span class="space-option-check" aria-hidden="true">
                                  {#if attached}<Check size={11} strokeWidth={2.2} />{/if}
                                </span>
                                {space.name}
                              </button>
                            {/each}
                          </div>
                        {:else if t.spaces.length > 0}
                          <span class="space-preview" role="tooltip">{spaceLabelFor(t)}</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </td>
                <td class="tags">
                  <div class="tag-list">
                    {#each t.tags as tag (tag.id)}
                      <span class="tag tx-tag" style="--tag-color: {tag.colorHex ?? 'var(--orange)'}">
                        <Tag size={11} strokeWidth={1.4} class="tag-icon" aria-hidden="true" />
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
                              <button
                                type="button"
                                role="menuitem"
                                disabled={savingTagTxId === t.id}
                                onclick={() => {
                                  handleAddTag(t, tag.id);
                                  openTagMenuTxId = null;
                                }}
                              >
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
                <td class="right mono balance-cell">
                  {#if t.balanceMinor != null}
                    {formatMoney(t.balanceMinor, data.account.currencyCode)}
                  {:else}
                    <span class="dim">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
      <div class="load-hit" use:infiniteScroll={{ onLoad: loadMore, disabled: loading || !hasMore }} aria-hidden="true"></div>
    </div>
    <footer class="sheet-foot">
      <span class="sheet-foot-rule" aria-hidden="true"></span>
      <span class="sheet-foot-mark">
        {#if loading}loading…{:else if !hasMore}end of page{:else}keep scrolling ↓{/if}
      </span>
      <span class="sheet-foot-rule" aria-hidden="true"></span>
    </footer>
  </section>
</div>

<SmartTagPopup
  open={smartTagOpen}
  preview={smartTagPreview}
  applying={smartTagApplying}
  mode={smartTagMode}
  toggles={smartTagToggles}
  onModeChange={(mode) => (smartTagMode = mode)}
  onToggle={handleSmartTagToggle}
  onApplySelected={() => applySmartTag(true)}
  onThisOnly={() => applySmartTag(false)}
  onCancel={() => closeSmartTag(true)}
/>

{#if calculateModeActive}
  <CalculateWidget
    count={calculateStats.count}
    sumMinor={calculateStats.sumMinor}
    currencyCode={data.account.currencyCode}
    onClear={clearCalculateSelection}
    onClose={exitCalculateMode}
  />
{/if}

<style>
  .tx-page {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tx-page .table-block.table-sheet {
    flex: 1 1 auto;
    min-height: 12rem;
    max-height: none;
    margin-bottom: 0;
  }

  .calc-mode-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    padding: 0;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .calc-mode-btn:hover {
    color: var(--brand);
    border-color: var(--brand);
    background: transparent;
  }

  .calc-mode-btn.active {
    color: var(--ink);
    border-style: solid;
    border-color: transparent;
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    transform: rotate(-1deg);
  }

  .calc-mode-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
    padding: 0.5rem 0.8rem;
    background: color-mix(in srgb, var(--yellow) 55%, var(--paper));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 3px 10px 4px 8px / 8px 3px 10px 4px;
    box-shadow: 2px 2px 0 0 color-mix(in srgb, var(--ink) 10%, transparent);
    font-family: var(--hand);
    font-size: 0.95rem;
    color: var(--ink);
    transform: rotate(-0.25deg);
  }

  .calc-mode-exit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 4px;
  }

  .calc-mode-exit-btn:hover {
    color: var(--brand);
  }

  .table-block.calc-mode-on {
    padding-bottom: 0;
  }

  .table-block.calc-mode-on .table-scroll {
    padding-bottom: 4.5rem;
  }

  tr.calc-mode-active {
    cursor: pointer;
  }

  tr.calc-mode-selected td {
    background: color-mix(in srgb, var(--yellow) 42%, transparent);
    box-shadow: inset 0 -1.5px 0 color-mix(in srgb, var(--ink) 12%, transparent);
  }

  tr.calc-mode-selected td:first-child {
    box-shadow:
      inset 3px 0 0 color-mix(in srgb, var(--yellow) 85%, var(--ink)),
      inset 0 -1.5px 0 color-mix(in srgb, var(--ink) 12%, transparent);
  }

  tr.calc-mode-active:not(.calc-mode-selected):hover td {
    background: color-mix(in srgb, var(--yellow) 18%, transparent);
  }

  .table-block.calc-mode-on tbody tr.calc-mode-selected:nth-child(even) td {
    background: color-mix(in srgb, var(--yellow) 48%, transparent);
  }

  .table-block.calc-mode-on tbody tr.calc-mode-active:not(.calc-mode-selected):hover:nth-child(even) td {
    background: color-mix(in srgb, var(--yellow) 24%, transparent);
  }

  .balance-combo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem 1.75rem;
    flex-wrap: wrap;
    margin: 0.15rem 0 0.85rem;
  }

  .balance-open {
    margin: 0;
    min-width: 0;
    flex: 1 1 14rem;
  }

  .balance-combo .stats-controls {
    flex: 0 1 auto;
    align-items: flex-end;
  }

  .balance-combo .stats-label,
  .balance-combo .summary-tabs,
  .balance-combo .flow-tools {
    justify-content: flex-end;
  }

  .balance-combo .stats-label {
    display: inline-flex;
  }

  .balance-open .k {
    display: block;
    font-family: var(--hand);
    color: var(--ink-muted);
    font-size: 1.05rem;
  }

  .balance-open .v {
    display: inline-block;
    font-family: var(--hand);
    font-size: clamp(2.4rem, 7vw, 3.8rem);
    line-height: 0.95;
    font-variant-numeric: tabular-nums;
  }

  .balance-value-wrap {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .balance-txn-count {
    font-size: 0.85rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .balance-open .meta {
    display: block;
    margin-top: 0.35rem;
    color: var(--ink-soft);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .balance-open .meta a {
    color: var(--brand);
  }

  .rough-mark.is-balance > .stroke {
    left: -6%;
    top: 18%;
    width: 114%;
    height: 62%;
    transform: rotate(-0.9deg);
  }

  .stats-block {
    margin-bottom: 0.85rem;
    flex: none;
  }

  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
    margin: 0;
  }

  .table-toolbar .flow {
    flex: 0 1 auto;
    min-width: 0;
    justify-content: flex-start;
    margin-right: auto;
  }

  .table-toolbar .stats-tools {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex: none;
    margin-left: 0;
  }

  .tx-page .topbar,
  .tx-page .balance-combo,
  .tx-page .stats-block,
  .tx-page .calc-mode-banner {
    flex: none;
  }

  .stats-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.05rem;
    min-width: 0;
  }

  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.55rem;
    margin: 0;
    font-family: var(--hand);
    font-size: 1.1rem;
    min-width: 0;
  }

  .flow-tools {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .th-filter {
    vertical-align: middle;
  }

  .th-filter :global(.filter-multi) {
    min-width: 0;
    width: auto;
    max-width: none;
  }

  .flow .arrow {
    color: var(--brand);
    font-size: 1.25rem;
  }

  .flow .node {
    display: inline-flex;
    flex-direction: row;
    align-items: baseline;
    gap: 0.4rem;
    border: none;
    padding: 0.05rem 0.15rem;
    border-radius: 0;
    background: transparent;
    text-decoration: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .flow .node:nth-child(3) {
    transform: rotate(0.5deg);
  }

  .flow .node:nth-child(5) {
    transform: rotate(-0.5deg);
  }

  .flow button.node:hover {
    color: var(--brand);
  }

  .flow button.node.active {
    outline: none;
  }

  .flow button.node.active .node-k,
  .flow button.node.active .node-v {
    font-weight: 700;
  }

  .flow button.node.active .node-k {
    font-size: 1.1rem;
    color: var(--ink);
  }

  .flow button.node.active .node-v {
    font-size: 1.45rem;
  }

  .node-k {
    font-size: 0.95rem;
    color: var(--ink-muted);
    line-height: 1;
  }

  .node-v {
    font-size: 1.15rem;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .period-node {
    color: var(--ink-muted);
    cursor: default;
  }

  .saved-chip {
    margin-left: 0.35rem;
    padding: 0.2rem 0.55rem;
    background: color-mix(in srgb, var(--green) 55%, transparent);
    border-radius: 3px 9px 4px 8px / 8px 3px 9px 2px;
    font-size: 0.95rem;
    color: var(--ink);
  }

  .rough-mark {
    position: relative;
    display: inline-block;
    padding: 0.02em 0.08em;
    isolation: isolate;
  }

  .rough-mark > .txt {
    position: relative;
    z-index: 1;
  }

  .rough-mark > .stroke {
    position: absolute;
    z-index: 0;
    pointer-events: none;
    overflow: visible;
  }

  .rough-mark > .stroke rect {
    mix-blend-mode: multiply;
  }

  .rough-mark.is-in > .stroke {
    left: -10%;
    top: 12%;
    width: 118%;
    height: 72%;
    transform: rotate(-1.4deg);
  }

  .rough-mark.is-out > .stroke {
    left: -8%;
    top: 18%;
    width: 122%;
    height: 68%;
    transform: rotate(1.8deg);
  }

  .rough-mark.is-net > .stroke {
    left: -14%;
    top: 8%;
    width: 128%;
    height: 78%;
    transform: rotate(-2.6deg);
  }

  .space-filter-wrap {
    padding: 0;
    overflow: visible;
  }

  .filter-multi-wrap {
    padding: 0;
    overflow: visible;
    min-width: 7.5rem;
  }

  .stats-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
    font-family: var(--hand);
  }

  .stats-tools {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .stats-search {
    width: 9.5rem;
    max-width: 36vw;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 32%, transparent);
    color: var(--main-text);
    padding: 0.05rem 0.1rem 0.2rem;
    font-family: inherit;
    font-size: 0.85rem;
    letter-spacing: 0.01em;
    text-transform: none;
    border-radius: 0;
    box-shadow: none;
  }

  .stats-search:focus {
    outline: none;
    border-bottom-color: var(--brand);
  }

  .stats-tools .calc-mode-btn {
    flex: none;
  }

  .period-static {
    font-size: 0.9rem;
    line-height: 1;
    color: var(--main-text);
    letter-spacing: 0.01em;
    text-transform: none;
  }

  .summary-tabs {
    display: inline-flex;
    gap: 0.25rem;
    border: none;
    border-radius: 0;
    overflow: visible;
  }

  .summary-tabs button {
    background: transparent;
    border: none;
    color: var(--muted);
    padding: 0.15rem 0.45rem;
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    cursor: pointer;
    border-radius: 2px 8px 3px 7px / 7px 3px 8px 2px;
  }

  .summary-tabs button.active {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    color: var(--ink);
  }

  .summary-tabs button:hover:not(.active) {
    color: var(--ink);
  }

  .period-tabs {
    display: inline-flex;
    border: 1.5px solid var(--chrome-line);
    border-radius: 255px 12px 225px 10px / 12px 225px 10px 255px;
    overflow: hidden;
  }

  .period-tabs button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-right: 1px solid var(--hair);
    color: var(--muted);
    padding: 0 0.65rem;
    text-transform: none;
    font-family: var(--hand);
    cursor: pointer;
  }

  .period-tabs button:last-child {
    border-right: none;
  }

  .period-tabs button.active {
    background: var(--brand-soft);
    color: var(--brand);
  }

  .period-tabs button:hover:not(.active) {
    color: var(--brand);
  }

  .empty-row {
    text-align: center;
    padding: 1.5rem !important;
  }

  .merchant-cell {
    min-width: 8rem;
    max-width: 22rem;
  }

  .merchant-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
    min-width: 0;
    width: 100%;
  }

  .merchant-row .merchant {
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    width: 1.35rem;
    height: 1.35rem;
    padding: 0;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .note-btn.has-note {
    border-style: solid;
    border-color: transparent;
    background: color-mix(in srgb, var(--yellow) 62%, transparent);
    color: var(--ink);
    transform: rotate(-1.2deg);
  }

  .note-btn:hover:not(:disabled),
  .note-btn[aria-expanded="true"] {
    color: var(--brand);
    border-color: var(--brand);
  }

  .note-btn.has-note:hover:not(:disabled),
  .note-btn.has-note[aria-expanded="true"] {
    background: color-mix(in srgb, var(--yellow) 82%, transparent);
    border-color: transparent;
    color: var(--ink);
  }

  .note-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .note-preview {
    position: absolute;
    left: calc(100% + 0.4rem);
    top: 50%;
    transform: translateY(-50%) rotate(-0.4deg);
    z-index: 15;
    width: max-content;
    max-width: 15rem;
    padding: 0.4rem 0.55rem;
    background:
      linear-gradient(transparent 0, transparent calc(100% - 1px), color-mix(in srgb, var(--ink) 10%, transparent) calc(100% - 1px)) 0 0 / 100%
        1.15rem,
      color-mix(in srgb, var(--yellow) 28%, var(--surface-raised));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 10px 3px 8px / 8px 2px 10px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.88rem;
    line-height: 1.35;
    white-space: pre-wrap;
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
    left: calc(100% + 0.4rem);
    top: -0.35rem;
    z-index: 25;
    width: 14.5rem;
    padding: 0.45rem 0.55rem 0.4rem;
    background:
      linear-gradient(transparent 0, transparent calc(100% - 1px), color-mix(in srgb, var(--ink) 10%, transparent) calc(100% - 1px)) 0 0.15rem / 100%
        1.25rem,
      color-mix(in srgb, var(--yellow) 22%, var(--surface-raised));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 10px 3px 8px / 8px 2px 10px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
  }

  .note-popup-label {
    display: block;
    margin: 0 0 0.2rem;
    font-family: var(--hand);
    font-size: 0.8rem;
    color: var(--ink-muted);
    letter-spacing: 0.02em;
  }

  .note-textarea {
    width: 100%;
    min-height: 4.5rem;
    resize: vertical;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--ink);
    caret-color: var(--ink);
    padding: 0.1rem 0.05rem 0.2rem;
    font-family: var(--hand);
    font-size: 0.95rem;
    line-height: 1.25rem;
    box-shadow: none;
  }

  .note-textarea:focus {
    outline: none;
    box-shadow: none;
  }

  .note-textarea::placeholder {
    color: color-mix(in srgb, var(--ink-muted) 75%, transparent);
  }

  .note-hint {
    margin: 0.2rem 0 0;
    font-family: var(--hand);
    font-size: 0.75rem;
    line-height: 1.2;
  }

  .space-link-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .space-link-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.35rem;
    height: 1.35rem;
    padding: 0;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .space-link-btn.has-space {
    border-style: solid;
    border-color: transparent;
    background: color-mix(in srgb, var(--yellow) 62%, transparent);
    color: var(--ink);
    transform: rotate(1deg);
  }

  .space-link-btn:hover:not(:disabled),
  .space-link-btn[aria-expanded="true"] {
    color: var(--brand);
    border-color: var(--brand);
  }

  .space-link-btn.has-space:hover:not(:disabled),
  .space-link-btn.has-space[aria-expanded="true"] {
    background: color-mix(in srgb, var(--yellow) 82%, transparent);
    border-color: transparent;
    color: var(--ink);
  }

  .space-link-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .space-preview {
    position: absolute;
    left: calc(100% + 0.4rem);
    top: 50%;
    transform: translateY(-50%) rotate(0.5deg);
    z-index: 15;
    width: max-content;
    max-width: 14rem;
    padding: 0.4rem 0.55rem;
    background: color-mix(in srgb, var(--yellow) 28%, var(--surface-raised));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 10px 3px 8px / 8px 2px 10px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.88rem;
    line-height: 1.35;
    white-space: normal;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
  }

  .space-link-wrap:has(.space-link-btn.has-space):hover .space-preview {
    opacity: 1;
    visibility: visible;
  }

  .space-popup {
    position: absolute;
    left: calc(100% + 0.4rem);
    top: -0.35rem;
    z-index: 25;
    min-width: 8.5rem;
    max-width: 12rem;
    padding: 0.35rem 0.3rem 0.3rem;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 10px 3px 8px / 8px 2px 10px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .space-popup-label {
    display: block;
    margin: 0 0.2rem 0.15rem;
    font-family: var(--hand);
    font-size: 0.8rem;
    color: var(--ink-muted);
    letter-spacing: 0.02em;
  }

  .space-option {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    font-family: var(--hand);
    font-size: 0.95rem;
    color: var(--ink);
    padding: 0.28rem 0.45rem;
    cursor: pointer;
    border-radius: 2px 6px 3px 5px / 5px 2px 6px 2px;
  }

  .space-option-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.8rem;
    flex: none;
  }

  .space-option:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 45%, transparent);
    color: var(--ink);
  }

  .space-option.selected {
    background: color-mix(in srgb, var(--yellow) 62%, transparent);
  }

  .space-option:disabled {
    opacity: 0.55;
    cursor: wait;
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

  .balance-cell {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-family: var(--hand);
    font-size: 0.95rem;
  }

  .tx-tag {
    gap: 0.18rem;
    padding: 0.05rem 0.28rem;
    border: none;
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    background: color-mix(in srgb, var(--tag-color, var(--orange)) 45%, transparent);
    color: var(--ink);
    font-size: 0.82rem;
  }

  .tx-tag :global(.tag-icon) {
    color: color-mix(in srgb, var(--tag-color, var(--orange)) 70%, var(--ink));
  }

  .tag-remove {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    padding: 0;
    margin-left: 0.05rem;
    line-height: 1;
    font-size: 0.9rem;
  }

  .tag-remove:hover:not(:disabled) {
    color: var(--danger);
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
    padding: 0;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 28%, transparent);
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 3px 8px 4px 7px / 7px 3px 8px 4px;
  }

  .tag-add-btn:hover:not(:disabled),
  .tag-add-wrap:has(.tag-add-menu) .tag-add-btn {
    color: var(--brand);
    border-color: var(--brand);
  }

  .tag-add-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .tag-add-menu {
    position: absolute;
    top: calc(100% + 0.2rem);
    right: 0;
    left: auto;
    z-index: 20;
    min-width: 7rem;
    max-height: 10rem;
    overflow: auto;
    padding: 0.25rem;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 8px 3px 6px / 6px 2px 8px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    display: flex;
    flex-direction: column;
  }

  .tag-add-menu button {
    appearance: none;
    display: block;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    font-family: var(--hand);
    font-size: 0.9rem;
    color: var(--ink);
    padding: 0.25rem 0.4rem;
    cursor: pointer;
    border-radius: 2px 6px 3px 5px / 5px 2px 6px 2px;
  }

  .tag-add-menu button:last-child {
    border-bottom: none;
  }

  .tag-add-menu button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--yellow) 45%, transparent);
    color: var(--ink);
  }

  .tag-add-menu button:disabled {
    opacity: 0.55;
    cursor: wait;
  }
</style>
