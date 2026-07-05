<script lang="ts">
  import { onDestroy } from "svelte";
  import { drawHandOverlay } from "$lib/gestures/draw-hand-overlay";
  import type { DetectedGesture, HandLandmark } from "$lib/gestures/gesture-types";

  type Props = {
    handLandmarks?: HandLandmark[] | null;
    gesture?: DetectedGesture;
    holdProgress?: number;
    visible?: boolean;
    mirrored?: boolean;
  };

  let { handLandmarks = null, gesture = "none", holdProgress = 0, visible = false, mirrored = false }: Props = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);

  function syncCanvasSize() {
    const container = containerEl;
    const canvas = canvasEl;
    if (!container || !canvas) return;

    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function paint() {
    if (!visible) return;

    syncCanvasSize();
    const canvas = canvasEl;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawHandOverlay(ctx, canvas.width, canvas.height, handLandmarks, gesture, { mirrored, holdProgress });
  }

  $effect(() => {
    handLandmarks;
    gesture;
    holdProgress;
    visible;
    mirrored;
    paint();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  let resizeObserver: ResizeObserver | undefined;

  $effect(() => {
    const container = containerEl;
    resizeObserver?.disconnect();
    if (!container) return;

    resizeObserver = new ResizeObserver(() => paint());
    resizeObserver.observe(container);

    return () => resizeObserver?.disconnect();
  });
</script>

{#if visible}
  <div bind:this={containerEl} class="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
    <canvas bind:this={canvasEl} class="size-full"></canvas>
  </div>
{/if}
