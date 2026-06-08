<script lang="ts">
  import AnswerChip from "$lib/components/AnswerChip.svelte";
  import { censorText } from "$lib/censor";
  import type { DedupedAnswer } from "$lib/types";

  type Props = {
    positives: DedupedAnswer[];
    negatives: DedupedAnswer[];
  };

  let { positives, negatives }: Props = $props();
</script>

<section class="grid gap-8 md:grid-cols-2">
  <div>
    <h2 class="mb-4 text-xs uppercase tracking-[0.2em] text-positive">Positives</h2>
    {#if positives.length === 0}
      <p class="text-sm text-muted-foreground">No positive answers yet. Launch a positive form to start collecting.</p>
    {:else}
      <div class="flex flex-wrap gap-3">
        {#each positives as item (item.text)}
          <AnswerChip text={censorText(item.text)} count={item.count} expandDetails={item.expandDetails} variant="positive" />
        {/each}
      </div>
    {/if}
  </div>

  <div>
    <h2 class="mb-4 text-xs uppercase tracking-[0.2em] text-primary">Negatives</h2>
    {#if negatives.length === 0}
      <p class="text-sm text-muted-foreground">No negative answers yet. Launch a negative form to start collecting.</p>
    {:else}
      <div class="flex flex-wrap gap-3">
        {#each negatives as item (item.text)}
          <AnswerChip text={censorText(item.text)} count={item.count} expandDetails={item.expandDetails} variant="negative" />
        {/each}
      </div>
    {/if}
  </div>
</section>
