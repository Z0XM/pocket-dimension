<script lang="ts" generics="TData, TValue">
  import {
    ArrowDownIcon,
    ArrowUpIcon,
    CheckIcon,
    Columns2Icon,
    FilterIcon,
    GripVerticalIcon,
    PencilIcon,
    PlusIcon,
    RotateCcwIcon,
    Trash2Icon,
    XIcon,
  } from "@lucide/svelte";
  import {
    type ColumnDef,
    getCoreRowModel,
    type SortingState,
    type VisibilityState,
  } from "@tanstack/table-core";
  import { setContext, tick } from "svelte";
  import { dndzone } from "svelte-dnd-action";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
  import {
    createSvelteTable,
    FlexRender,
  } from "$lib/components/ui/data-table/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import * as Table from "$lib/components/ui/table/index.js";
  import type { Watchlist } from "./columns";
  import BulkEditPanel from "./data-table-helpers/bulk-edit-panel.svelte";
  import {
    type ColumnSettings,
    useColumnSettings,
  } from "./data-table-helpers/column-settings.svelte.js";
  import ConfirmDialog from "./data-table-helpers/confirm-dialog.svelte";
  import DeleteConfirmationDialog from "./data-table-helpers/delete-confirmation-dialog.svelte";
  import {
    createEditModeState,
    setEditModeContext,
    type UserRole,
  } from "./data-table-helpers/edit-mode.svelte.js";
  import FilterDropdown from "./data-table-helpers/filter-dropdown.svelte";
  import UnsavedChangesDialog from "./data-table-helpers/unsaved-changes-dialog.svelte";

  type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onSentinelMount: (element: HTMLElement) => void;
    isLoading?: boolean;
    userRole?: UserRole;
    filterOptions?: {
      languages: Array<{ language: string }>;
      tags: Array<{ tag: string }>;
      progressStatuses: Array<{ my_progress_status: string }>;
      types: Array<{ type: string }>;
      allLanguages: Array<{ id: string; language: string }>;
      allTags: Array<{ tag: string }>;
      allTypes: Array<{ type: string }>;
    };
  };

  let {
    data,
    columns,
    onSentinelMount,
    isLoading = false,
    userRole = "user",
    filterOptions,
  }: DataTableProps<TData, TValue> = $props();

  // Create and provide edit mode context
  const editMode = createEditModeState();
  setEditModeContext(editMode);

  // Provide edit options context for editable cells

  setContext("editOptions", {
    languages: () => filterOptions?.allLanguages ?? [],
    types: () => filterOptions?.allTypes.map((t) => t.type) ?? [],
    tags: () => filterOptions?.allTags.map((t) => t.tag) ?? [],
    userRole: () => userRole,
  });

  // Get default column order (excluding index which will always be first)
  let defaultColumnOrder = $derived(
    columns
      .map((col) => {
        if ("id" in col && col.id) return col.id;
        if ("accessorKey" in col && col.accessorKey)
          return col.accessorKey as string;
        return null;
      })
      .filter((id): id is string => id !== null),
  );

  // Initialize state in component
  let columnSettings = $state<ColumnSettings>({});
  let isSettingsLoaded = $state(false);

  // Use hook to manage effects
  const { handleColumnVisibilityChange, handleColumnOrderChange } =
    useColumnSettings(
      () => columnSettings,
      (value) => {
        columnSettings = value;
      },
      () => isSettingsLoaded,
      (value) => {
        isSettingsLoaded = value;
      },
      () => defaultColumnOrder, // Pass as getter for reactivity
    );

  // Derive column order from settings (excluding index, which is always first)
  let columnOrder = $derived.by(() => {
    const settings = columnSettings;
    if (Object.keys(settings).length === 0) {
      return defaultColumnOrder;
    }

    const ordered = Object.keys(settings)
      .filter((id) => id !== "order")
      .sort(
        (a, b) => (settings[a]?.order ?? 999) - (settings[b]?.order ?? 999),
      );

    return ["order", ...ordered];
  });

  // Derive visibility state from settings
  let columnVisibility = $derived.by(() => {
    const settings = columnSettings;
    const visibility: VisibilityState = {};
    Object.keys(settings).forEach((columnId) => {
      visibility[columnId] = settings[columnId]?.visible !== false;
    });
    // Hide avg_rating column when in edit mode
    if (editMode.isEditMode) {
      visibility.avg_rating = false;
    }
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
  function sortingToUrlParams(sortState: SortingState): {
    sortBy?: string;
    sortOrder?: string;
  } {
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
  function handleSortingChange(
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) {
    isSortingChanging = true;
    const newSorting =
      typeof updater === "function" ? updater(sorting) : updater;
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
  function parseFiltersFromUrl(): {
    language: string[];
    tags: string[];
    progress: string[];
    type: string[];
  } {
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
  let filters = $state<{
    language: string[];
    tags: string[];
    progress: string[];
    type: string[];
  }>(parseFiltersFromUrl());
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
  function handleFilterChange(
    filterType: "language" | "tags" | "progress" | "type",
    values: string[],
  ) {
    isFilterChanging = true;
    filters = { ...filters, [filterType]: values };

    // Update URL
    const url = new URL(page.url);

    if (values.length > 0) {
      url.searchParams.set(
        `filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`,
        values.join(","),
      );
    } else {
      url.searchParams.delete(
        `filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`,
      );
    }

    const expectedFilters = JSON.stringify(filters);
    pendingFilters = expectedFilters;
    goto(url.toString(), { keepFocus: true, invalidateAll: true });
  }

  // Add a filter value (used by clickable cells)
  function addFilterValue(
    filterType: "language" | "tags" | "progress" | "type",
    value: string,
  ) {
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
  function removeFilter(
    filterType: "language" | "tags" | "progress" | "type",
    value: string,
  ) {
    const currentValues = filters[filterType];
    const newValues = currentValues.filter((v) => v !== value);
    handleFilterChange(filterType, newValues);
  }

  // Get filter options arrays
  let languageOptions = $derived.by(() => {
    return (
      filterOptions?.languages?.map((l) => l.language).filter(Boolean) ?? []
    );
  });

  let tagOptions = $derived.by(() => {
    return filterOptions?.tags?.map((t) => t.tag).filter(Boolean) ?? [];
  });

  // Helper function to format progress status for display
  function formatProgressStatus(status: string | null): string {
    if (!status) return "Unmarked";
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Helper function to capitalize type values
  function capitalizeType(type: string): string {
    if (!type) return type;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  let progressOptions = $derived.by(() => {
    return (
      filterOptions?.progressStatuses?.map(
        (p) => p.my_progress_status ?? "Unmarked",
      ) ?? []
    );
  });

  let typeOptions = $derived.by(() => {
    return filterOptions?.types?.map((t) => t.type).filter(Boolean) ?? [];
  });

  // Combine original data with new rows from edit mode
  const tableData = $derived.by(() => {
    // Convert new rows to Watchlist format
    const newRowsAsWatchlist = editMode.newRows.map((row) => ({
      id: row.tempId,
      order: 0,
      title: row.title,
      releaseStatus: "",
      seasons: null,
      type: row.type,
      language_id: row.languageId,
      language: row.language,
      tags: row.tags.join(", "),
      avg_rating: "",
      infinity_counts: "0",
      shitty_counts: "0",
      my_rating: null,
      my_infinity: null,
      my_shitty: null,
      my_progress_status: null,
    })) as Watchlist[];

    // Put new rows at the top
    return [...newRowsAsWatchlist, ...(data as Watchlist[])];
  });

  const table = createSvelteTable({
    get data() {
      return tableData as Watchlist[];
    },
    get columns() {
      return columns as ColumnDef<Watchlist, unknown>[];
    },
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
      if (
        newIds.length !== currentIds.length ||
        !newIds.every((id, i) => id === currentIds[i])
      ) {
        dndItems = draggableColumns.map((col) => ({ id: col.id }));
      }
    }
  });

  function handleDndEvent(
    event: CustomEvent<{ items: Array<{ id: string }> }>,
  ) {
    if (event.type === "consider") {
      isDragging = true;
      // Update dndItems to match what dndzone expects during drag, but filter out placeholders
      dndItems = event.detail.items.filter(
        (item) => !item.id.startsWith("id:dnd-shadow-placeholder"),
      );
      return;
    }

    if (event.type === "finalize") {
      isDragging = false;
      const { items } = event.detail;
      // Filter out any placeholder IDs before updating dndItems
      const validItems = items.filter(
        (item) => !item.id.startsWith("id:dnd-shadow-placeholder"),
      );
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

  // Keyboard shortcut: Ctrl+Q to focus search input, Ctrl+S to save in edit mode, Escape to cancel
  $effect(() => {
    // Only set up listener when table is rendered
    if (!renderTable) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Check for Ctrl+Q or Cmd+Q (Mac) - check both key and code for reliability
      const isQ = e.key?.toLowerCase() === "q" || e.code === "KeyQ";
      const isS = e.key?.toLowerCase() === "s" || e.code === "KeyS";
      const isEscape = e.key === "Escape" || e.code === "Escape";
      const isModifier = e.ctrlKey || e.metaKey;

      // Ctrl+S to save in edit mode
      if (isModifier && isS && editMode.isEditMode) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }

      // Escape to cancel edit mode (only if no dialogs are open)
      // Check DOM for any open dialog/alertdialog
      const anyDialogOpen = document.querySelector(
        '[role="dialog"], [role="alertdialog"]',
      );

      if (isEscape && editMode.isEditMode && !anyDialogOpen) {
        e.preventDefault();
        e.stopPropagation();
        handleCancelEdit();
        return;
      }

      if (isModifier && isQ) {
        // Don't prevent if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        // Try ref first, then fallback to ID selector
        const input =
          searchInputRef ||
          (document.getElementById("search-input") as HTMLInputElement);
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

  // Edit mode handlers
  async function handleEnterEditMode() {
    // Show loading state immediately for instant visual feedback
    isEnteringEditMode = true;

    // Wait for Svelte to apply the DOM update (spinner added to DOM)
    await tick();

    // Wait for browser to actually PAINT the spinner
    // Double rAF: first rAF schedules before next paint, second rAF ensures that paint completed
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    // Now enter edit mode - this triggers the reactive cascade (user sees spinner during this)
    editMode.enterEditMode();

    // Clear loading state after browser has painted the edit mode UI
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isEnteringEditMode = false;
      });
    });
  }

  function handleCancelEdit() {
    if (editMode.hasChanges) {
      showCancelEditDialog = true;
      return;
    }
    editMode.exitEditMode();
  }

  function confirmCancelEdit() {
    showCancelEditDialog = false;
    editMode.exitEditMode();
  }

  function handleUndoAllChanges() {
    if (!editMode.hasChanges) {
      toast.info("No changes to undo.");
      return;
    }
    showUndoAllDialog = true;
  }

  function confirmUndoAll() {
    showUndoAllDialog = false;
    editMode.resetEditState();
    toast.success("All changes have been undone.");
  }

  function handleAddNewRow() {
    if (!editMode.canAddRows(userRole)) return;
    const tempId = editMode.addNewRow();
    toast.success("New row added. Fill in the required fields.");
  }

  async function handleSave() {
    if (!editMode.hasChanges) {
      toast.info("No changes to save.");
      editMode.exitEditMode();
      return;
    }

    if (editMode.hasValidationErrors) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    const changeset = editMode.getChangeset();

    // Validate new rows have required fields
    for (const newItem of changeset.newItems) {
      if (
        !newItem.title?.trim() ||
        !newItem.languageId?.trim() ||
        !newItem.type?.trim()
      ) {
        toast.error("New rows must have Title, Language, and Type filled in.");
        return;
      }
    }

    // Show delete confirmation if there are deletions
    if (changeset.deleteIds.length > 0) {
      showDeleteConfirmation = true;
      return;
    }

    await executeSave();
  }

  let isSaving = $state(false);
  let isEnteringEditMode = $state(false);

  // Dialog states
  let showDeleteConfirmation = $state(false);
  let showUnsavedChangesDialog = $state(false);
  let showCancelEditDialog = $state(false);
  let showUndoAllDialog = $state(false);
  let pendingServerAction = $state<(() => void) | null>(null);

  // Get titles for delete confirmation
  const deleteTitles = $derived.by(() => {
    const titles: string[] = [];
    for (const id of editMode.deletedRowIds) {
      const row = (data as Watchlist[]).find((r) => r.id === id);
      if (row) {
        titles.push(row.title);
      }
    }
    return titles;
  });

  // Check if user can edit
  const canEdit = $derived(
    userRole === "user" || userRole === "contributor" || userRole === "admin",
  );
  const canAddRows = $derived(
    userRole === "contributor" || userRole === "admin",
  );
  const canDeleteRows = $derived(userRole === "admin");

  // Handle delete confirmation
  function handleDeleteConfirm() {
    showDeleteConfirmation = false;
    // Continue with save
    executeSave();
  }

  function handleDeleteCancel() {
    showDeleteConfirmation = false;
  }

  // Handle unsaved changes dialog
  function handleSaveAndContinue() {
    showUnsavedChangesDialog = false;
    handleSave().then(() => {
      if (pendingServerAction) {
        pendingServerAction();
        pendingServerAction = null;
      }
    });
  }

  function handleDiscardAndContinue() {
    showUnsavedChangesDialog = false;
    editMode.exitEditMode();
    if (pendingServerAction) {
      pendingServerAction();
      pendingServerAction = null;
    }
  }

  function handleStayHere() {
    showUnsavedChangesDialog = false;
    pendingServerAction = null;
  }

  // Check for unsaved changes before server action
  function checkUnsavedChanges(action: () => void) {
    if (editMode.isEditMode && editMode.hasChanges) {
      pendingServerAction = action;
      showUnsavedChangesDialog = true;
      return true;
    }
    return false;
  }

  // Actual save execution
  async function executeSave() {
    const changeset = editMode.getChangeset();

    isSaving = true;

    try {
      const response = await fetch("/api/watchlist/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeset),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save changes.");
        isSaving = false;
        return;
      }

      // Handle partial success
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          toast.error(`Error for ${error.id}: ${error.message}`);
        }
      }

      const successCount =
        (result.results?.updated?.length || 0) +
        (result.results?.created?.length || 0) +
        (result.results?.deleted?.length || 0);

      if (successCount > 0) {
        toast.success(`Successfully saved ${successCount} change(s).`);

        // DON'T clear edit state or exit edit mode before navigation
        // This keeps the edited data visible during the save/reload process
        // preventing the glitch where old data is shown

        // Refresh the page to get updated data
        // Keep isSaving true during navigation to show loading overlay
        // The page reload will cause component remount with fresh data from server
        await goto(page.url.toString(), { invalidateAll: true });

        // After navigation completes (component remounts with fresh state)
        // Edit mode will be off and data will be fresh from server
        // So no need to clear edit state or exit edit mode here
      } else {
        // No changes saved, exit edit mode if no more changes
        if (!editMode.hasChanges) {
          editMode.exitEditMode();
        }
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An unexpected error occurred while saving.");
    } finally {
      // Clear saving state after navigation completes
      isSaving = false;
    }
  }
</script>

{#if renderTable}
  <div>
    <div
      class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 pt-4 px-4 sm:px-8 md:px-16"
    >
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0"
      >
        <Input
          bind:ref={searchInputRef}
          id="search-input"
          placeholder="(Ctrl + Q) to search by title..."
          value={searchValue}
          oninput={handleSearchInput}
          class="max-w-sm w-full"
        />
        {#if filters.language.length > 0 || filters.tags.length > 0 || filters.progress.length > 0 || filters.type.length > 0}
          <div class="flex items-center gap-2 flex-wrap">
            {#each filters.language as value}
              <Button
                variant="outline"
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
                variant="outline"
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
                variant="outline"
                onclick={() => removeFilter("progress", value)}
                class="rounded-full capitalize h-5 py-0 w-fit cursor-pointer text-[0.625rem] font-medium flex items-center gap-1 px-2"
                aria-label="Remove filter"
              >
                {formatProgressStatus(value)}
                <XIcon class="size-3" />
              </Button>
            {/each}
            {#each filters.type as value}
              <Button
                variant="outline"
                onclick={() => removeFilter("type", value)}
                class="rounded-full capitalize h-5 py-0 w-fit cursor-pointer text-[0.625rem] font-medium flex items-center gap-1 px-2"
                aria-label="Remove filter"
              >
                {capitalizeType(value)}
                <XIcon class="size-3" />
              </Button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Edit Mode Toolbar -->
      <div class="flex items-center gap-2 sm:ms-auto">
        {#if !editMode.isEditMode && !isEnteringEditMode}
          <!-- Normal mode: Show pencil icon to enter edit mode -->
          {#if canEdit}
            <Button
              variant="outline"
              size="icon"
              onclick={handleEnterEditMode}
              title="Enter edit mode"
              class="flex items-center dark:hover:bg-white/70 hover:text-accent justify-center"
            >
              <PencilIcon class="size-4" />
            </Button>
          {/if}
        {:else if isEnteringEditMode}
          <!-- Loading state while entering edit mode -->
          <Button
            variant="outline"
            size="icon"
            disabled
            class="flex items-center justify-center"
          >
            <div
              class="size-4 border-2 border-t-transparent border-primary rounded-full animate-spin"
            ></div>
          </Button>
        {:else}
          <!-- Edit mode: Show save, cancel, add row buttons -->
          <div class="flex items-center gap-2">
            <!-- Undo all changes button -->
            {#if editMode.hasChanges}
              <Button
                variant="outline"
                size="icon"
                onclick={handleUndoAllChanges}
                disabled={isSaving || !editMode.hasChanges}
                title="Undo all changes"
                class="flex items-center justify-center text-amber-600 hover:text-amber-700 dark:hover:bg-amber-950"
              >
                <RotateCcwIcon class="size-4" />
              </Button>
            {/if}
            <!-- Add row button (contributors and admins only) -->
            {#if canAddRows}
              <Button
                variant="outline"
                size="icon"
                onclick={handleAddNewRow}
                disabled={isSaving}
                title="Add new row"
                class="flex items-center justify-center text-blue-600 hover:text-blue-700 dark:hover:bg-blue-950"
              >
                <PlusIcon class="size-4" />
              </Button>
            {/if}

            <!-- Save button -->
            <Button
              variant="outline"
              size="icon"
              onclick={handleSave}
              disabled={isSaving || editMode.hasValidationErrors}
              title="Save changes (Ctrl+S)"
              class="flex items-center justify-center text-green-600 hover:text-green-700 dark:hover:bg-green-950"
            >
              {#if isSaving}
                <div
                  class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                ></div>
              {:else}
                <CheckIcon class="size-4" />
              {/if}
            </Button>

            <!-- Cancel button -->
            <Button
              variant="outline"
              size="icon"
              onclick={handleCancelEdit}
              disabled={isSaving}
              title="Cancel edit mode (Esc)"
              class="flex items-center justify-center text-red-600 hover:text-red-700  dark:hover:bg-red-950"
            >
              <XIcon class="size-4" />
            </Button>
          </div>
        {/if}

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
          <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
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
                {@const meta = column?.columnDef.meta as
                  | Record<string, unknown>
                  | undefined}
                {@const displayName =
                  (meta?.displayName as string | undefined) ??
                  (typeof column?.columnDef.header === "string"
                    ? column.columnDef.header
                    : null) ??
                  item.id
                    .replace(/_/g, " ")
                    .split(" ")
                    .map(
                      (word) =>
                        word.charAt(0).toUpperCase() +
                        word.slice(1).toLowerCase(),
                    )
                    .join(" ")}
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
    </div>
    <div class="rounded-md relative">
      <!-- Loading overlay during save -->
      <!-- {#if isSaving}
        <div
          class="absolute inset-0 bg-white/1 backdrop-blur-md z-50 flex items-center justify-center rounded-md"
          role="status"
          aria-label="Saving changes..."
        >
          <div class="flex flex-col items-center gap-3">
            <div
              class="size-8 border-4 border-t-transparent border-primary rounded-full animate-spin"
            ></div>
            <p class="text-sm font-medium text-muted-foreground">
              Saving changes...
            </p>
          </div>
        </div>
      {/if} -->
      <Table.Root class="border-separate border-spacing-y-2">
        <Table.Header>
          {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
            <Table.Row
              class="sticky top-0 bg-primary-foreground z-1 scale-[97%] transition-all duration-500 ease-out  [&>th:first-child]:border-l [&>th:first-child]:pl-4 [&>th:first-child]:rounded-l-md [&>th:last-child]:border-r [&>th:last-child]:pr-4 [&>th:last-child]:rounded-r-md [&>th]:border-t [&>th]:border-b"
            >
              {#each headerGroup.headers as header (header.id)}
                {@const isRightAligned =
                  header.column.id === "my_rating" ||
                  header.column.id === "avg_rating"}
                <Table.Head colspan={header.colSpan} class="border-input">
                  {#if !header.isPlaceholder}
                    <div
                      class="flex items-center gap-2 {isRightAligned
                        ? 'justify-end'
                        : ''}"
                    >
                      {#if header.column.getCanSort()}
                        <Button
                          variant="ghost"
                          class="flex p-0 dark:hover:bg-transparent items-center gap-2 hover:opacity-80 transition-opacity"
                          onclick={() => {
                            const columnId = header.column.id;
                            const currentSortIndex = sorting.findIndex(
                              (s) => s.id === columnId,
                            );

                            const currentSort = sorting[currentSortIndex];
                            let newSort: typeof currentSort | null = {
                              ...currentSort,
                            };

                            if (currentSort) {
                              if (currentSort.desc) newSort.desc = false;
                              else newSort = null;
                            } else {
                              newSort = { id: columnId, desc: true };
                            }
                            const newSorting = [...sorting];
                            if (currentSort)
                              newSorting.splice(currentSortIndex, 1);
                            if (newSort) newSorting.push(newSort);

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
                          onApply={(values) =>
                            handleFilterChange("language", values)}
                          placeholder="Search languages..."
                        />
                      {:else if header.column.id === "tags" && filterOptions}
                        <FilterDropdown
                          options={tagOptions}
                          selectedValues={filters.tags}
                          onApply={(values) =>
                            handleFilterChange("tags", values)}
                          placeholder="Search tags..."
                        />
                      {:else if header.column.id === "my_progress_status" && filterOptions}
                        <FilterDropdown
                          options={progressOptions}
                          selectedValues={filters.progress}
                          onApply={(values) =>
                            handleFilterChange("progress", values)}
                          placeholder="Search progress..."
                        />
                      {:else if header.column.id === "type" && filterOptions}
                        <FilterDropdown
                          options={typeOptions}
                          selectedValues={filters.type}
                          onApply={(values) =>
                            handleFilterChange("type", values)}
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
            {@const isEditMode = editMode.isEditMode}
            {@const isDeleted = editMode.isRowDeleted(
              (row.original as Watchlist).id,
            )}
            {@const isSelected = editMode.isRowSelected(
              (row.original as Watchlist).id,
            )}
            {@const isNewRow = (row.original as Watchlist).id.startsWith(
              "temp-",
            )}
            <Table.Row
              data-state={row.getIsSelected() && "selected"}
              class="{isEditMode
                ? ''
                : 'hover:scale-[102%]'} scale-[97%] transition-all duration-300 ease-out bg-white/1 backdrop-blur-md [&>td:first-child]:border-l [&>td:first-child]:pl-4 [&>td:first-child]:rounded-l-md [&>td:last-child]:border-r [&>td:last-child]:pr-4 [&>td:last-child]:px-4 [&>td:last-child]:rounded-r-md [&>td]:border-t [&>td]:border-b {isDeleted
                ? 'opacity-50 line-through bg-red-500/10'
                : ''} {isSelected ? 'bg-blue-500/10' : ''} {isNewRow
                ? 'bg-green-500/5 border-l-2 border-l-green-500'
                : ''}"
            >
              {#each row.getVisibleCells() as cell (cell.id)}
                {@const isCellRightAligned =
                  cell.column.id === "my_rating" ||
                  cell.column.id === "avg_rating"}
                <Table.Cell
                  class="border-transparent py-4 items-center {isCellRightAligned
                    ? 'text-end'
                    : ''}"
                >
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

  <!-- Bulk Edit Panel -->
  <BulkEditPanel data={data as Watchlist[]} />

  <!-- Delete Confirmation Dialog -->
  <DeleteConfirmationDialog
    bind:open={showDeleteConfirmation}
    titles={deleteTitles}
    onConfirm={handleDeleteConfirm}
    onCancel={handleDeleteCancel}
  />

  <!-- Unsaved Changes Dialog -->
  <UnsavedChangesDialog
    bind:open={showUnsavedChangesDialog}
    onSaveAndContinue={handleSaveAndContinue}
    onDiscardAndContinue={handleDiscardAndContinue}
    onCancel={handleStayHere}
  />

  <!-- Cancel Edit Confirmation Dialog -->
  <ConfirmDialog
    bind:open={showCancelEditDialog}
    title="Discard Changes?"
    description="You have unsaved changes. Are you sure you want to cancel and discard all changes?"
    confirmLabel="Discard Changes"
    cancelLabel="Keep Editing"
    variant="destructive"
    onConfirm={confirmCancelEdit}
    onCancel={() => (showCancelEditDialog = false)}
  />

  <!-- Undo All Changes Confirmation Dialog -->
  <ConfirmDialog
    bind:open={showUndoAllDialog}
    title="Undo All Changes?"
    description="Are you sure you want to undo all changes? This will revert all edits back to their original values."
    confirmLabel="Undo All"
    cancelLabel="Cancel"
    variant="destructive"
    onConfirm={confirmUndoAll}
    onCancel={() => (showUndoAllDialog = false)}
  />
{/if}
