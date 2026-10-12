<script lang="ts">
  let {
    label,
    detail = null,
  }: {
    label: string;
    detail?: string | null;
  } = $props();
</script>

<div class="zap-busy" role="status" aria-live="polite" aria-busy="true">
  <span class="zap-busy-bars" aria-hidden="true">
    <span></span><span></span><span></span>
  </span>
  <div class="min-w-0">
    <p class="font-mono text-[11px] tracking-wide text-signal">{label}</p>
    {#if detail}
      <p class="mt-0.5 text-xs break-words text-muted-foreground">{detail}</p>
    {/if}
  </div>
</div>
