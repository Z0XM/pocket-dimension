<script lang="ts">
import { marked } from "marked";
import { filteredRhymes, type Rhyme } from "../stores/filterStore";

interface Props {
  rhymes: Rhyme[];
  useFiltered?: boolean;
}

const { rhymes: initialRhymes, useFiltered = false }: Props = $props();

// Use filtered rhymes from store if useFiltered is true, otherwise use initial rhymes
let rhymes = $state(initialRhymes);

if (useFiltered) {
  $effect(() => {
    const unsubscribe = filteredRhymes.subscribe((value) => {
      // Always use the filtered value, even if empty (empty means no matches)
      rhymes = value;
    });
    return unsubscribe;
  });
} else {
  rhymes = initialRhymes;
}

// Configure marked to allow HTML (for <br> tags) and GitHub Flavored Markdown
marked.setOptions({ breaks: true, gfm: true });

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
let contentArea: HTMLDivElement | null = $state(null);

// Initialize from URL on client side, or use default
$effect(() => {
  if (typeof window !== "undefined" && rhymes.length > 0) {
    const orderFromUrl = getOrderFromUrl();
    const validOrder = findRhymeByOrder(orderFromUrl) ? orderFromUrl : getDefaultOrder();
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
    const targetElement = titleContainer?.querySelector(`[data-rhyme-order="${order}"]`) as HTMLElement;

    if (targetElement && titleContainer) {
      const containerRect = titleContainer.getBoundingClientRect();
      const elementRect = targetElement.getBoundingClientRect();

      // Check if we're on large screen (vertical scroll) or small screen (horizontal scroll)
      const isLargeScreen = window.innerWidth >= 1024; // lg breakpoint

      if (isLargeScreen) {
        // Vertical scrolling for large screens
        const scrollTop = titleContainer.scrollTop;
        const elementTop = elementRect.top - containerRect.top + scrollTop;
        const elementHeight = elementRect.height;
        const containerHeight = containerRect.height;

        // Center the element in the container vertically
        const targetScroll = elementTop - containerHeight / 2 + elementHeight / 2;

        titleContainer.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        });
      } else {
        // Horizontal scrolling for small screens
        const scrollLeft = titleContainer.scrollLeft;
        const elementLeft = elementRect.left - containerRect.left + scrollLeft;
        const elementWidth = elementRect.width;
        const containerWidth = containerRect.width;

        // Center the element in the container
        const targetScroll = elementLeft - containerWidth / 2 + elementWidth / 2;

        titleContainer.scrollTo({
          left: targetScroll,
          behavior: "smooth",
        });
      }
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
      // Check if we're on large screen (vertical scroll) or small screen (horizontal scroll)
      const isLargeScreen = window.innerWidth >= 1024; // lg breakpoint

      // Increase scroll sensitivity by multiplying delta
      const sensitivity = 2; // Adjust this value to make it more/less sensitive

      if (isLargeScreen) {
        // Vertical scrolling for large screens
        titleContainer.scrollTop += e.deltaY * sensitivity;
      } else {
        // Horizontal scrolling for small screens
        titleContainer.scrollLeft += e.deltaY * sensitivity;
      }
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

// Process markdown content to HTML
const processedContent = $derived.by(() => {
  if (!selectedRhyme) return "";
  return marked.parse(selectedRhyme.content) as string;
});

// Get next rhyme order
function getNextRhymeOrder(): number | null {
  if (rhymes.length === 0) return null;
  const currentIndex = rhymes.findIndex((r) => (r.frontmatter.order ?? 0) === selectedOrder);
  if (currentIndex === -1) return null;
  // Since rhymes are sorted descending, next is previous index
  if (currentIndex > 0) {
    const nextRhyme = rhymes[currentIndex - 1];
    return nextRhyme.frontmatter.order ?? null;
  }
  return null;
}

// Get previous rhyme order
function getPreviousRhymeOrder(): number | null {
  if (rhymes.length === 0) return null;
  const currentIndex = rhymes.findIndex((r) => (r.frontmatter.order ?? 0) === selectedOrder);
  if (currentIndex === -1) return null;
  // Since rhymes are sorted descending, previous is next index
  if (currentIndex < rhymes.length - 1) {
    const prevRhyme = rhymes[currentIndex + 1];
    return prevRhyme.frontmatter.order ?? null;
  }
  return null;
}

// Swipe detection state
let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;
const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe

// Handle touch/mouse start
function handleStart(e: TouchEvent | MouseEvent) {
  if (e instanceof TouchEvent) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isDragging = true;
    }
  } else {
    // Mouse event
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    isDragging = true;
  }
}

