<script lang="ts">
  import DocsCatalog from "$lib/components/docs-catalog.svelte";
  import { decodePathParam } from "$lib/docs-path";
  import type { LayoutTreeData } from "$lib/types";
  import { page } from "$app/stores";

  let { data, children }: { data: LayoutTreeData; children: import("svelte").Snippet } = $props();

  const artifacts = $derived(data.snapshot?.artifacts ?? []);
  const activePath = $derived($page.params.path ? decodePathParam($page.params.path) : null);
</script>

<div class="space-y-4">
  <h1 class="text-display text-foreground">Docs</h1>

  <div class="flex min-h-0 flex-col gap-6 lg:flex-row lg:items-start">
    <aside class="w-full shrink-0 lg:w-[280px]">
      {#if !data.tree || !data.snapshot}
        <p class="text-muted-foreground">No Docs in this Tree.</p>
      {:else if artifacts.length === 0}
        <p class="text-muted-foreground">No Docs in this Tree.</p>
      {:else}
        <DocsCatalog {artifacts} tree={data.tree} {activePath} />
      {/if}
    </aside>

    <div class="min-w-0 flex-1">
      {@render children()}
    </div>
  </div>
</div>
