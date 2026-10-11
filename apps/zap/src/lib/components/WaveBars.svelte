<script lang="ts">
  const bars = [0.4, 0.7, 1, 0.55, 0.85, 0.45, 0.95, 0.6, 0.75, 0.5, 0.9, 0.65];
</script>

<div class="flex h-10 items-end gap-1" aria-hidden="true">
  {#each bars as height, i}
    <span class="zap-bar w-1 rounded-sm bg-signal/80" style={`height: ${height * 100}%; animation-delay: ${i * 0.08}s`}></span>
  {/each}
</div>
