<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Snippet } from "svelte";

  type Props = {
    left: number;
    top: number;
    width: number;
    height: number;
    draggable?: boolean;
    fullscreen?: boolean;
    onMoveStart?: (event: PointerEvent) => void;
    onMove?: (event: PointerEvent) => void;
    onMoveEnd?: (event: PointerEvent) => void;
    onResizeStart?: (size: { width: number; height: number }) => void;
    onResize?: (widthPx: number, heightPx: number) => void;
    onResizeEnd?: (widthPx: number, heightPx: number) => void;
    actions?: Snippet;
    children: Snippet;
  };

  let {
    left,
    top,
    width,
    height,
    draggable = false,
    fullscreen = false,
    onMoveStart,
    onMove,
    onMoveEnd,
    onResizeStart,
    onResize,
    onResizeEnd,
    actions,
    children,
  }: Props = $props();

  const touchInteractive = $derived(draggable || Boolean(onResize));

  let stopMoveTracking: (() => void) | null = null;
  let stopResizeTracking: (() => void) | null = null;

  onDestroy(() => {
    stopMoveTracking?.();
    stopResizeTracking?.();
  });

  function isTileHandle(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-grid-tile-handle]"));
  }

  function trackPointerSession(event: PointerEvent, onMoveEvent: (event: PointerEvent) => void, onEnd: (event: PointerEvent) => void) {
    const pointerId = event.pointerId;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      onMoveEvent(moveEvent);
    };

    const onPointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      onEnd(endEvent);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }

  function startMove(event: PointerEvent) {
    if (!draggable || isTileHandle(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    stopMoveTracking?.();

    onMoveStart?.(event);

    stopMoveTracking = trackPointerSession(
      event,
      (moveEvent) => onMove?.(moveEvent),
      (endEvent) => {
        stopMoveTracking = null;
        onMoveEnd?.(endEvent);
      }
    );
  }

  function startResize(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    stopResizeTracking?.();

    onResizeStart?.({ width, height });

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = width;
    const startHeight = height;
    let latestWidth = startWidth;
    let latestHeight = startHeight;

    stopResizeTracking = trackPointerSession(
      event,
      (moveEvent) => {
        latestWidth = Math.max(startWidth + moveEvent.clientX - startX, 0);
        latestHeight = Math.max(startHeight + moveEvent.clientY - startY, 0);
        onResize?.(latestWidth, latestHeight);
      },
      () => {
        stopResizeTracking = null;
        onResizeEnd?.(latestWidth, latestHeight);
      }
    );
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group absolute {draggable ? 'cursor-grab active:cursor-grabbing' : ''} {touchInteractive ? 'touch-none select-none' : ''} z-10 {fullscreen
    ? 'z-30'
    : ''}"
  style:left="{left}px"
  style:top="{top}px"
  style:width="{width}px"
  style:height="{height}px"
  onpointerdown={startMove}
>
  {@render children()}

  {#if actions}
    <div class="tile-actions-touch absolute right-1 top-1 z-20 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {@render actions()}
    </div>
  {/if}

  {#if onResize}
    <button
      type="button"
      data-grid-tile-handle="resize"
      class="tile-resize-touch absolute bottom-0 right-0 z-10 flex size-11 cursor-se-resize items-end justify-end rounded-tl-md bg-gradient-to-tl from-black/55 via-black/25 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:size-7 sm:p-1.5"
      aria-label="Resize tile"
      onpointerdown={startResize}
    >
      <span class="flex flex-col items-end gap-0.5" aria-hidden="true">
        <span class="block h-0.5 w-3 rounded-full bg-white/80"></span>
        <span class="block h-0.5 w-2 rounded-full bg-white/80"></span>
        <span class="block h-0.5 w-1.5 rounded-full bg-white/80"></span>
      </span>
    </button>
  {/if}
</div>
