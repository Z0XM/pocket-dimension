<script lang="ts">
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import SearchIcon from "@lucide/svelte/icons/search";
  import HonestState from "$lib/components/honest-state.svelte";
  import SearchOverlay from "$lib/components/search-overlay.svelte";
  import SectionNav from "$lib/components/section-nav.svelte";
  import TreeSwitcher from "$lib/components/tree-switcher.svelte";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import { bindSearchHotkeys } from "$lib/keyboard";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import type { SearchCorpusEntry, TreeId } from "$lib/types";
  import type { Snippet } from "svelte";
  import { onMount, tick } from "svelte";

  let {
    children,
    trees = [],
    tree = null,
    bmadRootError = null,
    searchCorpus = [],
  }: {
    children: Snippet;
    trees?: TreeId[];
    tree?: TreeId | null;
    bmadRootError?: string | null;
    searchCorpus?: SearchCorpusEntry[];
  } = $props();

  let sheetOpen = $state(false);
  let searchOpen = $state(false);
  let focusBeforeSearch: HTMLElement | null = null;

  function closeSheet() {
    sheetOpen = false;
  }

  function openSearch() {
    const active = document.activeElement;
    focusBeforeSearch = active instanceof HTMLElement ? active : null;
    searchOpen = true;
  }

  function toggleSearch() {
    if (searchOpen) {
      closeSearch();
    } else {
      openSearch();
    }
  }

  async function closeSearch() {
    searchOpen = false;
    await tick();
    focusBeforeSearch?.focus();
    focusBeforeSearch = null;
  }

  onMount(() => {
    return bindSearchHotkeys({
      open: openSearch,
      toggle: toggleSearch,
      isOpen: () => searchOpen,
    });
  });
</script>

<div class="flex min-h-screen flex-col bg-background">
  <header class="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
    <Sheet.Root bind:open={sheetOpen}>
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" size="sm" {...props}>
            <PanelLeftIcon />
            Navigation
          </Button>
        {/snippet}
      </Sheet.Trigger>
      <Sheet.Content side="left" class="w-[280px] max-w-[85vw] border-border bg-background p-0 shadow-none">
        <Sheet.Header class="border-b border-border px-3 py-4 text-left">
          <Sheet.Title class="text-label tracking-widest text-muted-foreground uppercase">dashboard</Sheet.Title>
        </Sheet.Header>
        <div class="px-3 pb-3">
          <TreeSwitcher {trees} {tree} />
        </div>
        <nav aria-label="Sections" class="border-t border-border px-2 py-3">
          <SectionNav {tree} onNavigate={closeSheet} />
        </nav>
      </Sheet.Content>
    </Sheet.Root>
    <span class="text-label text-muted-foreground uppercase tracking-widest">dashboard</span>
    <Button variant="outline" size="sm" class="ml-auto" onclick={openSearch} aria-label="Search">
      <SearchIcon />
      Search
    </Button>
  </header>

  <div class="flex min-h-0 flex-1">
    <aside class="hidden w-[280px] shrink-0 border-r border-border bg-background px-3 py-4 lg:block" aria-label="Application navigation">
      <div class="flex items-center justify-between gap-2">
        <p class="text-label tracking-widest text-muted-foreground uppercase">dashboard</p>
        <Button variant="outline" size="sm" onclick={openSearch} aria-label="Search">
          <SearchIcon />
          Search
        </Button>
      </div>
      <TreeSwitcher {trees} {tree} />
      <nav aria-label="Sections" class="mt-4 border-t border-border pt-4">
        <SectionNav {tree} />
      </nav>
    </aside>

    <main class="min-w-0 flex-1 p-4">
      {#if bmadRootError || trees.length === 0}
        <div class="mb-4 border-b border-border pb-4">
          <HonestState
            title={EXPERIENCE_COPY.bmadRootUnavailable.title}
            reason={bmadRootError ?? EXPERIENCE_COPY.bmadRootUnavailable.reasonFallback}
          />
        </div>
      {/if}
      {@render children()}
    </main>
  </div>
</div>

<SearchOverlay bind:open={searchOpen} corpus={searchCorpus} {tree} onClose={closeSearch} />