// Handle touch/mouse end
function handleEnd(e: TouchEvent | MouseEvent) {
  if (!isDragging) return;
  isDragging = false;

  let touchEndX: number;
  let touchEndY: number;

  if (e instanceof TouchEvent) {
    if (e.changedTouches.length !== 1) return;
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
  } else {
    // Mouse event
    touchEndX = e.clientX;
    touchEndY = e.clientY;
  }

  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  const distance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  // Only process swipe if horizontal movement is greater than vertical (horizontal swipe)
  if (distance > verticalDistance && distance > SWIPE_THRESHOLD) {
    if (deltaX < 0) {
      // Swipe right - go to previous rhyme
      const prevOrder = getPreviousRhymeOrder();
      if (prevOrder !== null) {
        selectRhyme(prevOrder);
      }
    } else {
      // Swipe left - go to next rhyme
      const nextOrder = getNextRhymeOrder();
      if (nextOrder !== null) {
        selectRhyme(nextOrder);
      }
    }
  }
}

// Handle mouse leave (cancel drag if mouse leaves area)
function handleMouseLeave() {
  isDragging = false;
}

// Set up swipe handlers
$effect(() => {
  if (!contentArea) return;

  // Touch events
  contentArea.addEventListener("touchstart", handleStart, { passive: true });
  contentArea.addEventListener("touchend", handleEnd, { passive: true });

  // Mouse events (for desktop)
  contentArea.addEventListener("mousedown", handleStart);
  contentArea.addEventListener("mouseup", handleEnd);
  contentArea.addEventListener("mouseleave", handleMouseLeave);

  return () => {
    if (contentArea) {
      contentArea.removeEventListener("touchstart", handleStart);
      contentArea.removeEventListener("touchend", handleEnd);
      contentArea.removeEventListener("mousedown", handleStart);
      contentArea.removeEventListener("mouseup", handleEnd);
      contentArea.removeEventListener("mouseleave", handleMouseLeave);
    }
  };
});
</script>

<div
  class="flex flex-col lg:flex-row items-center w-full h-full mt-2 min-h-0 gap-4 lg:px-4"
