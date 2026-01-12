<script lang="ts" generics="TData, TValue">
import { ArrowDownIcon, ArrowUpIcon, Columns2Icon, FilterIcon, GripVerticalIcon, XIcon } from "@lucide/svelte";
import { type ColumnDef, getCoreRowModel, type SortingState, type VisibilityState } from "@tanstack/table-core";
import { setContext } from "svelte";
import { dndzone } from "svelte-dnd-action";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import { createSvelteTable, FlexRender } from "$lib/components/ui/data-table/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
import { Input } from "$lib/components/ui/input";
import * as Table from "$lib/components/ui/table/index.js";
import { type ColumnSettings, useColumnSettings } from "./data-table-helpers/column-settings.svelte.js";
import FilterDropdown from "./data-table-helpers/filter-dropdown.svelte";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onSentinelMount: (element: HTMLElement) => void;
  isLoading?: boolean;
  filterOptions?: {
    languages: Array<{ language: string }>;
    tags: Array<{ tag: string }>;
    progressStatuses: Array<{ my_progress_status: string }>;
    types: Array<{ type: string }>;
  };
};

let { data, columns, onSentinelMount, isLoading = false, filterOptions }: DataTableProps<TData, TValue> = $props();

// Get default column order (excluding index which will always be first)
let defaultColumnOrder = $derived(
  columns
    .map((col) => {
      if ("id" in col && col.id) return col.id;
      if ("accessorKey" in col && col.accessorKey) return col.accessorKey as string;
      return null;
    })
    .filter((id): id is string => id !== null)
);

// Initialize state in component
let columnSettings = $state<ColumnSettings>({});
let isSettingsLoaded = $state(false);

// Use hook to manage effects
const { handleColumnVisibilityChange, handleColumnOrderChange } = useColumnSettings(
  () => columnSettings,
  (value) => {
    columnSettings = value;
  },
  () => isSettingsLoaded,
  (value) => {
    isSettingsLoaded = value;
  },
  defaultColumnOrder
);

// Derive column order from settings (excluding index, which is always first)
let columnOrder = $derived.by(() => {
  const settings = columnSettings;
  if (Object.keys(settings).length === 0) {
    return defaultColumnOrder;
  }

  const ordered = Object.keys(settings)
    .filter((id) => id !== "order")
    .sort((a, b) => (settings[a]?.order ?? 999) - (settings[b]?.order ?? 999));

  return ["order", ...ordered];
});

// Derive visibility state from settings
let columnVisibility = $derived.by(() => {
  const settings = columnSettings;
  const visibility: VisibilityState = {};
  Object.keys(settings).forEach((columnId) => {
    visibility[columnId] = settings[columnId]?.visible !== false;
  });
  return visibility;
});

let sentinelRef: HTMLElement | null = $state(null);

$effect(() => {
  if (sentinelRef) {
    onSentinelMount(sentinelRef);
  }
});

// Parse sorting from URL
function parseSortingFromUrl(): SortingState {
  const sortBy = page.url.searchParams.get("sortBy");
  const sortOrder = page.url.searchParams.get("sortOrder");

  if (!sortBy) return [];

  const columns = sortBy.split(",");
  const orders = sortOrder?.split(",") ?? [];

  return columns
    .map((col, idx) => ({
      id: col.trim(),
      desc: orders[idx]?.trim().toLowerCase() === "desc",
    }))
    .filter((s) => s.id);
}

// Convert sorting state to URL params
function sortingToUrlParams(sortState: SortingState): { sortBy?: string; sortOrder?: string } {
  if (sortState.length === 0) {
    return {};
  }

  return {
    sortBy: sortState.map((s) => s.id).join(","),
    sortOrder: sortState.map((s) => (s.desc ? "desc" : "asc")).join(","),
  };
}

// Sorting state management
let sorting = $state<SortingState>(parseSortingFromUrl());
let isSortingChanging = $state(false);
let pendingSorting = $state<string | null>(null);

// Initialize sorting from URL
$effect(() => {
  const urlSortBy = page.url.searchParams.get("sortBy");
  const urlSortOrder = page.url.searchParams.get("sortOrder");

  // If we have a pending sorting change, check if URL matches it
  if (pendingSorting !== null) {
    const expectedUrl = `${urlSortBy || ""},${urlSortOrder || ""}`;
    if (expectedUrl === pendingSorting) {
      pendingSorting = null;
      isSortingChanging = false;
      // Sync sorting state to match URL now that it's updated
      const urlSorting = parseSortingFromUrl();
      if (JSON.stringify(urlSorting) !== JSON.stringify(sorting)) {
        sorting = urlSorting;
      }
      return;
    } else {
      // URL hasn't updated yet, don't sync
      return;
    }
  }

  // Normal sync when not changing sorting and no pending change
  if (isSortingChanging) {
    return;
  }

  const urlSorting = parseSortingFromUrl();
  if (JSON.stringify(urlSorting) !== JSON.stringify(sorting)) {
    sorting = urlSorting;
  }
});

