<script lang="ts">
  import { qualityClass, qualityDisplayLabel, qualityTitle, type QualityLabel } from "$lib/livekit/connection-quality";

  type Props = {
    label: QualityLabel;
    pingMs?: number | null;
    compact?: boolean;
  };

  const { label, pingMs = null, compact = false }: Props = $props();

  const title = $derived(qualityTitle(label, pingMs));
  const displayLabel = $derived(qualityDisplayLabel(label));
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide text-white {qualityClass(label)}"
  {title}
  aria-label={title}
>
  {#if !compact}
    <span class="size-1.5 rounded-full bg-white/90" aria-hidden="true"></span>
  {/if}
  <span class="uppercase">{displayLabel}</span>
  {#if pingMs != null && pingMs > 0}
    <span class="font-normal text-white/85" aria-hidden="true">·</span>
    <span class="font-mono text-[10px] font-normal text-white/90">{pingMs} ms</span>
  {/if}
</span>
