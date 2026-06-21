<script lang="ts">
  import { filteredRhymes, type Rhyme } from "../stores/filterStore";

  interface Props {
    rhymes: Rhyme[];
  }

  const { rhymes }: Props = $props();

  type SortOption = "most-recent" | "best";
  type FilterState = {
    sort: SortOption;
    statuses: string[];
    tags: string[];
    contentTypes: string[];
  };

  // Get filter state from URL
  function getFiltersFromUrl(): FilterState {
    if (typeof window === "undefined") {
      return {
        sort: "best",
        statuses: [],
        tags: [],
        contentTypes: [],
      };
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const sort = params.get("sort");
      const statusesParam = params.get("statuses");
      const tagsParam = params.get("tags");
      const contentTypesParam = params.get("types");

      const result = {
        sort: sort === "best" || sort === "most-recent" ? (sort as SortOption) : "best",
        statuses: statusesParam
          ? statusesParam
              .split(",")
              .map((s) => decodeURIComponent(s))
              .filter((s) => s.length > 0)
          : [],
        tags: tagsParam
          ? tagsParam
              .split(",")
              .map((t) => decodeURIComponent(t))
              .filter((t) => t.length > 0)
          : [],
        contentTypes: contentTypesParam
          ? contentTypesParam
              .split(",")
              .map((type) => decodeURIComponent(type))
              .filter((type) => type.length > 0)
          : [],
      };

      return result;
    } catch (e) {
      return {
        sort: "best",
        statuses: [],
        tags: [],
        contentTypes: [],
      };
    }
  }

  // Update URL with current filter state
  function updateUrl(filters: FilterState) {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    // Update or remove sort parameter
    if (filters.sort === "best") {
      url.searchParams.delete("sort");
    } else {
      url.searchParams.set("sort", filters.sort);
    }

    // Update or remove statuses parameter
    if (filters.statuses.length === 0) {
      url.searchParams.delete("statuses");
    } else {
      url.searchParams.set("statuses", filters.statuses.map((s) => encodeURIComponent(s)).join(","));
    }

    // Update or remove tags parameter
    if (filters.tags.length === 0) {
      url.searchParams.delete("tags");
    } else {
      url.searchParams.set("tags", filters.tags.map((t) => encodeURIComponent(t)).join(","));
    }

    if (filters.contentTypes.length === 0) {
      url.searchParams.delete("types");
    } else {
      url.searchParams.set("types", filters.contentTypes.map((type) => encodeURIComponent(type)).join(","));
    }

    window.history.pushState({}, "", url);
  }

  // Initialize filter state from URL
  let filterState = $state<FilterState>(getFiltersFromUrl());

  // Track filter state changes to ensure reactivity
  const filterKey = $derived(
    `${filterState.sort}-${filterState.statuses.join(",")}-${filterState.tags.join(",")}-${filterState.contentTypes.join(",")}`
  );

  let isOpen = $state(false);

  // Get unique statuses and tags from all rhymes
  const allStatuses = $derived.by(() => {
    const statusSet = new Set<string>();
    rhymes.forEach((rhyme) => {
      if (rhyme.frontmatter.status) {
        statusSet.add(rhyme.frontmatter.status);
      }
    });
    return Array.from(statusSet).sort();
  });

  const allTags = $derived.by(() => {
    const tagSet = new Set<string>();
    rhymes.forEach((rhyme) => {
      if (rhyme.frontmatter.tags) {
        rhyme.frontmatter.tags.forEach((tag) => {
          tagSet.add(tag);
        });
      }
    });
    return Array.from(tagSet).sort();
  });

  const allContentTypes = $derived.by(() => {
    const contentTypeSet = new Set<string>();
    rhymes.forEach((rhyme) => {
      contentTypeSet.add(rhyme.contentType);
    });
    return Array.from(contentTypeSet).sort();
  });

  // Apply filters and sorting
  // Use filterKey to ensure recalculation when filter state changes
  const filteredAndSortedRhymes = $derived.by(() => {
    // Access filterKey and filterState to ensure reactivity
    void filterKey;
    const currentStatuses = filterState.statuses;
    const currentTags = filterState.tags;
    const currentContentTypes = filterState.contentTypes;
    const currentSort = filterState.sort;

    let result = [...rhymes];

    // Apply all filters with AND logic in a single filter operation
    result = result.filter((rhyme) => {
      let passesStatusFilter = true;
      let passesTagFilter = true;
      let passesContentTypeFilter = true;

      // Status filter: must match at least one selected status (if any statuses are selected)
      if (currentStatuses.length > 0) {
        const status = rhyme.frontmatter.status;
        passesStatusFilter = !!(status && currentStatuses.includes(status));
      }

      // Tag filter: must have at least one of the selected tags (if any tags are selected)
      if (currentTags.length > 0) {
        const tags = rhyme.frontmatter.tags || [];
        passesTagFilter = currentTags.some((tag) => tags.includes(tag));
      }

      if (currentContentTypes.length > 0) {
        passesContentTypeFilter = currentContentTypes.includes(rhyme.contentType);
      }

      // Both filters must pass (AND logic)
      return passesStatusFilter && passesTagFilter && passesContentTypeFilter;
    });

    // Apply sorting
    if (currentSort === "most-recent") {
      result.sort((a, b) => {
        const orderA = a.frontmatter.order ?? 0;
        const orderB = b.frontmatter.order ?? 0;
        return orderB - orderA; // Descending (most recent first)
      });
    } else if (currentSort === "best") {
      result.sort((a, b) => {
        const ratingA = a.readerAverageRating ?? a.creatorRating ?? a.frontmatter.rating ?? 0;
        const ratingB = b.readerAverageRating ?? b.creatorRating ?? b.frontmatter.rating ?? 0;
        return ratingB - ratingA;
      });
    }

    return result;
  });

  // Initialize store with filtered rhymes on mount
  let initialized = $state(false);
  let urlUpdateEnabled = $state(false);

  $effect(() => {
    if (!initialized) {
      // Use filtered rhymes (which will use URL filters if present)
      const filtered = filteredAndSortedRhymes;
      filteredRhymes.set(filtered);
      initialized = true;
      // Enable URL updates after initialization to avoid updating on initial load
      urlUpdateEnabled = true;
    }
  });

  // Update store when filtered rhymes change (after initialization)
  $effect(() => {
    if (initialized) {
      // Explicitly access the derived value to ensure reactivity
      const filtered = filteredAndSortedRhymes;
      filteredRhymes.set(filtered);
    }
  });

  function toggleStatus(status: string) {
    if (filterState.statuses.includes(status)) {
      filterState.statuses = filterState.statuses.filter((s) => s !== status);
    } else {
      filterState.statuses = [...filterState.statuses, status];
    }
    // URL will be updated by the effect
  }

  function toggleTag(tag: string) {
    if (filterState.tags.includes(tag)) {
      filterState.tags = filterState.tags.filter((t) => t !== tag);
    } else {
      filterState.tags = [...filterState.tags, tag];
    }
    // URL will be updated by the effect
  }

  function setSort(sort: SortOption) {
    filterState.sort = sort;
    // URL will be updated by the effect
  }

  function toggleContentType(contentType: string) {
    if (filterState.contentTypes.includes(contentType)) {
      filterState.contentTypes = filterState.contentTypes.filter((type) => type !== contentType);
    } else {
      filterState.contentTypes = [...filterState.contentTypes, contentType];
    }
  }

  function clearFilters() {
    filterState.statuses = [];
    filterState.tags = [];
    filterState.contentTypes = [];
    filterState.sort = "best";
    // URL will be updated by the effect
  }

  // Update URL when filter state changes (but not on initial load)
  $effect(() => {
    if (urlUpdateEnabled && initialized) {
      updateUrl(filterState);
    }
  });

  // Handle browser back/forward buttons
  function handlePopState() {
    const newFilters = getFiltersFromUrl();
    filterState.sort = newFilters.sort;
    filterState.statuses = newFilters.statuses;
    filterState.tags = newFilters.tags;
    filterState.contentTypes = newFilters.contentTypes;
  }

  // Set up popstate listener
  $effect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  const hasActiveFilters = $derived(
    filterState.statuses.length > 0 ||
      filterState.tags.length > 0 ||
      filterState.contentTypes.length > 0 ||
      filterState.sort !== "best"
  );
