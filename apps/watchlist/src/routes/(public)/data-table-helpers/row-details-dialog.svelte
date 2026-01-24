<script lang="ts">
  import { getContext } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { Watchlist } from "../columns";

  interface Props {
    open?: boolean;
    row: Watchlist | null;
  }

  let { open = $bindable(false), row }: Props = $props();

  const filterContext = getContext<{
    addFilterValue: (
      filterType: "language" | "tags" | "progress" | "type",
      value: string,
    ) => void;
    filters: () => {
      language: string[];
      tags: string[];
      progress: string[];
      type: string[];
    };
  }>("filterContext");

  // Parse tags
  const tagList = $derived.by(() => {
    if (!row?.tags) return [];
    return row.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  });

  // Check if values are in filters
  const isLanguageFiltered = $derived.by(() => {
    if (!row?.language || !filterContext) return false;
    return filterContext.filters().language.includes(row.language);
  });

  const isTypeFiltered = $derived.by(() => {
    if (!row?.type || !filterContext) return false;
    return filterContext.filters().type.includes(row.type);
  });

  const isTagFiltered = $derived.by(() => {
    return (tag: string) => {
      if (!filterContext) return false;
      return filterContext.filters().tags.includes(tag);
    };
  });

  function handleLanguageClick() {
    if (!row?.language || !filterContext) return;
    filterContext.addFilterValue("language", row.language);
  }

  function handleTypeClick() {
    if (!row?.type || !filterContext) return;
    filterContext.addFilterValue("type", row.type);
  }

  function handleTagClick(tag: string) {
    if (!filterContext) return;
    filterContext.addFilterValue("tags", tag);
  }

  function capitalizeType(type: string): string {
    if (!type) return type;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-sm">
    <Dialog.Header>
      <Dialog.Title>Row Details</Dialog.Title>
    </Dialog.Header>

    {#if row}
      <div class="space-y-4 py-4">
        <!-- Title -->
        <div class="space-y-2">
          <span class="text-[0.625rem] text-muted-foreground font-medium"
            >Title</span
          >
          <div class="text-xs font-medium">{row.title}</div>
        </div>

        <!-- Type -->
        {#if row.type}
          <div class="space-y-2">
            <span class="text-[0.625rem] text-muted-foreground font-medium"
              >Type</span
            >
            <button
              onclick={handleTypeClick}
              class="text-xs cursor-pointer hover:underline capitalize px-2 py-1 rounded-md hover:bg-accent transition-colors {isTypeFiltered
                ? 'text-primary font-medium bg-primary/10'
                : ''}"
            >
              {capitalizeType(row.type)}
            </button>
          </div>
        {/if}

        <!-- Language -->
        {#if row.language}
          <div class="space-y-2">
            <span class="text-[0.625rem] text-muted-foreground font-medium"
              >Language</span
            >
            <button
              onclick={handleLanguageClick}
              class="text-xs cursor-pointer hover:underline px-2 py-1 rounded-md hover:bg-accent transition-colors {isLanguageFiltered
                ? 'text-primary font-medium bg-primary/10'
                : ''}"
            >
              {row.language}
            </button>
          </div>
        {/if}

        <!-- Tags -->
        {#if tagList.length > 0}
          <div class="space-y-2">
            <span class="text-[0.625rem] text-muted-foreground font-medium"
              >Tags</span
            >
            <div class="flex flex-wrap gap-1.5">
              {#each tagList as tag}
                <button
                  onclick={() => handleTagClick(tag)}
                  class="text-xs cursor-pointer hover:underline capitalize px-2 py-1 rounded-md hover:bg-accent transition-colors {isTagFiltered(
                    tag,
                  )
                    ? 'text-primary font-medium bg-primary/10'
                    : ''}"
                >
                  {tag}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => (open = false)}
        class="text-xs w-full"
      >
        Close
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
