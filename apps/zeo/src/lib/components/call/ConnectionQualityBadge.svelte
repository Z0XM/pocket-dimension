<script lang="ts">
  import { qualityClass, qualityTitle, type QualityLabel } from "$lib/livekit/connection-quality";

  type Props = {
    label: QualityLabel;
    compact?: boolean;
  };

  const { label, compact = false }: Props = $props();
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white {qualityClass(label)}"
  title={qualityTitle(label)}
  aria-label={qualityTitle(label)}
>
  {#if !compact}
    <span class="size-1.5 rounded-full bg-white/90" aria-hidden="true"></span>
  {/if}
  {label}
</span>
