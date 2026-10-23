<script lang="ts">
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import XIcon from "@lucide/svelte/icons/x";
  import { formatClock, moveItem } from "$lib/catalog-queue";
  import type { SessionSnapshot, SessionSnapshotQueueItem } from "$lib/server/sessions/types";

  let {
    snapshot = $bindable<SessionSnapshot>(),
    busy = false,
    /** When false, omit the “Queue” heading (e.g. nested under a Queue tab). */
    showHeading = true,
    onerror,
  }: {
    snapshot: SessionSnapshot;
    busy?: boolean;
    showHeading?: boolean;
    onerror?: (message: string | null) => void;
  } = $props();

  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let localBusy = $state(false);

  const canReorder = $derived(Boolean(snapshot.me?.canReorder));
  const canRemove = $derived(Boolean(snapshot.me?.canReorder || snapshot.me?.canAdd));
  const canPlay = $derived(Boolean(snapshot.me?.canPlayPause));
  const currentId = $derived(snapshot.currentItem?.id ?? null);
  const currentIndex = $derived(currentId ? snapshot.queue.findIndex((q) => q.id === currentId) : -1);
  const pastItems = $derived(currentIndex > 0 ? snapshot.queue.slice(0, currentIndex) : []);
  const activeItems = $derived(currentIndex >= 0 ? snapshot.queue.slice(currentIndex) : snapshot.queue);

  async function queuePost(payload: Record<string, unknown>) {
    if (!snapshot.session) return;
    localBusy = true;
    onerror?.(null);
    try {
      const res = await fetch(`/api/sessions/${snapshot.session.id}/queue`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Queue update failed (${res.status})`);
      snapshot = body as SessionSnapshot;
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : "Queue update failed");
    } finally {
      localBusy = false;
    }
  }

  async function playItem(item: SessionSnapshotQueueItem) {
    if (!snapshot.session || !canPlay || !item.playable) return;
    localBusy = true;
    onerror?.(null);
    try {
      const res = await fetch(`/api/sessions/${snapshot.session.id}/transport`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "playItem", queueItemId: item.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Play failed (${res.status})`);
      snapshot = body as SessionSnapshot;
    } catch (err) {
      onerror?.(err instanceof Error ? err.message : "Play failed");
    } finally {
      localBusy = false;
    }
  }

  function startReorder(e: PointerEvent, index: number) {
    if (!canReorder || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFrom = index;
    dragOver = index;
  }

  function moveReorder(e: PointerEvent) {
    if (dragFrom == null) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-qi]");
    if (row?.dataset.qi) dragOver = Number(row.dataset.qi);
    if (listEl) {
      const box = listEl.getBoundingClientRect();
      if (e.clientY < box.top + 28) listEl.scrollBy({ top: -14 });
      else if (e.clientY > box.bottom - 28) listEl.scrollBy({ top: 14 });
    }
  }

  function endReorder() {
    const from = dragFrom;
    const to = dragOver;
    dragFrom = null;
    dragOver = null;
    if (from == null || to == null || from === to) return;
    const orderedIds = moveItem(
      snapshot.queue.map((i) => i.id),
      from,
      to
    );
    void queuePost({ action: "reorder", orderedIds });
  }

  function keyReorder(e: KeyboardEvent, index: number) {
    if (!canReorder) return;
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const to = index + delta;
    if (to < 0 || to >= snapshot.queue.length) return;
    const orderedIds = moveItem(
      snapshot.queue.map((i) => i.id),
      index,
      to
    );
    void queuePost({ action: "reorder", orderedIds });
  }

  const locked = $derived(busy || localBusy);
</script>

