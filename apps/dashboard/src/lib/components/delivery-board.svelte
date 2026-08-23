<script lang="ts">
  import { DELIVERY_BOARD_COLUMNS } from "$lib/catalog/delivery";
  import type { DeliveryItem } from "$lib/catalog/delivery";
  import { sectionHref } from "$lib/nav";
  import type { StoryStatus, TreeId } from "$lib/types";

  let {
    items,
    tree = null,
  }: {
    items: DeliveryItem[];
    tree?: TreeId | null;
  } = $props();

  const COLUMN_LABELS: Record<StoryStatus, string> = {
    backlog: "Backlog",
    "in-progress": "In progress",
    done: "Done",
    unknown: "Unknown",
  };

  function itemHref(item: DeliveryItem): string {
    const base = item.kind === "epic" ? `/epics/${item.id}` : `/stories/${item.id}`;
    return sectionHref(base, tree);
  }

  function itemsInColumn(status: StoryStatus): DeliveryItem[] {
    return items.filter((item) => item.status === status);
  }
</script>

<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Delivery board">
  {#each DELIVERY_BOARD_COLUMNS as column (column)}
    <section class="space-y-2">
      <h2 class="text-label tracking-widest text-muted-foreground uppercase">{COLUMN_LABELS[column]}</h2>
      <ul class="space-y-2">
        {#each itemsInColumn(column) as item (item.id + item.sourcePath)}
          <li>
            <a href={itemHref(item)} class="border-border bg-card block rounded border px-3 py-2 hover:border-accent">
              <span class="text-label block text-xs text-muted-foreground uppercase">{item.kind}</span>
              <span class="block text-foreground">{item.title}</span>
              {#if item.epicNumber !== null}
                <span class="font-mono text-xs text-muted-foreground">Epic {item.epicNumber}</span>
              {/if}
              <span class="font-mono text-xs text-muted-foreground">{item.statusLabel}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
