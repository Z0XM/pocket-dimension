<script lang="ts">
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();
</script>

<svelte:head>
  <title>dashboard · Docs</title>
</svelte:head>

<div class="space-y-2">
  <h1 class="text-display text-foreground">Docs</h1>
  <p class="text-muted-foreground">No Docs in this Tree.</p>
  <p class="text-muted-foreground">Docs catalog arrives in Epic 2.</p>
  {#if data.tree}
    <p class="text-muted-foreground">Tree: {data.tree}</p>
  {/if}
</div>
