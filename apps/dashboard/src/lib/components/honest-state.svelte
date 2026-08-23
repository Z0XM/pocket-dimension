<script lang="ts">
  let {
    title,
    reason,
    meta,
  }: {
    title: string;
    reason?: string;
    meta?: string;
  } = $props();
</script>

<div class="space-y-2 text-foreground">
  <p class="text-display">{title}</p>
  {#if reason}
    <p class="text-muted-foreground">{reason}</p>
  {/if}
  {#if meta}
    <p class="font-mono text-xs text-muted-foreground">{meta}</p>
  {/if}
</div>
