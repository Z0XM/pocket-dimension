<script lang="ts">
  import TestRow from "$lib/components/test-row.svelte";
  import HonestState from "$lib/components/honest-state.svelte";
  import { filterTestsForTree } from "$lib/catalog/filter-tests";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();

  const visible = $derived(filterTestsForTree(data.tests, data.tree));
</script>

<svelte:head>
  <title>dashboard · Tests</title>
</svelte:head>

<div class="space-y-4">
  <h1 class="text-display text-foreground">Tests</h1>

  {#if visible.length === 0}
    <HonestState title={EXPERIENCE_COPY.testsEmpty.title} />
  {:else}
    <ul class="space-y-0.5" aria-label="Tests list">
      {#each visible as test (test.id)}
        <li>
          <TestRow {test} tree={data.tree} />
        </li>
      {/each}
    </ul>
  {/if}
</div>
