<script lang="ts">
  let {
    rows = 6,
    compact = false,
  }: {
    rows?: number;
    compact?: boolean;
  } = $props();
</script>

<ul
  class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card"
  role="status"
  aria-live="polite"
  aria-busy="true"
  aria-label="Loading tracks"
>
  {#each Array.from({ length: rows }, (_, i) => i) as i (i)}
    <li class={`flex items-center gap-3 ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}>
      <div class="min-w-0 flex-1 space-y-2">
        <div class="zap-skeleton h-3.5 w-[min(70%,14rem)] rounded-sm"></div>
        <div class="zap-skeleton h-2.5 w-[min(45%,9rem)] rounded-sm opacity-70"></div>
      </div>
      {#if !compact}
        <div class="zap-skeleton h-6 w-14 shrink-0 rounded-sm opacity-60"></div>
      {:else}
        <div class="zap-skeleton h-5 w-10 shrink-0 rounded-sm opacity-60"></div>
      {/if}
    </li>
  {/each}
</ul>