>
  <!-- Titles container: horizontal on small screens, vertical on large screens -->
  <div
    class="relative w-screen lg:w-64 lg:h-full shrink-0 lg:shrink-0 lg:order-2 title-container-wrapper"
  >
    <div
      bind:this={titleContainer}
      class="flex flex-row lg:flex-col overflow-x-scroll lg:overflow-x-hidden lg:overflow-y-scroll overflow-y-hidden flex-nowrap gap-2 w-full lg:h-full px-[50vw] lg:px-0 lg:py-[50vh] title-scroll-container"
    >
      {#each rhymes as rhyme, index}
        {@const order = rhyme.frontmatter.order ?? index + 1000}
        <button
          data-rhyme-order={order}
          type="button"
          onclick={() => selectRhyme(order)}
          class="text-sm lg:text-lg font-heading px-4 py-2 bg-theme-pink-1 border-x-2 lg:border-x-0 lg:border-y-2 border-t-2 border-theme-pink-5 whitespace-nowrap shrink-0 lg:w-full transition-all cursor-pointer hover:bg-theme-pink-2 {selectedOrder ===
          order
            ? 'scale-110'
            : 'opacity-70'}"
        >
          {rhyme.frontmatter.title || "Untitled" + order}
        </button>
      {/each}
    </div>
    <!-- Fade overlay for horizontal scroll end (small screens) -->
    <div
      class="absolute top-0 right-0 w-16 h-full pointer-events-none bg-gradient-to-l from-theme-pink-4 to-transparent lg:hidden"
    ></div>
    <div
      class="absolute top-0 left-0 w-16 h-full pointer-events-none bg-gradient-to-r from-theme-pink-4 to-transparent lg:hidden"
    ></div>
    <!-- Fade overlay for vertical scroll end (large screens) -->
    <div
      class="hidden lg:block absolute bottom-0 left-0 w-full h-32 pointer-events-none bg-gradient-to-t from-theme-pink-5 to-transparent"
    ></div>
    <div
      class="hidden lg:block absolute top-0 right-0 w-full h-32 pointer-events-none bg-gradient-to-b from-theme-pink-4 to-transparent"
    ></div>
  </div>
  <!-- Content area: full width on small screens, flex-1 on large screens -->
  <div class="flex flex-col w-full lg:flex-1 min-h-0 h-full lg:order-1">
    {#if selectedRhyme}
      <div
        class="flex flex-row justify-between items-center w-full mt-4 lg:mt-0 shrink-0"
      >
        <div class="flex flex-row gap-2 px-2 justify-end items-center">
          {#each selectedRhyme.frontmatter.tags as tag}
            <span
              class="text-[0.625rem] lg:text-sm font-heading bg-theme-red-2 border-2 border-theme-red-1 text-theme-peach-1 px-2 py-1"
              >{tag}</span
            >
          {/each}
        </div>
        <div>
          <span
            class="text-[0.625rem] lg:text-sm text-theme-peach-1 px-2 py-1 font-heading"
            >{selectedRhyme.frontmatter.status}</span
          >
        </div>
      </div>
      <div
        bind:this={contentArea}
        class="w-full bg-theme-light-pink-1 px-4 lg:px-8 pt-4 pb-32 lg:pb-8 flex-1 min-h-0 h-full overflow-y-auto border-2 border-theme-pin-5"
      >
        <div
          class="text-xs lg:text-lg font-heading flex flex-row gap-2 justify-end items-center"
        >
          <span class=""
            >{selectedRhyme.frontmatter.rating}
            <span class="text-[0.625rem] lg:text-xs">/ 10</span>
            ,
          </span>
          <span class=""
            >{selectedRhyme.frontmatter.thought_on?.replaceAll("/", "-") ||
              ""}</span
          >
        </div>
        <div class="content-text mt-4">
          {@html processedContent || ""}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .content-text {
    font-family: var(--font-content);
    font-size: var(--text-sm);
    line-height: var(--tw-leading, var(--text-sm--line-height));
  }

  @media (width >= 1024px) {
    .content-text {
      font-size: var(--text-lg);
      line-height: var(--tw-leading, var(--text-lg--line-height));
    }
  }

  .content-text :global(blockquote) {
    font-size: 0.875em; /* Smaller than normal text */
    margin: 0.5em 0;
    padding-left: 1em;
    border-left: 2px solid currentColor;
    font-family: var(--font-heading);
  }

  .content-text :global(h2) {
    font-size: 1.2em;
    font-weight: bold;
    margin-top: 1em;
    margin-bottom: 0.5em;
  }

  .content-text :global(p) {
    margin: 0.5em 0;
  }

  .content-text :global(ul),
  .content-text :global(ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }

  .content-text :global(li) {
    margin: 0.25em 0;
  }

  .content-text :global(hr) {
    margin: 1em 0;
    border: none;
    border-top: 1px solid currentColor;
  }

  /* @media (width >= 48rem) {
    .content-text {
      font-size: var(--text-xl);
      line-height: var(--tw-leading, var(--text-xl--line-height));
    } */
  /* } */

  .title-scroll-container {
    scroll-behavior: smooth;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  @media (width >= 1024px) {
    .title-scroll-container {
      scroll-snap-type: y proximity;
      scroll-padding: 0;
    }
  }

  .title-scroll-container button {
    scroll-snap-align: center;
  }

  /* Increase scroll sensitivity */
  .title-scroll-container {
    scroll-padding: 0 50vw;
  }

  @media (width >= 1024px) {
    .title-scroll-container {
      scroll-padding: 0;
    }
  }
</style>