</script>

<div class="relative">
  <button
    type="button"
    onclick={() => (isOpen = !isOpen)}
    class="p-1 bg-theme-pink-1 border-2 border-theme-pink-5 hover:bg-theme-pink-2 transition-colors cursor-pointer flex items-center justify-center {hasActiveFilters
      ? 'ring-2 ring-theme-red-1'
      : ''}"
    title="Filter and Sort"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-theme-red-2 w-4 h-4 lg:w-6 lg:h-6"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
  </button>

  {#if isOpen}
    <div class="absolute right-0 top-full mt-2 bg-theme-pink-2 border-2 border-theme-pink-5 p-4 z-50 min-w-[280px] max-h-[80vh] overflow-y-auto">
      <div class="flex flex-col gap-4">
        <!-- Sort Options -->
        <div>
          <h3 class="text-sm font-heading text-theme-peach-1 mb-2">Sort By</h3>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sort"
                checked={filterState.sort === "most-recent"}
                onchange={() => setSort("most-recent")}
                class="accent-theme-red-1"
              />
              <span class="text-xs text-theme-peach-1">Most Recent</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="sort" checked={filterState.sort === "best"} onchange={() => setSort("best")} class="accent-theme-red-1" />
              <span class="text-xs text-theme-peach-1">Best (by Rating)</span>
            </label>
          </div>
        </div>

        <!-- Status Filter -->
        <div>
          <h3 class="text-sm font-heading text-theme-peach-1 mb-2">Status</h3>
          <div class="flex flex-col gap-2 max-h-32 overflow-y-auto">
            {#each allStatuses as status}
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterState.statuses.includes(status)}
                  onchange={() => toggleStatus(status)}
                  class="accent-theme-red-1"
                />
                <span class="text-xs text-theme-peach-1">{status}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Tags Filter -->
        <div>
          <h3 class="text-sm font-heading text-theme-peach-1 mb-2">Tags</h3>
          <div class="flex flex-col gap-2 max-h-32 overflow-y-auto">
            {#each allTags as tag}
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterState.tags.includes(tag)} onchange={() => toggleTag(tag)} class="accent-theme-red-1" />
                <span class="text-xs text-theme-peach-1">{tag}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Content Type Filter -->
        <div>
          <h3 class="text-sm font-heading text-theme-peach-1 mb-2">Content Type</h3>
          <div class="flex flex-col gap-2 max-h-32 overflow-y-auto">
            {#each allContentTypes as contentType}
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterState.contentTypes.includes(contentType)}
                  onchange={() => toggleContentType(contentType)}
                  class="accent-theme-red-1"
                />
                <span class="text-xs text-theme-peach-1 capitalize">{contentType}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Clear Filters Button -->
        {#if hasActiveFilters}
          <button type="button" onclick={clearFilters} class="text-xs text-theme-red-1 hover:text-theme-red-2 underline cursor-pointer text-left">
            Clear Filters
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Click outside to close -->
{#if isOpen}
  <div class="fixed inset-0 z-40" onclick={() => (isOpen = false)} role="presentation"></div>
{/if}
