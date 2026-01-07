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
 *     pageSize: 25
 *   });
 * </script>
 * ```
 */
export function useDataFetch<T>(options: {
  initialData: T[] | (() => T[]);
  fetchUrl: string | ((pageIndex: number) => string);
  pageSize?: number;
}) {
  const { initialData, fetchUrl, pageSize = 25 } = options;

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

  // Set hasMore based on initial data
  if (syncInitialized && initialItems.length < pageSize) {
    hasMore = false;
  }

  // Track changes to initialData reactively (for when data prop updates)
  $effect(() => {
    // Only initialize once
    if (initialized) return;

    // Call the function to get items - this will track reactive dependencies
    const items = typeof initialData === "function" ? initialData() : initialData;

    if (!items || items.length === 0) return;

    // Set data and mark as initialized
    data = items;
    pageIndex = 0;
    initialized = true;

    // If we got fewer items than page size, we've reached the end
    if (items.length < pageSize) {
      hasMore = false;
    }
  });

  // Load more items (next page)
  async function loadMore() {
    if (!hasMore) {
      return;
    }

    const nextPageIndex = pageIndex + 1;
    const url =
      typeof fetchUrl === "function"
        ? fetchUrl(nextPageIndex)
        : `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}pageIndex=${nextPageIndex}`;

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