// Handle sorting changes
function handleSortingChange(updater: SortingState | ((prev: SortingState) => SortingState)) {
  isSortingChanging = true;
  const newSorting = typeof updater === "function" ? updater(sorting) : updater;
  sorting = newSorting;

  // Update URL
  const url = new URL(page.url);
  const params = sortingToUrlParams(newSorting);

  if (params.sortBy) {
    url.searchParams.set("sortBy", params.sortBy);
    url.searchParams.set("sortOrder", params.sortOrder ?? "");
  } else {
    url.searchParams.delete("sortBy");
    url.searchParams.delete("sortOrder");
  }

  const expectedUrl = `${params.sortBy || ""},${params.sortOrder || ""}`;
  pendingSorting = expectedUrl;
  goto(url.toString(), { keepFocus: true, invalidateAll: true });
}

// Parse filters from URL
function parseFiltersFromUrl(): { language: string[]; tags: string[]; progress: string[]; type: string[] } {
  const filterLanguage = page.url.searchParams.get("filterLanguage");
  const filterTags = page.url.searchParams.get("filterTags");
  const filterProgress = page.url.searchParams.get("filterProgress");
  const filterType = page.url.searchParams.get("filterType");

  return {
    language: filterLanguage
      ? filterLanguage
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [],
    tags: filterTags
      ? filterTags
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [],
    progress: filterProgress
      ? filterProgress
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [],
    type: filterType
      ? filterType
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [],
  };
}

// Filter state management
let filters = $state<{ language: string[]; tags: string[]; progress: string[]; type: string[] }>(parseFiltersFromUrl());
let isFilterChanging = $state(false);
let pendingFilters = $state<string | null>(null);

// Initialize filters from URL
$effect(() => {
  const urlFilters = parseFiltersFromUrl();
  const urlFiltersStr = JSON.stringify(urlFilters);

  // If we have a pending filter change, check if URL matches it
  if (pendingFilters !== null) {
    if (urlFiltersStr === pendingFilters) {
      pendingFilters = null;
      isFilterChanging = false;
      // Sync filter state to match URL now that it's updated
      if (JSON.stringify(urlFilters) !== JSON.stringify(filters)) {
        filters = urlFilters;
      }
      return;
    } else {
      // URL hasn't updated yet, don't sync
      return;
    }
  }

  // Normal sync when not changing filters and no pending change
  if (isFilterChanging) {
    return;
  }

  if (JSON.stringify(urlFilters) !== JSON.stringify(filters)) {
    filters = urlFilters;
  }
});

// Handle filter changes
function handleFilterChange(filterType: "language" | "tags" | "progress" | "type", values: string[]) {
  isFilterChanging = true;
  filters = { ...filters, [filterType]: values };

  // Update URL
  const url = new URL(page.url);

  if (values.length > 0) {
    url.searchParams.set(`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`, values.join(","));
  } else {
    url.searchParams.delete(`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`);
  }

  const expectedFilters = JSON.stringify(filters);
  pendingFilters = expectedFilters;
  goto(url.toString(), { keepFocus: true, invalidateAll: true });
}

// Add a filter value (used by clickable cells)
function addFilterValue(filterType: "language" | "tags" | "progress" | "type", value: string) {
  const currentValues = filters[filterType];
  // Don't add if already in filter
  if (currentValues.includes(value)) {
    return;
  }
  handleFilterChange(filterType, [...currentValues, value]);
}

// Provide filter context for child components
setContext("filterContext", {
  handleFilterChange,
  addFilterValue,
  filters: () => filters,
});

// Remove a single filter value
function removeFilter(filterType: "language" | "tags" | "progress" | "type", value: string) {
  const currentValues = filters[filterType];
  const newValues = currentValues.filter((v) => v !== value);
  handleFilterChange(filterType, newValues);
}

// Get filter options arrays
let languageOptions = $derived.by(() => {
  return filterOptions?.languages?.map((l) => l.language) ?? [];
});

let tagOptions = $derived.by(() => {
  return filterOptions?.tags?.map((t) => t.tag).filter(Boolean) ?? [];
});