<div class="space-y-2">
  {#if showHeading || (snapshot.queue.length > 0 && canRemove)}
    <div class="flex flex-wrap items-center justify-between gap-2">
      {#if showHeading}
        <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Queue</h2>
      {:else}
        <span class="sr-only">Queue</span>
      {/if}
      {#if snapshot.queue.length > 0 && canRemove}
        <button
          type="button"
          class="ml-auto rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-secondary/60 disabled:opacity-40"
          disabled={locked}
          onclick={() => void queuePost({ action: "clear" })}
        >
          Clear
        </button>
      {/if}
    </div>
  {/if}

  <div class="space-y-2">
    <ul bind:this={listEl} class="max-h-[min(32rem,70vh)] min-h-[8rem] overflow-y-auto rounded-lg border border-border/70 bg-card py-1" aria-label="Session queue">
      {#if snapshot.queue.length === 0}
        <li class="px-4 py-8 text-center text-sm text-muted-foreground">Queue empty — add from the library.</li>
      {:else}
        {#each activeItems as item (item.id)}
          {@const index = snapshot.queue.findIndex((q) => q.id === item.id)}
          {@const isCurrent = item.id === currentId}
          <li
            data-qi={index}
            class={`group flex items-center gap-1 px-1.5 ${dragFrom === index ? "opacity-40" : ""} ${
              dragOver === index && dragFrom != null && dragFrom !== index
                ? dragFrom < index
                  ? "border-b-2 border-signal"
                  : "border-t-2 border-signal"
                : ""
            }`}
          >
            {#if canReorder}
              <button
                type="button"
                class="inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-signal disabled:opacity-40"
                disabled={locked}
                aria-label={`Reorder ${item.title}`}
                title="Drag to reorder"
                onpointerdown={(e) => startReorder(e, index)}
                onpointermove={moveReorder}
                onpointerup={endReorder}
                onpointercancel={endReorder}
                onkeydown={(e) => keyReorder(e, index)}
              >
                <GripVerticalIcon class="size-3.5" />
              </button>
            {/if}
            <button
              type="button"
              class={`flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left hover:bg-signal/10 disabled:opacity-40 ${isCurrent ? "bg-signal/10" : ""}`}
              disabled={!canPlay || !item.playable || locked}
              title={canPlay && item.playable ? `Play “${item.title}”` : item.title}
              onclick={() => void playItem(item)}
            >
              <span class={`w-6 shrink-0 text-right font-mono text-[10px] tabular-nums ${isCurrent ? "text-signal" : "text-muted-foreground"}`}>
                {#if isCurrent && snapshot.session?.playbackState === "playing"}
                  <span class="zap-busy-bars inline-flex scale-75" aria-label="Playing"><span></span><span></span><span></span></span>
                {:else}
                  {index + 1}
                {/if}
              </span>
              <span class="min-w-0 flex-1">
                <span class={`block truncate text-[13px] ${isCurrent ? "text-signal" : "text-foreground"}`}>{item.title}</span>
                <span class="block truncate font-mono text-[10px] text-muted-foreground"
                  >{item.artists ?? "Unknown"} · {item.addedByDisplayName}</span
                >
              </span>
              <span class="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(item.durationMs)}</span>
            </button>
            {#if canRemove}
              <button
                type="button"
                class="inline-flex size-7 shrink-0 items-center justify-center rounded text-destructive opacity-70 group-hover:opacity-100 hover:bg-destructive/10 disabled:opacity-40"
                disabled={locked}
                aria-label={`Remove ${item.title}`}
                title="Remove"
                onclick={() => void queuePost({ action: "remove", queueItemId: item.id })}
              >
                <XIcon class="size-3.5" />
              </button>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>

    {#if pastItems.length}
      <div>
        <p class="mb-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Added in the past</p>
        <ul class="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border/50 bg-card py-1" aria-label="Added in the past">
          {#each pastItems as item (item.id)}
            {@const index = snapshot.queue.findIndex((q) => q.id === item.id)}
            <li class="group flex items-center gap-1 px-1.5">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-muted-foreground hover:bg-signal/10 hover:text-foreground disabled:opacity-40"
                disabled={!canPlay || !item.playable || locked}
                title={`Play “${item.title}”`}
                onclick={() => void playItem(item)}
              >
                <span class="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums">{index + 1}</span>
                <span class="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
              </button>
              {#if canRemove}
                <button
                  type="button"
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded text-destructive opacity-70 group-hover:opacity-100 hover:bg-destructive/10 disabled:opacity-40"
                  disabled={locked}
                  aria-label={`Remove ${item.title}`}
                  title="Remove"
                  onclick={() => void queuePost({ action: "remove", queueItemId: item.id })}
                >
                  <XIcon class="size-3.5" />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</div>
