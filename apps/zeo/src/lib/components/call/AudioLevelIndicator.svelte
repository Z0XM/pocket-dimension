<script lang="ts">
  type Props = {
    level: number;
    class?: string;
  };

  const { level = 0, class: className = "" }: Props = $props();

  const segmentCount = 10;
  const segments = Array.from({ length: segmentCount }, (_, index) => index);

  const clampedLevel = $derived(Math.min(1, Math.max(0, level)));

  function segmentFill(index: number) {
    const start = index / segmentCount;
    const end = (index + 1) / segmentCount;

    if (clampedLevel <= start) return 0;
    if (clampedLevel >= end) return 1;
    return (clampedLevel - start) / (end - start);
  }
</script>

<div class="flex h-3.5 min-w-0 items-center gap-px rounded-sm border border-border/80 bg-secondary/60 px-1 {className}" aria-hidden="true">
  {#each segments as index (index)}
    {@const fill = segmentFill(index)}
    <div class="relative h-2 min-w-0 flex-1 overflow-hidden rounded-[1px] bg-border/70">
      <div
        class="absolute inset-y-0 left-0 rounded-[1px] bg-participant-purple/75 transition-[width,opacity] duration-75 ease-out"
        style="width: {fill * 100}%; opacity: {0.35 + fill * 0.65}"
      ></div>
    </div>
  {/each}
</div>
