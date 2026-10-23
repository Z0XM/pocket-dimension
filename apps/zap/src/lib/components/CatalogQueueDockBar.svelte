<script lang="ts">
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import { formatClock } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import { DOCK_BAR_H, DROP_ZONE_PX, inDropZone } from "$lib/floating-panel";

  let {
    queue,
    audioBlocked = false,
    localNote = null,
    onunlock,
    onmaximize,
    onundock,
  }: {
    queue: CatalogQueueClient;
    audioBlocked?: boolean;
    localNote?: string | null;
    onunlock?: () => void;
    onmaximize: () => void;
    /** Drag the left handle out of the footer to return to the floating mini window. */
    onundock: () => void;
  } = $props();

  const current = $derived(queue.currentItem);
  const nextItem = $derived(
    queue.currentIndex >= 0 && queue.currentIndex + 1 < queue.items.length ? queue.items[queue.currentIndex + 1]! : null
  );
  const durationMs = $derived(current?.durationMs ?? 0);

  let scrubMs = $state<number | null>(null);
  let undockDragging = $state(false);
  let undockWillLeave = $state(false);
  let undockStart: { x: number; y: number } | null = null;

  function onSeekInput(e: Event) {
    scrubMs = Number((e.currentTarget as HTMLInputElement).value) * 1000;
  }

  function onSeekCommit(e: Event) {
    const ms = Number((e.currentTarget as HTMLInputElement).value) * 1000;
    scrubMs = null;
    if (Number.isFinite(ms)) void queue.seek(ms);
  }

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
    // Leave the footer band → ready to restore the floating mini window.
    undockWillLeave = !inDropZone(e.clientY, vp) || e.clientY < vp.h - DROP_ZONE_PX - 8;
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
  class={`zap-queue-dock fixed inset-x-0 bottom-0 z-[42] flex border-t border-signal/40 bg-background-mid/95 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur ${
    undockDragging && undockWillLeave ? "opacity-70" : ""
  }`}
  style={`height:${DOCK_BAR_H}px`}
  role="region"
  aria-label="Docked queue player"
>
  <button
    type="button"
    class={`inline-flex h-full w-9 shrink-0 touch-none items-center justify-center border-r border-border/60 text-muted-foreground hover:bg-signal/10 hover:text-signal ${
      undockDragging ? "cursor-grabbing" : "cursor-grab"
    }`}
    aria-label="Drag out to undock queue"
    title="Drag out to undock"
    onpointerdown={startUndock}
    onpointermove={moveUndock}
    onpointerup={endUndock}
    onpointercancel={endUndock}
  >
    <GripVerticalIcon class="size-4" aria-hidden="true" />
  </button>

  <div class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3">
    <div class="min-w-0 flex-1 basis-[30%] sm:basis-[28%]">
      <p class="truncate text-sm font-medium text-foreground" title={current?.title}>{current?.title ?? "Queue finished"}</p>
      <p class="truncate font-mono text-[10px] text-muted-foreground">{current?.artists ?? "—"}</p>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
        aria-label="Previous"
        title="Previous"
        disabled={queue.items.length === 0}
        onclick={() => void queue.previous()}
      >
        <SkipBackIcon class="size-3.5" />
      </button>
      <button
        type="button"
        class="inline-flex size-9 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 disabled:opacity-40"
        aria-label={queue.playing ? "Pause" : "Play"}
        title={queue.playing ? "Pause" : "Play"}
        disabled={queue.items.length === 0}
        onclick={() => void queue.togglePlay()}
      >
        {#if queue.playing}
          <PauseIcon class="size-4" />
        {:else}
          <PlayIcon class="size-4" />
        {/if}
      </button>
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
        aria-label="Next"
        title="Next"
        disabled={!current}
        onclick={() => void queue.next()}
      >
        <SkipForwardIcon class="size-3.5" />
      </button>
    </div>

    <div class="flex min-w-0 flex-[1.2] items-center gap-1.5 sm:flex-[1.4] sm:gap-2">
      <span class="hidden w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums sm:inline"
        >{formatClock(scrubMs ?? queue.positionMs)}</span
      >
      <input
        class="zap-seek h-1.5 w-full min-w-[4rem] cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)] disabled:opacity-40"
        type="range"
        min="0"
        max={Math.max(durationMs / 1000, 1)}
        step="0.5"
        value={(scrubMs ?? queue.positionMs) / 1000}
        disabled={!current}
        aria-label="Seek"
        oninput={onSeekInput}
        onchange={onSeekCommit}
      />
      <span class="hidden w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums sm:inline"
        >{formatClock(durationMs)}</span
      >
    </div>

    <div class="hidden min-w-0 max-w-[11rem] flex-1 basis-[20%] md:block">
      <p class="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">Up next</p>
      <p class="truncate text-xs text-foreground" title={nextItem?.title}>{nextItem?.title ?? "—"}</p>
    </div>

    <button
      type="button"
      class="inline-flex size-8 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:border-signal/50 hover:bg-signal/10 hover:text-signal"
      aria-label="Maximize queue"
      title="Maximize queue"
      onclick={onmaximize}
    >
      <Maximize2Icon class="size-3.5" aria-hidden="true" />
    </button>
  </div>
</div>

{#if audioBlocked}
  <button
    type="button"
    class="fixed inset-x-0 z-[43] border-t border-signal/50 bg-signal/15 px-3 py-1.5 font-mono text-[11px] text-signal"
    style={`bottom:${DOCK_BAR_H}px`}
    onclick={onunlock}
  >
    Tap to start audio on this device
  </button>
{:else if localNote}
  <p
    class="pointer-events-none fixed inset-x-0 z-[43] border-t border-border/60 bg-background/90 px-3 py-1 font-mono text-[10px] text-muted-foreground"
    style={`bottom:${DOCK_BAR_H}px`}
  >
    {localNote}
  </p>
{/if}

{#if undockDragging && undockWillLeave}
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex h-[72px] items-center justify-center border-t border-signal/50 bg-signal/15 font-mono text-[11px] tracking-[0.14em] text-signal uppercase"
    aria-hidden="true"
  >
    Release to undock
  </div>
{/if}
