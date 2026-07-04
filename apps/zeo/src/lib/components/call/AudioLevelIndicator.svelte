<script lang="ts">
  type Props = {
    level: number;
    class?: string;
  };

  const { level = 0, class: className = "" }: Props = $props();

  const clampedLevel = $derived(Math.min(1, Math.max(0, level)));
</script>

<div class="relative h-3.5 min-w-12 overflow-hidden rounded-sm border border-border bg-secondary/60 p-0.5 {className}" aria-hidden="true">
  <div class="relative h-full w-full overflow-hidden rounded-sm bg-border/80">
    <div
      class="absolute inset-y-0 left-0 rounded-sm bg-participant-orange/85 transition-[width] duration-75 ease-out"
      style="width: {clampedLevel * 100}%"
    ></div>
  </div>
</div>
