<script lang="ts">
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

  function isTileHandle(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-grid-tile-handle]"));
  }

  function startMove(event: PointerEvent) {
    if (!draggable || isTileHandle(event.target)) return;

    event.preventDefault();

    const tile = event.currentTarget;
    if (!(tile instanceof HTMLElement)) return;

    onMoveStart?.(event);
    tile.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      onMove?.(moveEvent);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      tile.removeEventListener("pointermove", onPointerMove);
      tile.removeEventListener("pointerup", onPointerUp);
      tile.removeEventListener("pointercancel", onPointerUp);
      onMoveEnd?.(upEvent);
    };

    tile.addEventListener("pointermove", onPointerMove);
    tile.addEventListener("pointerup", onPointerUp);
    tile.addEventListener("pointercancel", onPointerUp);
  }

  function startResize(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;

    onResizeStart?.({ width, height });

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = width;
    const startHeight = height;
    let latestWidth = startWidth;
    let latestHeight = startHeight;

    handle.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      latestWidth = Math.max(startWidth + moveEvent.clientX - startX, 0);
      latestHeight = Math.max(startHeight + moveEvent.clientY - startY, 0);
      onResize?.(latestWidth, latestHeight);
    };

    const onPointerUp = () => {
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
      onResizeEnd?.(latestWidth, latestHeight);
    };

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group absolute {draggable ? 'cursor-grab active:cursor-grabbing' : ''} z-10 {fullscreen ? 'z-30' : ''}"
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
      class="tile-resize-touch absolute bottom-1 right-1 z-10 size-7 cursor-se-resize rounded-sm border border-border/70 bg-card/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring sm:size-5"
      aria-label="Resize tile"
      onpointerdown={startResize}
    >
      <span class="absolute inset-x-1 bottom-1.5 block h-px rotate-[-45deg] bg-muted-foreground/70"></span>
      <span class="absolute inset-x-1.5 bottom-1 block h-px rotate-[-45deg] bg-muted-foreground/70"></span>
    </button>
  {/if}
</div>
