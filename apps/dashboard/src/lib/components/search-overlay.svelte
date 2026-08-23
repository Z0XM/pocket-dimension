<script lang="ts">
  import { goto } from "$app/navigation";
  import * as Command from "$lib/components/ui/command/index.js";
  import { groupSearchHits, searchCorpus as runSearch } from "$lib/catalog/search";
  import { searchNoMatches } from "$lib/experience-copy";
  import type { SearchCorpusEntry, SearchHitKind, TreeId } from "$lib/types";
  import { cn } from "$lib/utils.js";

  let {
    open = $bindable(false),
    corpus,
    tree = null,
    onClose,
  }: {
    open?: boolean;
    corpus: SearchCorpusEntry[];
    tree?: TreeId | null;
    onClose?: () => void;
  } = $props();

  let query = $state("");
  let scope = $state<"all" | "tree">("all");

  const trimmedQuery = $derived(query.trim());
  const hits = $derived(runSearch(corpus, query, scope === "tree" && tree ? { tree } : undefined));
  const groups = $derived(groupSearchHits(hits));
  const showMiss = $derived(trimmedQuery.length > 0 && hits.length === 0);
  const liveMessage = $derived(
    showMiss ? searchNoMatches(trimmedQuery).title : hits.length > 0 ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : ""
  );

  const kindLabels: Record<SearchHitKind, string> = {
    feature: "Feature",
    epic: "Epic",
    story: "Story",
    test: "Test",
    docs: "Docs",
  };

  function handleOpenChange(next: boolean) {
    open = next;
    if (!next) {
      query = "";
      scope = "all";
      onClose?.();
    }
  }

  function openHit(href: string) {
    handleOpenChange(false);
    void goto(href);
  }

  function snippetParts(snippet: string, needle: string): { text: string; match: boolean }[] {
    if (!needle) {
      return [{ text: snippet, match: false }];
    }

    const lowerSnippet = snippet.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    let matchIndex = lowerSnippet.indexOf(lowerNeedle);
    let matchLength = lowerNeedle.length;

    if (matchIndex === -1) {
      const tokens = lowerNeedle.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        const idx = lowerSnippet.indexOf(token);
        if (idx !== -1) {
          matchIndex = idx;
          matchLength = token.length;
          break;
        }
      }
    }

    if (matchIndex === -1) {
      return [{ text: snippet, match: false }];
    }

    return [
      { text: snippet.slice(0, matchIndex), match: false },
      { text: snippet.slice(matchIndex, matchIndex + matchLength), match: true },
      { text: snippet.slice(matchIndex + matchLength), match: false },
    ].filter((part) => part.text.length > 0);
  }
</script>

<Command.Dialog
  bind:open
  onOpenChange={handleOpenChange}
  shouldFilter={false}
  title="Search"
  description="Search artifact content across Current BMAD Trees"
  class="max-w-2xl"
>
  <Command.Input bind:value={query} placeholder="Search artifact content…" data-search-input />

  <div class="flex items-center gap-2 border-b border-border px-3 py-2">
    <span class="text-label text-muted-foreground">Scope</span>
    <button
      type="button"
      class={cn(
        "rounded border px-2 py-0.5 text-xs",
        scope === "all" ? "border-accent text-foreground bg-card" : "border-border text-muted-foreground"
      )}
      onclick={() => (scope = "all")}
    >
      All trees
    </button>
    <button
      type="button"
      class={cn(
        "rounded border px-2 py-0.5 text-xs",
        scope === "tree" ? "border-accent text-foreground bg-card" : "border-border text-muted-foreground",
        !tree && "pointer-events-none opacity-40"
      )}
      disabled={!tree}
      onclick={() => (scope = "tree")}
    >
      This tree
    </button>
  </div>

  <div aria-live="polite" class="sr-only">{liveMessage}</div>

  <Command.List class="max-h-[min(60vh,420px)]">
    {#if showMiss}
      <Command.Empty>{searchNoMatches(trimmedQuery).title}</Command.Empty>
    {:else if trimmedQuery.length === 0}
      <p class="text-muted-foreground px-3 py-6 text-center text-sm">Type to search artifact content.</p>
    {:else}
      {#each groups as group (group.kind)}
        <Command.Group heading={group.label}>
          {#each group.hits as hit (`${hit.tree}-${hit.kind}-${hit.id}-${hit.href}`)}
            <Command.Item
              value={`${hit.tree}-${hit.kind}-${hit.id}`}
              class="flex flex-col items-start gap-0.5 rounded-none border-l-2 border-transparent px-3 py-2 data-selected:border-accent data-selected:bg-card data-selected:text-foreground"
              onSelect={() => openHit(hit.href)}
            >
              <span class="text-sm font-medium text-foreground">{hit.title}</span>
              <span class="text-xs text-muted-foreground">
                {kindLabels[hit.kind]} · {hit.tree}
              </span>
              <span class="text-xs text-muted-foreground line-clamp-2">
                {#each snippetParts(hit.snippet, trimmedQuery) as part, i (i)}
                  {#if part.match}
                    <span class="text-accent underline decoration-accent underline-offset-2">{part.text}</span>
                  {:else}
                    {part.text}
                  {/if}
                {/each}
              </span>
            </Command.Item>
          {/each}
        </Command.Group>
      {/each}
    {/if}
  </Command.List>
</Command.Dialog>