let progressOptions = $derived.by(() => {
  const statuses = filterOptions?.progressStatuses?.map((p) => p.my_progress_status).filter(Boolean) ?? [];
  return ["Unmarked", ...statuses];
});

let typeOptions = $derived.by(() => {
  return filterOptions?.types?.map((t) => t.type).filter(Boolean) ?? [];
});

const table = createSvelteTable({
  get data() {
    return data;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  enableMultiSort: true,
  onColumnVisibilityChange: handleColumnVisibilityChange,
  onColumnOrderChange: handleColumnOrderChange,
  onSortingChange: handleSortingChange,
  state: {
    get columnVisibility() {
      return columnVisibility;
    },
    get columnOrder() {
      return columnOrder;
    },
    get sorting() {
      return sorting;
    },
  },
});

// Get draggable columns (exclude index)
let draggableColumns = $derived.by(() => {
  return table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.id !== "order")
    .sort((a, b) => {
      const orderA = columnSettings[a.id]?.order ?? 999;
      const orderB = columnSettings[b.id]?.order ?? 999;
      return orderA - orderB;
    });
});

// Items array for dndzone
let dndItems = $state<Array<{ id: string }>>([]);

// Sync dndItems with draggableColumns, but only when not dragging
let isDragging = $state(false);

$effect(() => {
  if (renderTable && !isDragging) {
    const newIds = draggableColumns.map((col) => col.id);
    const currentIds = dndItems.map((item) => item.id);
    // Only update if the IDs actually changed to prevent infinite loops
    if (newIds.length !== currentIds.length || !newIds.every((id, i) => id === currentIds[i])) {
      dndItems = draggableColumns.map((col) => ({ id: col.id }));
    }
  }
});

function handleDndEvent(event: CustomEvent<{ items: Array<{ id: string }> }>) {
  if (event.type === "consider") {
    isDragging = true;
    // Update dndItems to match what dndzone expects during drag, but filter out placeholders
    dndItems = event.detail.items.filter((item) => !item.id.startsWith("id:dnd-shadow-placeholder"));
    return;
  }

  if (event.type === "finalize") {
    isDragging = false;
    const { items } = event.detail;
    // Filter out any placeholder IDs before updating dndItems
    const validItems = items.filter((item) => !item.id.startsWith("id:dnd-shadow-placeholder"));
    // Update dndItems to match the final order from dndzone
    dndItems = validItems;
    // Extract order for processing
    const newOrder = validItems.map((item) => item.id);
    handleColumnOrderChange(["order", ...newOrder]);
  }
}

let renderTable = $derived(isSettingsLoaded && !isLoading);

// Search functionality with debouncing
let searchValue = $state("");
let debounceTimer: ReturnType<typeof setTimeout> | null = $state(null);
let isUserTyping = $state(false);
let pendingQuery = $state<string | null>(null);
let searchInputRef: HTMLInputElement | null = $state(null);

// Initialize and sync search value from URL (only when user is not typing or pending query matches)
$effect(() => {
  const urlQuery = page.url.searchParams.get("q") ?? "";

  // If we have a pending query, check if URL matches it - if so, clear the flag
  if (pendingQuery !== null) {
    if (urlQuery === pendingQuery) {
      pendingQuery = null;
      isUserTyping = false;
      // Sync searchValue to match URL now that it's updated
      if (urlQuery !== searchValue) {
        searchValue = urlQuery;
      }
      return;
    } else {
      // URL hasn't updated yet, don't sync
      return;
    }
  }

  // Normal sync when not typing and no pending query
  if (isUserTyping) {
    return;
  }

  if (urlQuery !== searchValue) {
    searchValue = urlQuery;
  }
});

// Debounced function to update URL query param
function updateSearchQuery(query: string) {
  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new timer
  debounceTimer = setTimeout(() => {
    const url = new URL(page.url);
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      url.searchParams.set("q", trimmedQuery);
    } else {
      url.searchParams.delete("q");
    }
    const newQuery = trimmedQuery || null;

    // Set pending query BEFORE calling goto - this prevents sync effect from running with old URL
    pendingQuery = newQuery;
    goto(url.toString(), { keepFocus: true, invalidateAll: false });
  }, 300);
}

// Cleanup timer on component destroy
$effect(() => {
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };
});

function handleSearchInput(e: Event) {
  const target = e.currentTarget as HTMLInputElement;
  isUserTyping = true;
  searchValue = target.value;
  updateSearchQuery(target.value);
}

