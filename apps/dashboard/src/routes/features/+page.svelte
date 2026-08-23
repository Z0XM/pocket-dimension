<script lang="ts">
  import FeatureRow from "$lib/components/feature-row.svelte";
  import HonestState from "$lib/components/honest-state.svelte";
  import { filterFeatures } from "$lib/catalog/features";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import type { LayoutTreeData } from "$lib/types";
  import type { PageData } from "./$types";

  let { data }: { data: PageData & LayoutTreeData } = $props();

  let filterQuery = $state("");

  const filteredFeatures = $derived(filterFeatures(data.features, filterQuery));
  const treeEmpty = $derived(data.features.length === 0);
  const filterMiss = $derived(!treeEmpty && filterQuery.trim().length > 0 && filteredFeatures.length === 0);
</script>

<svelte:head>
  <title>dashboard · Features</title>
</svelte:head>

<div class="space-y-4">
  <h1 class="text-display text-foreground">Features</h1>

  {#if treeEmpty}
    <HonestState title={EXPERIENCE_COPY.featuresEmpty.title} reason={EXPERIENCE_COPY.featuresEmpty.reason} />
  {:else}
    <label class="block space-y-1">
      <span class="text-label text-muted-foreground">Filter</span>
      <input
        type="search"
        bind:value={filterQuery}
        placeholder="Filter by id or name"
        class="border-border bg-background text-foreground w-full max-w-md rounded border px-3 py-2 text-sm"
      />
    </label>

    {#if filterMiss}
      <p class="text-muted-foreground text-sm">No Features match this filter.</p>
    {/if}

    <ul class="space-y-0.5" aria-label="Features list">
      {#each filteredFeatures as feature (feature.sourcePath + feature.id + feature.headingSlug)}
        <li>
          <FeatureRow {feature} tree={data.tree} />
        </li>
      {/each}
    </ul>
  {/if}
</div>
