<script lang="ts">
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();
</script>

<svelte:head>
  <title>dashboard · Epics &amp; Stories</title>
</svelte:head>

<div class="space-y-2">
  <h1 class="text-display text-foreground">Epics &amp; Stories</h1>
  <p class="text-muted-foreground">No Epics &amp; Stories in this Tree.</p>
  {#if data.tree}
    <p class="text-muted-foreground">Tree: {data.tree}</p>
  {/if}
</div>
