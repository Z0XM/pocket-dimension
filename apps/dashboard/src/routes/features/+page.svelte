<script lang="ts">
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();
</script>

<svelte:head>
  <title>dashboard · Features</title>
</svelte:head>

<div class="space-y-2">
  <h1 class="text-display text-foreground">Features</h1>
  <p class="text-muted-foreground">No Features in this Tree.</p>
  {#if data.tree}
    <p class="text-muted-foreground">Tree: {data.tree}</p>
  {/if}
</div>