// Keyboard shortcut: Ctrl+Q to focus search input
$effect(() => {
  // Only set up listener when table is rendered
  if (!renderTable) return;

  function handleKeyDown(e: KeyboardEvent) {
    // Check for Ctrl+Q or Cmd+Q (Mac) - check both key and code for reliability
    const isQ = e.key?.toLowerCase() === "q" || e.code === "KeyQ";
    const isModifier = e.ctrlKey || e.metaKey;

    if (isModifier && isQ) {
      // Don't prevent if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      // Try ref first, then fallback to ID selector
      const input = searchInputRef || (document.getElementById("search-input") as HTMLInputElement);
      if (input) {
        input.focus();
        input.select(); // Also select the text for better UX
      }
    }
  }

  document.addEventListener("keydown", handleKeyDown, true); // Use capture phase
  return () => {
    document.removeEventListener("keydown", handleKeyDown, true);
  };
});
</script>

<!-- TODO: CRUD -->

{#if renderTable}
  <div>
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 pt-4 px-4 sm:px-8 md:px-16">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <Input
          bind:ref={searchInputRef}
          id="search-input"
          placeholder="(Ctrl + Q) to search by title..."
          value={searchValue}
          oninput={handleSearchInput}
          class="max-w-sm w-full"
        />
        {#if (filters.language.length > 0 || filters.tags.length > 0 || filters.progress.length > 0 || filters.type.length > 0)}
          <div class="flex items-center gap-2 flex-wrap">
            {#each filters.language as value}
            <Button
              variant='outline'
              onclick={() => removeFilter("language", value)}
              class="rounded-full capitalize h-5 py-0 w-fit cursor-pointer text-[0.625rem] font-medium flex items-center gap-1 px-2"
              aria-label="Remove filter"
            >
              {value}
              <XIcon class="size-3" />
              </Button>
            {/each}
            {#each filters.tags as value}
            <Button
              variant='outline'
              onclick={() => removeFilter("tags", value)}
              class="rounded-full capitalize h-5 py-0 w-fit cursor-pointer text-[0.625rem] font-medium flex items-center gap-1 px-2"
              aria-label="Remove filter"
            >
              {value}
              <XIcon class="size-3" />
              </Button>
            {/each}
            {#each filters.progress as value}
            <Button
              variant='outline'
              onclick={() => removeFilter("progress", value)}
              class="rounded-full capitalize h-5 py-0 w-fit cursor-pointer text-[0.625rem] font-medium flex items-center gap-1 px-2"
              aria-label="Remove filter"
            >
              {value}
              <XIcon class="size-3" />
              </Button>
            {/each}
            {#each filters.type as value}
            <Button
              variant='outline'
              onclick={() => removeFilter("type", value)}
              class="rounded-full capitalize h-5 py-0 w-fit cursor-pointer text-[0.625rem] font-medium flex items-center gap-1 px-2"
              aria-label="Remove filter"
            >
              {value}
              <XIcon class="size-3" />
              </Button>
            {/each}
          </div>
        {/if}
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="outline"
              class="sm:ms-auto flex items-center gap-2 w-full sm:w-auto"
              ><Columns2Icon /> Columns</Button
            >
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class='bg-white/1 backdrop-blur-md' align="end">
          <div
            use:dndzone={{
              items: dndItems,
              flipDurationMs: 150,
            }}
            onconsider={handleDndEvent}
            onfinalize={handleDndEvent}
          >
            {#each dndItems as item (item.id)}
              {@const column = table.getColumn(item.id)}
              {@const meta = column?.columnDef.meta as Record<string, unknown> | undefined}
              {@const displayName = (meta?.displayName as string | undefined) ?? (typeof column?.columnDef.header === 'string' ? column.columnDef.header : null) ?? item.id.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
              <div
                class="flex items-center gap-2 px-2 hover:bg-accent rounded-md cursor-move"
                data-id={item.id}
              >
                <GripVerticalIcon class="size-4 text-muted-foreground" />
                <span class="flex-1 select-none">{displayName}</span>
                {#if column}
                  <DropdownMenu.CheckboxItem
                    checked={column.getIsVisible()}
                    onSelect={(e) => {
                      // Prevent dropdown from closing when clicking checkbox
                      // Manually toggle since preventDefault stops the default toggle behavior
                      e.preventDefault();
                      column.toggleVisibility(!column.getIsVisible());
                    }}
                  />
                {:else}
                  <div class="size-4"></div>
                {/if}
              </div>
            {/each}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
    <div class="rounded-md">
      <Table.Root class="border-separate border-spacing-y-2">
        <Table.Header>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row
              class="sticky top-0 bg-primary-foreground z-1 scale-[97%] transition-all duration-500 ease-out  [&>th:first-child]:border-l [&>th:first-child]:pl-4 [&>th:first-child]:rounded-l-md [&>th:last-child]:border-r [&>th:last-child]:pr-4 [&>th:last-child]:rounded-r-md [&>th]:border-t [&>th]:border-b"
            >
              {#each headerGroup.headers as header (header.id)}
                <Table.Head colspan={header.colSpan} class="border-input">
                  {#if !header.isPlaceholder}
                    <div class="flex items-center gap-2">
                      {#if header.column.getCanSort()}
                        <Button
                          variant="ghost"
                          class="flex p-0 dark:hover:bg-transparent items-center gap-2 hover:opacity-80 transition-opacity"
                          onclick={() => {
                            const columnId = header.column.id;
                            const currentSortIndex = sorting.findIndex((s) => s.id === columnId);

                            const currentSort = sorting[currentSortIndex];
                            let newSort: typeof currentSort | null = { ...currentSort }

                            if (currentSort) {
                              if (currentSort.desc) newSort.desc = false
                              else newSort = null;
                            } else {
                              newSort = { id: columnId, desc: true };
                            }
                            const newSorting = [...sorting];
                            if(currentSort) newSorting.splice(currentSortIndex, 1);
                            if(newSort) newSorting.push(newSort);

                            handleSortingChange(newSorting);
                          }}
                        >
                          <FlexRender
                            content={header.column.columnDef.header}
                            context={header.getContext()}
                          />
                          {#if header.column.getIsSorted() === "asc"}
                            <ArrowUpIcon class="size-4" />
                          {:else if header.column.getIsSorted() === "desc"}
                            <ArrowDownIcon class="size-4" />
                          {/if}
                        </Button>
                      {:else}
                        <FlexRender
                          content={header.column.columnDef.header}
                          context={header.getContext()}
                        />
                      {/if}
                      {#if header.column.id === "language" && filterOptions}
                        <FilterDropdown
                          options={languageOptions}
                          selectedValues={filters.language}
                          onApply={(values) => handleFilterChange("language", values)}
                          placeholder="Search languages..."
                        />
                      {:else if header.column.id === "tags" && filterOptions}
                        <FilterDropdown
                          options={tagOptions}
                          selectedValues={filters.tags}
                          onApply={(values) => handleFilterChange("tags", values)}
                          placeholder="Search tags..."
                        />
                      {:else if header.column.id === "my_progress_status" && filterOptions}
                        <FilterDropdown
                          options={progressOptions}
                          selectedValues={filters.progress}
                          onApply={(values) => handleFilterChange("progress", values)}
                          placeholder="Search progress..."
                        />
                      {:else if header.column.id === "type" && filterOptions}
                        <FilterDropdown
                          options={typeOptions}
                          selectedValues={filters.type}
                          onApply={(values) => handleFilterChange("type", values)}
                          placeholder="Search types..."
                        />
                      {/if}
                    </div>
                  {/if}
                </Table.Head>
              {/each}
            </Table.Row>
          {/each}
        </Table.Header>
        <Table.Body>
          {#each table.getRowModel().rows as row (row.id)}
            <Table.Row
              data-state={row.getIsSelected() && "selected"}
              class=" hover:scale-[102%] scale-[97%] transition-all duration-300 ease-out bg-white/1 backdrop-blur-md [&>td:first-child]:border-l [&>td:first-child]:pl-4 [&>td:first-child]:rounded-l-md [&>td:last-child]:border-r [&>td:last-child]:pr-4 [&>td:last-child]:px-4 [&>td:last-child]:rounded-r-md [&>td]:border-t [&>td]:border-b"
            >
              {#each row.getVisibleCells() as cell (cell.id)}
                <Table.Cell class="border-transparent py-4">
                  <FlexRender
                    content={cell.column.columnDef.cell}
                    context={cell.getContext()}
                  />
                </Table.Cell>
              {/each}
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell
                colspan={columns.length}
                class="h-24 scale-[97%] text-center"
              >
                No results.
              </Table.Cell>
            </Table.Row>
          {/each}
          {#if table.getRowModel().rows.length > 0}
            <Table.Row>
              <Table.Cell colspan={columns.length} class="p-0">
                <div
                  bind:this={sentinelRef}
                  class=" h-20 w-full"
                  data-sentinel="true"
                ></div>
              </Table.Cell>
            </Table.Row>
          {/if}
        </Table.Body>
      </Table.Root>
    </div>
  </div>
{/if}
