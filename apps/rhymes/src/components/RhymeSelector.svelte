<script lang="ts">
  import { marked } from "marked";
  import type { ContentType, ReaderMode } from "../lib/rhymes";
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

  let searchQuery = $state("");
  let activeContentType = $state<"all" | ContentType>("all");

  const contentTypeOptions = $derived.by(() => {
    const counts = new Map<"all" | ContentType, number>([["all", rhymes.length]]);

    rhymes.forEach((rhyme) => {
      counts.set(rhyme.contentType, (counts.get(rhyme.contentType) ?? 0) + 1);
    });

    return [
      { value: "all" as const, label: "All", count: counts.get("all") ?? 0 },
      { value: "poem" as const, label: "Poems", count: counts.get("poem") ?? 0 },
      { value: "article" as const, label: "Articles", count: counts.get("article") ?? 0 },
      { value: "song" as const, label: "Songs", count: counts.get("song") ?? 0 },
      { value: "diary" as const, label: "Diaries", count: counts.get("diary") ?? 0 },
    ].filter((option) => option.value === "all" || option.count > 0);
  });

  function matchesSearch(rhyme: Rhyme, query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      rhyme.frontmatter.title,
      rhyme.summary,
      rhyme.contentType,
      rhyme.frontmatter.status,
      rhyme.frontmatter.phase,
      ...(rhyme.frontmatter.tags ?? []),
      rhyme.content,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  }

  const displayedRhymes = $derived.by(() => {
    return rhymes.filter((rhyme) => {
      const matchesContentType = activeContentType === "all" || rhyme.contentType === activeContentType;
      return matchesContentType && matchesSearch(rhyme, searchQuery);
    });
  });

  // Get default order (first visible rhyme's order)
  const getDefaultOrder = (): number => {
    if (displayedRhymes.length === 0) return 0;
    return displayedRhymes[0].frontmatter.order ?? 0;
  };

  // Find visible rhyme by order
  function findRhymeByOrder(order: number): Rhyme | undefined {
    return displayedRhymes.find((rhyme) => rhyme.frontmatter.order === order);
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
  let pageMode = $state<ReaderMode>("continuous");
  let selectedPageIndex = $state(0);
  let titleContainer: HTMLDivElement | null = $state(null);
  let contentArea: HTMLDivElement | null = $state(null);

  // Initialize from URL on client side, or use default
  $effect(() => {
    if (typeof window !== "undefined" && displayedRhymes.length > 0) {
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

    setTimeout(() => {
      const targetElement = titleContainer?.querySelector(`[data-rhyme-order="${order}"]`) as HTMLElement;

      if (targetElement) {
        targetElement.scrollIntoView({
          block: "nearest",
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
      const timeoutId = setTimeout(() => {
        scrollToTitle(selectedOrder);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  });

  const selectedRhyme = $derived.by(() => {
    const rhyme = findRhymeByOrder(selectedOrder);
    // If no rhyme found, fallback to first rhyme
    return rhyme ?? (displayedRhymes.length > 0 ? displayedRhymes[0] : undefined);
  });

  $effect(() => {
    if (typeof window === "undefined" || displayedRhymes.length === 0) return;

    const hasSelectedRhyme = findRhymeByOrder(selectedOrder);
    const fallbackOrder = selectedRhyme?.frontmatter.order;

    if (!hasSelectedRhyme && fallbackOrder !== undefined && fallbackOrder !== selectedOrder) {
      selectedOrder = fallbackOrder;
      updateUrl(fallbackOrder);
      scrollToTitle(fallbackOrder);
    }
  });

  function getPreferredReaderMode(rhyme: Rhyme | undefined): ReaderMode {
    if (!rhyme || rhyme.pages.length <= 1) {
      return "continuous";
    }

    return rhyme.defaultReaderMode;
  }

  const pageCount = $derived(selectedRhyme?.pages.length ?? 0);
  const hasMultiplePages = $derived(pageCount > 1);

  $effect(() => {
    const rhyme = selectedRhyme;

    if (!rhyme) return;

    pageMode = getPreferredReaderMode(rhyme);
    selectedPageIndex = 0;
  });

  function setPageMode(mode: ReaderMode) {
    pageMode = mode;
  }

  function goToPreviousPage() {
    if (selectedPageIndex > 0) {
      selectedPageIndex -= 1;
    }
  }

  function goToNextPage() {
    if (selectedRhyme && selectedPageIndex < selectedRhyme.pages.length - 1) {
      selectedPageIndex += 1;
    }
  }

  // Process markdown content to HTML
  const processedContent = $derived.by(() => {
    if (!selectedRhyme) return "";

    const activeContent =
      pageMode === "paged" && selectedRhyme.pages[selectedPageIndex] ? selectedRhyme.pages[selectedPageIndex] : selectedRhyme.content;

    return marked.parse(activeContent) as string;
  });

  // Get next rhyme order
  function getNextRhymeOrder(): number | null {
    if (displayedRhymes.length === 0) return null;
    const currentIndex = displayedRhymes.findIndex((r) => (r.frontmatter.order ?? 0) === selectedOrder);
    if (currentIndex === -1) return null;
    // Since rhymes are sorted descending, next is previous index
    if (currentIndex > 0) {
      const nextRhyme = displayedRhymes[currentIndex - 1];
      return nextRhyme.frontmatter.order ?? null;
    }
    return null;
  }

  // Get previous rhyme order
  function getPreviousRhymeOrder(): number | null {
    if (displayedRhymes.length === 0) return null;
    const currentIndex = displayedRhymes.findIndex((r) => (r.frontmatter.order ?? 0) === selectedOrder);
    if (currentIndex === -1) return null;
    // Since rhymes are sorted descending, previous is next index
    if (currentIndex < displayedRhymes.length - 1) {
      const prevRhyme = displayedRhymes[currentIndex + 1];
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

<div class="grid h-full min-h-0 gap-4 px-4 pb-4 md:px-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
  <aside class="min-h-0 overflow-hidden border border-theme-red-2/50 bg-theme-pink-4/90">
    <div class="border-b border-theme-red-2/30 px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-heading text-xl text-theme-peach-1">Browse the library</h2>
          <p class="mt-1 text-xs text-theme-peach-3">
            Search within the current filtered set and keep the poem in view.
          </p>
        </div>
        <span class="text-xs font-heading text-theme-peach-3">{displayedRhymes.length} visible</span>
      </div>

      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search titles, tags, or lines"
        class="mt-4 w-full border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-sm text-theme-peach-1 outline-none placeholder:text-theme-peach-3"
      />

      <div class="mt-4 flex flex-wrap gap-2">
        {#each contentTypeOptions as option}
          <button
            type="button"
            onclick={() => (activeContentType = option.value)}
            class="cursor-pointer border px-3 py-1 text-xs font-heading transition-colors {activeContentType === option.value
              ? 'border-theme-peach-2 bg-theme-peach-2 text-theme-pink-5'
              : 'border-theme-red-2/40 bg-theme-pink-3 text-theme-peach-2 hover:border-theme-peach-3'}"
          >
            {option.label} ({option.count})
          </button>
        {/each}
      </div>
    </div>

    <div bind:this={titleContainer} class="title-scroll-container h-full overflow-y-auto px-3 py-3">
      <div class="flex flex-col gap-3 pb-32">
        {#if displayedRhymes.length > 0}
          {#each displayedRhymes as rhyme, index}
            {@const order = rhyme.frontmatter.order ?? index + 1000}
            <button
              data-rhyme-order={order}
              type="button"
              onclick={() => selectRhyme(order)}
              class="w-full cursor-pointer border p-3 text-left transition-all {selectedOrder === order
                ? 'border-theme-peach-2 bg-theme-pink-2 shadow-[0_0_0_1px_rgba(247,244,238,0.2)]'
                : 'border-theme-red-2/30 bg-theme-pink-3 hover:border-theme-peach-3/60 hover:bg-theme-pink-2/80'}"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-heading text-base text-theme-peach-1">{rhyme.frontmatter.title}</div>
                  <div class="mt-2 line-clamp-3 text-xs leading-5 text-theme-peach-3">{rhyme.summary}</div>
                </div>
                <span class="shrink-0 border border-theme-red-2/40 px-2 py-1 text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-2">
                  {rhyme.contentType}
                </span>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2 text-[0.625rem] font-heading text-theme-peach-3">
                {#if rhyme.frontmatter.thought_on}
                  <span>{rhyme.frontmatter.thought_on?.replaceAll("/", "-")}</span>
                {/if}
                {#if rhyme.pages.length > 1}
                  <span>• {rhyme.pages.length} pages</span>
                {/if}
                {#if rhyme.frontmatter.status}
                  <span>• {rhyme.frontmatter.status}</span>
                {/if}
              </div>
            </button>
          {/each}
        {:else}
          <div class="border border-theme-red-2/30 bg-theme-pink-3 px-4 py-6 text-sm text-theme-peach-3">
            No pieces match the current search and filters.
          </div>
        {/if}
      </div>
    </div>
  </aside>

  <section class="flex min-h-0 flex-col overflow-hidden border border-theme-red-2/50 bg-theme-pink-4/80">
    {#if selectedRhyme}
      <div class="border-b border-theme-red-2/30 px-4 py-4 lg:px-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <div class="flex flex-wrap items-center gap-2">
              <span class="border border-theme-red-2/40 bg-theme-pink-2 px-2 py-1 text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-2">
                {selectedRhyme.contentType}
              </span>
              {#if selectedRhyme.frontmatter.status}
                <span class="text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-3">
                  {selectedRhyme.frontmatter.status}
                </span>
              {/if}
            </div>

            <h1 class="mt-4 font-heading text-2xl text-theme-peach-1 md:text-4xl">
              {selectedRhyme.frontmatter.title}
            </h1>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-theme-peach-3">
              {selectedRhyme.summary}
            </p>
          </div>

          <div class="flex flex-col gap-3 text-sm text-theme-peach-2 lg:items-end">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-heading text-theme-peach-1">{selectedRhyme.frontmatter.rating}/10</span>
              {#if selectedRhyme.frontmatter.thought_on}
                <span>{selectedRhyme.frontmatter.thought_on?.replaceAll("/", "-")}</span>
              {/if}
              {#if selectedRhyme.pages.length > 1}
                <span>{selectedRhyme.pages.length} pages</span>
              {/if}
            </div>

            {#if hasMultiplePages}
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onclick={() => setPageMode("continuous")}
                  class="border px-3 py-1 text-xs font-heading cursor-pointer transition-colors {pageMode === 'continuous'
                    ? 'border-theme-peach-2 bg-theme-peach-2 text-theme-pink-5'
                    : 'border-theme-red-2/40 bg-theme-pink-3 text-theme-peach-2'}"
                >
                  Continuous
                </button>
                <button
                  type="button"
                  onclick={() => setPageMode("paged")}
                  class="border px-3 py-1 text-xs font-heading cursor-pointer transition-colors {pageMode === 'paged'
                    ? 'border-theme-peach-2 bg-theme-peach-2 text-theme-pink-5'
                    : 'border-theme-red-2/40 bg-theme-pink-3 text-theme-peach-2'}"
                >
                  Paged
                </button>
              </div>
            {/if}
          </div>
        </div>

        {#if hasMultiplePages && pageMode === "paged"}
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-theme-red-2/20 pt-4">
            <span class="text-xs font-heading uppercase tracking-[0.18em] text-theme-peach-3">
              Page {selectedPageIndex + 1} / {pageCount}
            </span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={goToPreviousPage}
                disabled={selectedPageIndex === 0}
                class="border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-xs font-heading text-theme-peach-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous page
              </button>
              <button
                type="button"
                onclick={goToNextPage}
                disabled={selectedPageIndex >= pageCount - 1}
                class="border border-theme-red-2/40 bg-theme-pink-3 px-3 py-2 text-xs font-heading text-theme-peach-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next page
              </button>
            </div>
          </div>
        {/if}
      </div>

      <div bind:this={contentArea} class="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-10 lg:py-8">
        <div class="mx-auto max-w-4xl border border-theme-red-2/25 bg-theme-light-pink-1 px-5 py-6 text-theme-pink-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)] lg:px-10 lg:py-10">
          <div class="flex flex-wrap gap-2">
            {#each selectedRhyme.frontmatter.tags ?? [] as tag}
              <span class="border border-theme-red-2/30 px-2 py-1 text-[0.625rem] font-heading uppercase tracking-[0.16em] text-theme-red-2">
                {tag}
              </span>
            {/each}
          </div>
          <div class="content-text mt-6">
            {@html processedContent || ""}
          </div>
        </div>
      </div>
    {:else}
      <div class="flex h-full items-center justify-center px-6">
        <div class="max-w-md border border-theme-red-2/30 bg-theme-pink-3 px-6 py-8 text-center">
          <h2 class="font-heading text-xl text-theme-peach-1">No matching pieces</h2>
          <p class="mt-3 text-sm text-theme-peach-3">
            Adjust the current filters or search terms to keep browsing the library.
          </p>
        </div>
      </div>
    {/if}
  </section>
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
  }
</style>
