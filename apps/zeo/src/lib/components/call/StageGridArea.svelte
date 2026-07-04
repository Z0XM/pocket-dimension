<script lang="ts">
  import type { Snippet } from "svelte";
  import { computeStageGrid, stageGridLayoutsEqual, type StageGridLayout } from "$lib/stage-grid";

  type Props = {
    bottomInset?: number;
    layout?: StageGridLayout | null;
    children?: Snippet<[{ layout: StageGridLayout | null }]>;
  };

  let { bottomInset = 0, layout = $bindable(null), children }: Props = $props();

  let root = $state<HTMLElement | null>(null);

  const gridLineStyle =
    "linear-gradient(to right, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 1px)";

  $effect(() => {
    bottomInset;
    const el = root;
    if (!el) return;

    const update = () => {
      const next = computeStageGrid(el.clientWidth, el.clientHeight);
      if (!stageGridLayoutsEqual(layout, next)) {
        layout = next;
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  });
</script>

<div class="absolute inset-x-0 top-0 p-2 sm:p-4" style:bottom="{bottomInset}px">
  <div bind:this={root} class="relative size-full">
    {#if layout}
      <div
        class="pointer-events-none absolute z-0 box-border overflow-hidden rounded-lg border border-border/25"
        style:left="{layout.offsetX}px"
        style:top="{layout.offsetY}px"
        style:width="{layout.width}px"
        style:height="{layout.height}px"
        style:background-image={gridLineStyle}
        style:background-size="{layout.cellSize}px {layout.cellSize}px"
        aria-hidden="true"
      ></div>
    {/if}

    <div class="relative z-10 size-full">
      {@render children?.({ layout })}
    </div>
  </div>
</div>
