/**
 * Composable for infinite scroll functionality using IntersectionObserver.
 *
 * @param options Configuration options for infinite scroll
 * @returns Reactive state and handlers for infinite scroll
 *
 * @example
 * ```svelte
 * <script>
 *   const { sentinelElement, isLoading, onSentinelMount } = useInfiniteScroll({
 *     loadMore: async () => {
 *       // Load more data
 *     }
 *   });
 * </script>
 *
 * <div bind:this={sentinelElement} />
 * ```
 */
export function useInfiniteScroll(options: {
  loadMore: () => Promise<void> | void;
  debounceMs?: number;
  rootMargin?: string;
  threshold?: number;
  enabled?: () => boolean;
}) {
  const {
    loadMore,
    debounceMs = 500,
    rootMargin = "100px",
    threshold = 0.01,
    enabled = () => true,
  } = options;

  let sentinelElement = $state<HTMLElement | null>(null);
  let isLoading = $state(false);
  let observerInstance: IntersectionObserver | null = null;
  let lastLoadTime = 0;

  function onSentinelMount(element: HTMLElement) {
    sentinelElement = element;
  }

  $effect(() => {
    if (!sentinelElement || observerInstance) return;

    observerInstance = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        // Check if enabled - access enabled() to track it reactively
        const isEnabled = enabled();
        if (!isEnabled) return;

        // Debounce rapid calls
        const now = Date.now();
        if (now - lastLoadTime < debounceMs) {
          return;
        }

        if (!isLoading) {
          lastLoadTime = now;
          isLoading = true;

          Promise.resolve(loadMore())
            .catch((error) => {
              console.error("Error in loadMore:", error);
            })
            .finally(() => {
              isLoading = false;
            });
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observerInstance.observe(sentinelElement);

    return () => {
      if (observerInstance) {
        observerInstance.disconnect();
        observerInstance = null;
      }
    };
  });

  return {
    get sentinelElement() {
      return sentinelElement;
    },
    get isLoading() {
      return isLoading;
    },
    onSentinelMount,
  };
}
