<script lang="ts">
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import Repeat1Icon from "@lucide/svelte/icons/repeat-1";
  import ShuffleIcon from "@lucide/svelte/icons/shuffle";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import { formatClock } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import SeekBar from "$lib/components/SeekBar.svelte";
  import { DOCK_BAR_H, DROP_ZONE_PX, inDropZone } from "$lib/floating-panel";

  let {
    queue,
    audioBlocked = false,
    localNote = null,
    /** When true (small screens), dock stays locked — no undock grip / maximize button; swipe up maximizes. */
    locked = false,
    onunlock,
    onmaximize,
    onundock,
  }: {
    queue: CatalogQueueClient;
    audioBlocked?: boolean;
    localNote?: string | null;
    locked?: boolean;
    onunlock?: () => void;
    onmaximize: () => void;
    /** Drag the left handle out of the footer to return to the floating mini window (desktop). */
    onundock: () => void;
  } = $props();

  const current = $derived(queue.currentItem);
  const nextItem = $derived(queue.currentIndex >= 0 && queue.currentIndex + 1 < queue.items.length ? queue.items[queue.currentIndex + 1]! : null);
  const durationMs = $derived(current?.durationMs ?? 0);

  let scrubMs = $state<number | null>(null);
  let undockDragging = $state(false);
  let undockWillLeave = $state(false);
  let undockStart: { x: number; y: number } | null = null;

  /** Swipe-up-to-maximize (mobile locked dock). */
  let swipeStart: { x: number; y: number; t: number } | null = null;

  function startUndock(e: PointerEvent) {
    if (locked || e.button !== 0) return;
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
    undockWillLeave = !inDropZone(e.clientY, vp) || e.clientY < vp.h - DROP_ZONE_PX - 8;
  }

  function endUndock() {
    const leave = undockWillLeave;
    undockStart = null;
    undockDragging = false;
    undockWillLeave = false;
    if (leave) onundock();
  }

  function onDockPointerDown(e: PointerEvent) {
    if (!locked || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, a, [data-no-swipe]")) return;
    swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDockPointerUp(e: PointerEvent) {
    if (!locked || !swipeStart) {
      swipeStart = null;
      return;
    }
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    const dt = Date.now() - swipeStart.t;
    swipeStart = null;
    // Swipe up: enough vertical travel, mostly vertical, not too slow.
    if (dy < -48 && Math.abs(dy) > Math.abs(dx) * 1.2 && dt < 800) {
      onmaximize();
    }
  }

  function onDockPointerCancel() {
    swipeStart = null;
  }
</script>

{#snippet transport()}
  <button
    type="button"
    class="zap-transport-btn size-8 disabled:opacity-40"
    aria-label="Previous"
    title="Previous"
    disabled={queue.items.length === 0}
    onclick={() => void queue.previous()}
  >
    <SkipBackIcon class="size-3.5" />
  </button>
  <button
    type="button"
    class={`zap-transport-play size-9 disabled:opacity-40 ${queue.playing ? "is-active" : ""}`}
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
    class="zap-transport-btn size-8 disabled:opacity-40"
    aria-label="Next"
    title="Next"
    disabled={!current}
    onclick={() => void queue.next()}
  >
    <SkipForwardIcon class="size-3.5" />
  </button>
{/snippet}

<div
  class={`zap-queue-dock fixed inset-x-0 bottom-0 z-[42] flex border-t border-signal/40 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] ${
    undockDragging && undockWillLeave ? "opacity-70" : ""
  } ${locked ? "touch-pan-y" : ""}`}
  style={`height:${DOCK_BAR_H}px`}
  role="region"
  aria-label={locked ? "Docked queue player. Swipe up to maximize." : "Docked queue player"}
  onpointerdown={onDockPointerDown}
  onpointerup={onDockPointerUp}
  onpointercancel={onDockPointerCancel}
>
  {#if !locked}
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
  {/if}

  <div class="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 sm:gap-3" data-no-swipe>
    <!-- Title: takes remaining space; on mobile transport sits on the right -->
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-foreground" title={current?.title}>{current?.title ?? "Queue finished"}</p>
      <p class="truncate font-mono text-[10px] text-muted-foreground">{current?.artists ?? "—"}</p>
    </div>

    <!-- Desktop: centered transport + shuffle/loop -->
    <div class="pointer-events-none absolute inset-y-0 left-1/2 z-[1] hidden -translate-x-1/2 items-center sm:flex">
      <div class="pointer-events-auto flex shrink-0 items-center gap-1">
        {@render transport()}
        <button
          type="button"
          class={`zap-transport-btn size-8 disabled:opacity-40 ${queue.shuffle ? "text-signal" : ""}`}
          aria-label={queue.shuffle ? "Shuffle on" : "Shuffle off"}
          aria-pressed={queue.shuffle}
          title={queue.shuffle ? "Shuffle on" : "Shuffle off"}
          disabled={queue.items.length < 2}
          onclick={() => void queue.setShuffle(!queue.shuffle)}
        >
          <ShuffleIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class={`zap-transport-btn size-8 disabled:opacity-40 ${queue.loop !== "off" ? "text-signal" : ""}`}
          aria-label={queue.loop === "one" ? "Loop one" : queue.loop === "all" ? "Loop all" : "Loop off"}
          title={queue.loop === "one" ? "Loop one" : queue.loop === "all" ? "Loop all" : "Loop off"}
          disabled={queue.items.length === 0}
          onclick={() => void queue.cycleLoop()}
        >
          {#if queue.loop === "one"}
            <Repeat1Icon class="size-3.5" />
          {:else}
            <RepeatIcon class="size-3.5" />
          {/if}
        </button>
      </div>
    </div>

    <!-- Mobile: transport on the right. Desktop: seek + up next + maximize -->
    <div class="flex shrink-0 items-center justify-end gap-1 sm:min-w-0 sm:flex-1 sm:gap-2 sm:pl-[4.5rem]">
      <div class="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex sm:gap-2">
        <span class="w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums"
          >{formatClock(scrubMs ?? queue.positionMs)}</span
        >
        <SeekBar
          class="h-1.5 w-full min-w-[4rem]"
          valueMs={queue.positionMs}
          {durationMs}
          disabled={!current}
          onseek={(ms) => void queue.seek(ms)}
          onscrub={(ms) => (scrubMs = ms)}
        />
        <span class="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums"
          >{formatClock(durationMs)}</span
        >
      </div>

      <div class="hidden min-w-0 max-w-[11rem] md:block">
        <p class="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">Up next</p>
        <p class="truncate text-xs text-foreground" title={nextItem?.title}>{nextItem?.title ?? "—"}</p>
      </div>

      <!-- Mobile-only transport on the right -->
      <div class="flex items-center gap-0.5 sm:hidden">
        {@render transport()}
      </div>

      {#if !locked}
        <button
          type="button"
          class="zap-transport-btn hidden size-8 shrink-0 sm:inline-flex"
          aria-label="Maximize queue"
          title="Maximize queue"
          onclick={onmaximize}
        >
          <Maximize2Icon class="size-3.5" aria-hidden="true" />
        </button>
      {/if}
    </div>
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
