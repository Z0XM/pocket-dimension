<script lang="ts">
  import { groupDeliveryForTimeline } from "$lib/catalog/delivery";
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

  const groups = $derived(groupDeliveryForTimeline(items));

  function itemHref(item: DeliveryItem): string {
    const base = item.kind === "epic" ? `/epics/${item.id}` : `/stories/${item.id}`;
    return sectionHref(base, tree);
  }

  function statusDotClass(status: StoryStatus): string {
    if (status === "done") {
      return "bg-accent";
    }
    if (status === "in-progress") {
      return "bg-foreground";
    }
    if (status === "backlog") {
      return "bg-muted-foreground";
    }
    return "bg-muted-foreground/50";
  }

  function groupLabel(epicNumber: number | null): string {
    if (epicNumber === null) {
      return "Other";
    }
    return `Epic ${epicNumber}`;
  }
</script>

<div class="border-border space-y-8 border-l pl-4" aria-label="Delivery timeline">
  {#each groups as group (group.epicNumber ?? "other")}
    <section class="space-y-3">
      <h2 class="text-label tracking-widest text-muted-foreground uppercase">{groupLabel(group.epicNumber)}</h2>

      {#each group.epics as epic (epic.id)}
        <div>
          <a href={itemHref(epic)} class="text-foreground inline-flex items-center gap-2 hover:underline">
            <span class="inline-block h-2 w-2 rounded-full {statusDotClass(epic.status)}" aria-hidden="true"></span>
            <span>{epic.title}</span>
          </a>
        </div>
      {/each}

      {#each group.stories as story (story.id)}
        <div class="text-muted-foreground pl-4 text-sm">
          <a href={itemHref(story)} class="inline-flex items-center gap-2 hover:text-foreground hover:underline">
            <span class="inline-block h-2 w-2 rounded-full {statusDotClass(story.status)}" aria-hidden="true"></span>
            <span>{story.title}</span>
            <span class="font-mono text-xs">{story.statusLabel}</span>
          </a>
        </div>
      {/each}
    </section>
  {/each}
</div>
