<script lang="ts">
  import { qualityBarCount, qualitySignalClass, qualityTextClass, qualityTitle, type QualityLabel } from "$lib/livekit/connection-quality";

  type Props = {
    label: QualityLabel;
    pingMs?: number | null;
  };

  const { label, pingMs = null }: Props = $props();

  const title = $derived(qualityTitle(label, pingMs));
  const activeBars = $derived(qualityBarCount(label));
  const signalClass = $derived(qualitySignalClass(label));
  const textClass = $derived(qualityTextClass(label));

  const barHeights = [3, 5, 7, 9];
  const bars = [0, 1, 2, 3];
</script>

<span class="inline-flex items-center gap-1.5" {title} aria-label={title}>
  <span class="inline-flex items-end gap-px" aria-hidden="true">
    {#each bars as index (index)}
      <span class="w-[3px] rounded-[1px] {index < activeBars ? signalClass : 'bg-border/70'}" style="height: {barHeights[index]}px"></span>
    {/each}
  </span>

  {#if pingMs != null && pingMs > 0}
    <span class="font-mono text-[10px] leading-none tabular-nums {textClass}">{pingMs}</span>
  {/if}
</span>
