/**
 * Composable for paginated data fetching with infinite scroll support.
 *
 * @param options Configuration options for data fetching
 * @returns Reactive state and loadMore function for paginated data
 *
 * @example
 * ```svelte
 * <script>
 *   const { data, hasMore, loadMore } = useDataFetch({
 *     initialData: initialItems,
 *     fetchUrl: (pageIndex) => `/api/watchlist?pageIndex=${pageIndex}`,
 *     pageSize: 25,
 *     searchQuery: $page.url.searchParams.get("q")
 *   });
 * </script>
 * ```
 */
export function useDataFetch<T>(options: {
  initialData: T[] | (() => T[]);
  fetchUrl:
    | string
    | ((
        pageIndex: number,
        searchQuery?: string,
        sortBy?: string,
        sortOrder?: string,
        filterLanguage?: string,
        filterTags?: string,
        filterProgress?: string,
        filterType?: string
      ) => string);
  pageSize?: number;
  searchQuery?: string | (() => string | null | undefined);
  sortBy?: string | (() => string | null | undefined);
  sortOrder?: string | (() => string | null | undefined);
  filterLanguage?: string | (() => string | null | undefined);
  filterTags?: string | (() => string | null | undefined);
  filterProgress?: string | (() => string | null | undefined);
  filterType?: string | (() => string | null | undefined);
}) {
  const { initialData, fetchUrl, pageSize = 25, searchQuery, sortBy, sortOrder, filterLanguage, filterTags, filterProgress, filterType } = options;

  // Try to initialize synchronously first
  let initialItems: T[] = [];
  let syncInitialized = false;
  try {
    initialItems = typeof initialData === "function" ? initialData() : initialData;
    syncInitialized = initialItems.length > 0;
  } catch {
    // If function throws (e.g., data not available yet), use empty array
    initialItems = [];
    syncInitialized = false;
  }

  let data = $state<T[]>(initialItems);
  let pageIndex = $state(0);
  let hasMore = $state(true);
  let initialized = $state(syncInitialized);
  let lastSearchQuery = $state<string | null | undefined>(typeof searchQuery === "function" ? searchQuery() : searchQuery);
  let lastSortBy = $state<string | null | undefined>(typeof sortBy === "function" ? sortBy() : sortBy);
  let lastSortOrder = $state<string | null | undefined>(typeof sortOrder === "function" ? sortOrder() : sortOrder);
  let lastFilterLanguage = $state<string | null | undefined>(typeof filterLanguage === "function" ? filterLanguage() : filterLanguage);
  let lastFilterTags = $state<string | null | undefined>(typeof filterTags === "function" ? filterTags() : filterTags);
  let lastFilterProgress = $state<string | null | undefined>(typeof filterProgress === "function" ? filterProgress() : filterProgress);
  let lastFilterType = $state<string | null | undefined>(typeof filterType === "function" ? filterType() : filterType);

  // Set hasMore based on initial data
  if (syncInitialized && initialItems.length < pageSize) {
    hasMore = false;
  }

  // Track changes to searchQuery, sorting, and filters, reset data when they change
  $effect(() => {
    const currentSearchQuery = typeof searchQuery === "function" ? searchQuery() : searchQuery;
    const currentSortBy = typeof sortBy === "function" ? sortBy() : sortBy;
    const currentSortOrder = typeof sortOrder === "function" ? sortOrder() : sortOrder;
    const currentFilterLanguage = typeof filterLanguage === "function" ? filterLanguage() : filterLanguage;
    const currentFilterTags = typeof filterTags === "function" ? filterTags() : filterTags;
    const currentFilterProgress = typeof filterProgress === "function" ? filterProgress() : filterProgress;
    const currentFilterType = typeof filterType === "function" ? filterType() : filterType;

    // If search query, sorting, or filters changed, reset everything
    if (
      currentSearchQuery !== lastSearchQuery ||
      currentSortBy !== lastSortBy ||
      currentSortOrder !== lastSortOrder ||
      currentFilterLanguage !== lastFilterLanguage ||
      currentFilterTags !== lastFilterTags ||
      currentFilterProgress !== lastFilterProgress ||
      currentFilterType !== lastFilterType
    ) {
      lastSearchQuery = currentSearchQuery;
      lastSortBy = currentSortBy;
      lastSortOrder = currentSortOrder;
      lastFilterLanguage = currentFilterLanguage;
      lastFilterTags = currentFilterTags;
      lastFilterProgress = currentFilterProgress;
      lastFilterType = currentFilterType;
      // Reset data and pagination - allow initialData effect to pick up new data
      data = [];
      pageIndex = 0;
      initialized = false;
      hasMore = true;
    }
  });

  // Track changes to initialData reactively (for when data prop updates)
  $effect(() => {
    // Call the function to get items - this will track reactive dependencies
    const items = typeof initialData === "function" ? initialData() : initialData;

    if (!items || items.length === 0) {
      // If no items and not initialized, mark as initialized to prevent infinite loops
      if (!initialized) {
        initialized = true;
      }
      return;
    }

    // If not initialized yet, initialize with the data
    if (!initialized) {
      data = items;
      pageIndex = 0;
      initialized = true;

      // If we got fewer items than page size, we've reached the end
      if (items.length < pageSize) {
        hasMore = false;
      }
      return;
    }

    // If already initialized and we're on page 0, update data when initialData changes
    // This handles the case when invalidateAll: true causes page data to reload
    if (pageIndex === 0) {
      // Always update when on first page and initialData changes
      // This ensures sorted data from server reload is reflected
      data = items;
      hasMore = items.length >= pageSize;
    }
  });

  // Load more items (next page)
  async function loadMore() {
    if (!hasMore) {
      return;
    }

    const nextPageIndex = pageIndex + 1;
    const currentSearchQuery = typeof searchQuery === "function" ? searchQuery() : searchQuery;
    const currentSortBy = typeof sortBy === "function" ? sortBy() : sortBy;
    const currentSortOrder = typeof sortOrder === "function" ? sortOrder() : sortOrder;
    const currentFilterLanguage = typeof filterLanguage === "function" ? filterLanguage() : filterLanguage;
    const currentFilterTags = typeof filterTags === "function" ? filterTags() : filterTags;
    const currentFilterProgress = typeof filterProgress === "function" ? filterProgress() : filterProgress;
    const currentFilterType = typeof filterType === "function" ? filterType() : filterType;
    const url =
      typeof fetchUrl === "function"
        ? fetchUrl(
            nextPageIndex,
            currentSearchQuery ?? undefined,
            currentSortBy ?? undefined,
            currentSortOrder ?? undefined,
            currentFilterLanguage ?? undefined,
            currentFilterTags ?? undefined,
            currentFilterProgress ?? undefined,
            currentFilterType ?? undefined
          )
        : (() => {
            const baseUrl = `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}pageIndex=${nextPageIndex}`;
            let urlWithParams = baseUrl;
            if (currentSearchQuery) {
              urlWithParams += `&q=${encodeURIComponent(currentSearchQuery)}`;
            }
            if (currentSortBy) {
              urlWithParams += `&sortBy=${encodeURIComponent(currentSortBy)}`;
              if (currentSortOrder) {
                urlWithParams += `&sortOrder=${encodeURIComponent(currentSortOrder)}`;
              }
            }
            if (currentFilterLanguage) {
              urlWithParams += `&filterLanguage=${encodeURIComponent(currentFilterLanguage)}`;
            }
            if (currentFilterTags) {
              urlWithParams += `&filterTags=${encodeURIComponent(currentFilterTags)}`;
            }
            if (currentFilterProgress) {
              urlWithParams += `&filterProgress=${encodeURIComponent(currentFilterProgress)}`;
            }
            if (currentFilterType) {
              urlWithParams += `&filterType=${encodeURIComponent(currentFilterType)}`;
            }
            return urlWithParams;
          })();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch page ${nextPageIndex}`);
      }
      const result = await response.json();

      // Extract watchItems if it exists, otherwise assume result is the array
      const items: T[] = result.watchItems ?? result;

      // If we got fewer items than page size, we've reached the end
      if (items.length < pageSize) {
        hasMore = false;
      }

      // Append to data
      data = [...data, ...items];
      pageIndex = nextPageIndex;
    } catch (error) {
      console.error(`Error loading page ${nextPageIndex}:`, error);
    }
  }

  return {
    get data() {
      return data;
    },
    get hasMore() {
      return hasMore;
    },
    loadMore,
  };
}
