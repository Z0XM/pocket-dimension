<script lang="ts">
  import DocsCatalog from "$lib/components/docs-catalog.svelte";
  import type { LayoutTreeData } from "$lib/types";
  import { page } from "$app/stores";

  let { data }: { data: LayoutTreeData } = $props();

  const artifacts = $derived(data.snapshot?.artifacts ?? []);

  let activePath = $state<string | null>(null);

  $effect(() => {
    const fromQuery = $page.url.searchParams.get("artifact");
    if (fromQuery) {
      activePath = fromQuery;
    }
  });

  function handleSelect(sourcePath: string) {
    activePath = sourcePath;
    const url = new URL($page.url);
    url.searchParams.set("artifact", sourcePath);
    if (data.tree) {
      url.searchParams.set("tree", data.tree);
    }
    history.replaceState(history.state, "", `${url.pathname}${url.search}`);
  }
</script>

<svelte:head>
  <title>dashboard · Docs</title>
</svelte:head>

<div class="space-y-4">
  <h1 class="text-display text-foreground">Docs</h1>

  {#if !data.tree || !data.snapshot}
    <p class="text-muted-foreground">No Docs in this Tree.</p>
  {:else if artifacts.length === 0}
    <p class="text-muted-foreground">No Docs in this Tree.</p>
  {:else}
    <DocsCatalog {artifacts} tree={data.tree} {activePath} onSelect={handleSelect} />
  {/if}
</div>
