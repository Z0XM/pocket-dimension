<script lang="ts">
  import DeliveryBoard from "$lib/components/delivery-board.svelte";
  import DeliveryTable from "$lib/components/delivery-table.svelte";
  import DeliveryTimeline from "$lib/components/delivery-timeline.svelte";
  import HonestState from "$lib/components/honest-state.svelte";
  import type { DeliveryView } from "$lib/catalog/delivery";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import { sectionHref } from "$lib/nav";
  import type { DeliveryItem, LayoutTreeData, TreeId } from "$lib/types";

  type PageData = LayoutTreeData & {
    items: DeliveryItem[];
    view: DeliveryView;
  };

  let { data }: { data: PageData } = $props();

  const VIEWS: { id: DeliveryView; label: string }[] = [
    { id: "board", label: "Board" },
    { id: "table", label: "Table" },
    { id: "timeline", label: "Timeline" },
  ];

  function viewHref(view: DeliveryView): string {
    const url = new URL("/delivery", "http://local");
    if (data.tree) {
      url.searchParams.set("tree", data.tree);
    }
    if (view !== "board") {
      url.searchParams.set("view", view);
    }
    return `${url.pathname}${url.search}`;
  }

  const treeEmpty = $derived(data.items.length === 0);
</script>

<svelte:head>
  <title>dashboard · Epics &amp; Stories</title>
</svelte:head>

<div class="space-y-4">
  <h1 class="text-display text-foreground">Epics &amp; Stories</h1>

  <nav class="flex gap-2" aria-label="Delivery views">
    {#each VIEWS as chip (chip.id)}
      <a
        href={viewHref(chip.id)}
        class="text-label border px-2 py-1 text-xs uppercase tracking-widest {data.view === chip.id
          ? 'border-accent text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground'}"
        aria-current={data.view === chip.id ? "page" : undefined}
      >
        {chip.label}
      </a>
    {/each}
  </nav>

  {#if treeEmpty}
    <HonestState title={EXPERIENCE_COPY.deliveryEmpty.title} reason={EXPERIENCE_COPY.deliveryEmpty.reason} />
  {:else if data.view === "board"}
    <DeliveryBoard items={data.items} tree={data.tree} />
  {:else if data.view === "table"}
    <DeliveryTable items={data.items} tree={data.tree} />
  {:else}
    <DeliveryTimeline items={data.items} tree={data.tree} />
  {/if}
</div>
