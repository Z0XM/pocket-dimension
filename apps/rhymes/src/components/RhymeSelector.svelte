<script lang="ts">
  interface Rhyme {
    frontmatter: {
      title?: string;
      thought_on?: string;
      order?: number;
      [key: string]: any;
    };
    content: string;
  }

  interface Props {
    rhymes: Rhyme[];
  }

  const { rhymes }: Props = $props();

  // Get default order (first rhyme's order)
  const getDefaultOrder = (): number => {
    if (rhymes.length === 0) return 0;
    return rhymes[0].frontmatter.order ?? 0;
  };

  // Find rhyme by order
  function findRhymeByOrder(order: number): Rhyme | undefined {
    return rhymes.find((rhyme) => rhyme.frontmatter.order === order);
  }

  // Get initial order from URL
  function getOrderFromUrl(): number {
    if (typeof window === "undefined") return getDefaultOrder();
    try {
      const params = new URLSearchParams(window.location.search);
      const orderParam = params.get("rhyme");
      if (orderParam !== null) {
        const order = parseInt(orderParam, 10);
        if (!Number.isNaN(order) && findRhymeByOrder(order)) {
          return order;
        }
      }
    } catch (e) {
      // Fallback to default if URL parsing fails
    }
    return getDefaultOrder();
  }

  // Update URL when selection changes
  function updateUrl(order: number) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("rhyme", order.toString());
    window.history.pushState({}, "", url);
  }

  // Initialize selected order
  let selectedOrder = $state(0);
  let titleContainer: HTMLDivElement | null = $state(null);

  // Initialize from URL on client side, or use default
  $effect(() => {
    if (typeof window !== "undefined" && rhymes.length > 0) {
      const orderFromUrl = getOrderFromUrl();
      const validOrder = findRhymeByOrder(orderFromUrl)
        ? orderFromUrl
        : getDefaultOrder();
      selectedOrder = validOrder;
      // Update URL if it wasn't set
      if (!new URLSearchParams(window.location.search).has("rhyme")) {
        updateUrl(validOrder);
      }
    }
  });

  // Handle title click
  function selectRhyme(order: number) {
    selectedOrder = order;
    updateUrl(order);
    scrollToTitle(order);
  }

  // Scroll to selected title
  function scrollToTitle(order: number) {
    if (!titleContainer) return;

    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const targetElement = titleContainer?.querySelector(
        `[data-rhyme-order="${order}"]`,
      ) as HTMLElement;

      if (targetElement && titleContainer) {
        const containerRect = titleContainer.getBoundingClientRect();
        const elementRect = targetElement.getBoundingClientRect();
        const scrollLeft = titleContainer.scrollLeft;
        const elementLeft = elementRect.left - containerRect.left + scrollLeft;
        const elementWidth = elementRect.width;
        const containerWidth = containerRect.width;

        // Center the element in the container
        const targetScroll =
          elementLeft - containerWidth / 2 + elementWidth / 2;

        titleContainer.scrollTo({
          left: targetScroll,
          behavior: "smooth",
        });
      }
    }, 0);
  }

  // Handle browser back/forward buttons
  function handlePopState() {
    const newOrder = getOrderFromUrl();
    if (newOrder !== selectedOrder) {
      selectedOrder = newOrder;
      scrollToTitle(newOrder);
    }
  }

  // Set up popstate listener with cleanup
  $effect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  // Scroll to initial selected title on mount and when container is ready
  $effect(() => {
    if (titleContainer) {
      // Use a small delay to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        scrollToTitle(selectedOrder);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  });

  // Make scroll more sensitive with wheel event
  $effect(() => {
    if (!titleContainer) return;

    function handleWheel(e: WheelEvent) {
      if (titleContainer && e.deltaY !== 0) {
        // Increase scroll sensitivity by multiplying delta
        const sensitivity = 2; // Adjust this value to make it more/less sensitive
        titleContainer.scrollLeft += e.deltaY * sensitivity;
        e.preventDefault();
      }
    }

    titleContainer.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (titleContainer) {
        titleContainer.removeEventListener("wheel", handleWheel);
      }
    };
  });

  const selectedRhyme = $derived.by(() => {
    const rhyme = findRhymeByOrder(selectedOrder);
    // If no rhyme found, fallback to first rhyme
    return rhyme ?? (rhymes.length > 0 ? rhymes[0] : undefined);
  });
</script>

<div class="flex flex-col items-center w-full h-full">
  <div
    bind:this={titleContainer}
    class="flex flex-row overflow-x-scroll flex-nowrap w-screen gap-2 px-[50vw] title-scroll-container"
  >
    {#each rhymes as rhyme, index}
      {@const order = rhyme.frontmatter.order ?? index + 1000}
      <button
        data-rhyme-order={order}
        type="button"
        onclick={() => selectRhyme(order)}
        class="text-lg md:text-2xl font-heading px-4 md:px-8 py-2 bg-theme-pink-1 border-x-2 border-t-2 border-theme-pink-5 whitespace-nowrap shrink-0 transition-all cursor-pointer hover:bg-theme-pink-2"
      >
        {rhyme.frontmatter.title || "Untitled"}
      </button>
    {/each}
  </div>
  <div
    class="relative bg-theme-light-pink-1 p-4 md:p-6 flex-1 shrink-0 lg:w-4xl h-full overflow-y-auto px-4 md:px-8 py-4 md:py-8 border-2 border-theme-pin-5"
  >
    {#if selectedRhyme}
      <div class="right-0 absolute top-0 px-4 py-2">
        {selectedRhyme.frontmatter.thought_on || ""}
      </div>
      <pre class="content-text mt-8 pb-32">{selectedRhyme.content}</pre>
    {/if}
  </div>
</div>
s

<style>
  .content-text {
    white-space: pre-wrap;
    font-family: var(--font-content);
    font-size: var(--text-base);
    line-height: var(--tw-leading, var(--text-base--line-height));
  }

  @media (width >= 48rem) {
    .content-text {
      font-size: var(--text-xl);
      line-height: var(--tw-leading, var(--text-xl--line-height));
    }
  }

  .title-scroll-container {
    scroll-behavior: smooth;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .title-scroll-container button {
    scroll-snap-align: center;
  }

  /* Increase scroll sensitivity */
  .title-scroll-container {
    scroll-padding: 0 50vw;
  }
</style>
