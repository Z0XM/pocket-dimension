<script lang="ts">
  import HonestState from "$lib/components/honest-state.svelte";
  import { docsEmptyReason, EXPERIENCE_COPY, isDocsTreeEmpty } from "$lib/experience-copy";
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();

  const treeEmpty = $derived(isDocsTreeEmpty(data));
  const emptyReason = $derived(docsEmptyReason(data.snapshotError));
</script>

{#if treeEmpty}
  <HonestState title={EXPERIENCE_COPY.docsEmptyTree.title} reason={emptyReason} />
{:else}
  <HonestState title={EXPERIENCE_COPY.docsSelect.title} reason={EXPERIENCE_COPY.docsSelect.reason} />
{/if}
