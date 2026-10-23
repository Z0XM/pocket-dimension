<script lang="ts">
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import MonitorSpeakerIcon from "@lucide/svelte/icons/monitor-speaker";
  import CatalogDevicesPanel from "$lib/components/CatalogDevicesPanel.svelte";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import {
    CORNER_DROP_PX,
    DEVICES_DOCK_H,
    DEVICES_DOCK_W,
    devicesDockBottomPx,
    inCornerDropZone,
  } from "$lib/floating-panel";

  let {
    queue,
    queueDocked = false,
    onmaximize,
    onundock,
  }: {
    queue: CatalogQueueClient;
    /** When true, sit on top of the docked queue footer (bottom aligns with footer top). */
    queueDocked?: boolean;
    onmaximize: () => void;
    onundock: () => void;
  } = $props();

  const bottomPx = $derived(devicesDockBottomPx(queueDocked));
  const onlineCount = $derived(queue.onlineDevices.length);

  let undockDragging = $state(false);
  let undockWillLeave = $state(false);
  let undockStart: { x: number; y: number } | null = null;

  function startUndock(e: PointerEvent) {
    if (e.button !== 0) return;
    undockStart = { x: e.clientX, y: e.clientY };
    undockDragging = true;
    undockWillLeave = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function moveUndock(e: PointerEvent) {
    if (!undockStart) return;
    if (Math.hypot(e.clientX - undockStart.x, e.clientY - undockStart.y) < 6) return;
    const vp = { w: window.innerWidth, h: window.innerHeight };
    // Leave the corner band (accounting for queue footer inset) → restore floating mini.
    undockWillLeave = !inCornerDropZone(e.clientX, e.clientY, vp, queueDocked ? bottomPx : 0);
  }

  function endUndock() {
    const leave = undockWillLeave;
    undockStart = null;
    undockDragging = false;
    undockWillLeave = false;
    if (leave) onundock();
  }
</script>

<div
  class={`zap-devices-dock fixed right-2 z-[42] flex flex-col overflow-hidden border border-signal/40 bg-background-mid/95 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur transition-[bottom] duration-200 ${
    undockDragging && undockWillLeave ? "opacity-70" : ""
  }`}
  style={`bottom:${bottomPx}px;width:min(${DEVICES_DOCK_W}px,calc(100vw - 1rem));height:${DEVICES_DOCK_H}px`}
  role="region"
  aria-label="Docked devices"
>
  <div class="flex shrink-0 items-center gap-1 border-b border-border/60 px-1.5 py-1">
    <button
      type="button"
      class={`inline-flex size-7 touch-none items-center justify-center rounded text-muted-foreground hover:bg-signal/10 hover:text-signal ${
        undockDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      aria-label="Drag out to undock devices"
      title="Drag out to undock"
      onpointerdown={startUndock}
      onpointermove={moveUndock}
      onpointerup={endUndock}
      onpointercancel={endUndock}
    >
      <GripVerticalIcon class="size-3.5" aria-hidden="true" />
    </button>
    <MonitorSpeakerIcon class="size-3.5 shrink-0 text-signal" aria-hidden="true" />
    <p class="min-w-0 flex-1 truncate font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
      Devices
      <span class="text-signal">· {onlineCount}</span>
    </p>
    <button
      type="button"
      class="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-signal/10 hover:text-signal"
      aria-label="Maximize devices"
      title="Maximize"
      onclick={onmaximize}
    >
      <Maximize2Icon class="size-3.5" aria-hidden="true" />
    </button>
  </div>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden text-[12px] [&_p]:text-[11px]">
    <CatalogDevicesPanel {queue} />
  </div>
</div>

{#if undockDragging && undockWillLeave}
  <div
    class="pointer-events-none fixed right-2 z-[45] flex items-center justify-center border border-signal/50 bg-signal/15 font-mono text-[11px] tracking-[0.14em] text-signal uppercase"
    style={`bottom:${bottomPx + 8}px;width:${CORNER_DROP_PX}px;height:${CORNER_DROP_PX}px`}
    aria-hidden="true"
  >
    Release to undock
  </div>
{/if}
