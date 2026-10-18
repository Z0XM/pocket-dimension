<script lang="ts">
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SaveIcon from "@lucide/svelte/icons/save";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import SquareIcon from "@lucide/svelte/icons/square";
  import XIcon from "@lucide/svelte/icons/x";
  import { formatClock, moveItem } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";

  let {
    queue,
    audioBlocked = false,
    localNote = null,
    onunlock,
  }: {
    queue: CatalogQueueClient;
    /** Browser refused autoplay on this device — needs a tap. */
    audioBlocked?: boolean;
    /** Why this device is silent (remote-only, session open…). */
    localNote?: string | null;
    onunlock?: () => void;
  } = $props();

  const current = $derived(queue.currentItem);
  const durationMs = $derived(current?.durationMs ?? 0);

  let scrubMs = $state<number | null>(null);
  let saveOpen = $state(false);
  let saveName = $state("");
  let savedLink = $state<{ id: string; name: string } | null>(null);

  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);

  function onSeekInput(e: Event) {
    scrubMs = Number((e.currentTarget as HTMLInputElement).value) * 1000;
  }

  function onSeekCommit(e: Event) {
    const ms = Number((e.currentTarget as HTMLInputElement).value) * 1000;
    scrubMs = null;
    if (Number.isFinite(ms)) void queue.seek(ms);
  }

  function startReorder(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
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
    void queue.reorder(
      moveItem(
        queue.items.map((i) => i.id),
        from,
        to
      )
    );
  }

  function keyReorder(e: KeyboardEvent, index: number) {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const to = index + delta;
    if (to < 0 || to >= queue.items.length) return;
    void queue.reorder(
      moveItem(
        queue.items.map((i) => i.id),
        index,
        to
      )
    );
  }

  async function saveAsPlaylist() {
    const runId = queue.queue?.id;
    if (!runId || !saveName.trim()) return;
    const saved = await queue.saveRunAsPlaylist(runId, saveName.trim());
    if (saved) {
      savedLink = { id: saved.id, name: saved.name };
      saveOpen = false;
    }
  }

  function openSave() {
    saveName = `Queue · ${new Date().toLocaleDateString()}`;
    savedLink = null;
    saveOpen = !saveOpen;
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="shrink-0 space-y-2 border-b border-border/60 px-3 py-2.5">
    <div class="min-w-0">
      <p class="truncate text-sm font-medium" title={current?.title}>{current?.title ?? "Queue finished — press play to start over"}</p>
      <p class="truncate font-mono text-[11px] text-muted-foreground">
        {current?.artists ?? "—"} · {queue.currentIndex >= 0 ? `${queue.currentIndex + 1} / ${queue.items.length}` : `${queue.items.length} tracks`}
      </p>
    </div>
    <div class="flex items-center gap-1.5">
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
      <span class="ml-auto flex items-center gap-1">
        <button
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded border border-border px-2 font-mono text-[10px] text-muted-foreground hover:text-signal"
          title="Save this queue as a freehand playlist"
          onclick={openSave}
        >
          <SaveIcon class="size-3" /> Save
        </button>
        <button
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded border border-destructive/40 px-2 font-mono text-[10px] text-destructive hover:bg-destructive/10"
          title="Stop and move this queue to History"
          onclick={() => void queue.stop()}
        >
          <SquareIcon class="size-3" /> Stop
        </button>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <span class="w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(scrubMs ?? queue.positionMs)}</span>
      <input
        class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)] disabled:opacity-40"
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
      <span class="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(durationMs)}</span>
    </div>
    {#if audioBlocked}
      <button
        type="button"
        class="w-full rounded border border-signal/50 bg-signal/10 px-2 py-1.5 font-mono text-[11px] text-signal"
        onclick={onunlock}
      >
        Tap to start audio on this device
      </button>
    {:else if localNote}
      <p class="font-mono text-[10px] text-muted-foreground">{localNote}</p>
    {/if}
    {#if saveOpen}
      <form
        class="flex gap-1.5"
        onsubmit={(e) => {
          e.preventDefault();
          void saveAsPlaylist();
        }}
      >
        <input class="auth-field h-8 py-0 text-xs" bind:value={saveName} maxlength="80" aria-label="Playlist name" />
        <button
          type="submit"
          class="rounded bg-primary px-2 text-xs text-primary-foreground disabled:opacity-40"
          disabled={!saveName.trim() || queue.pending > 0}>Save</button
        >
      </form>
    {/if}
    {#if savedLink}
      <p class="font-mono text-[10px] text-signal">
        Saved — <a class="underline" href={`/playlists/${savedLink.id}`}>{savedLink.name}</a>
      </p>
    {/if}
    {#if queue.error}
      <p class="font-mono text-[10px] text-destructive">{queue.error}</p>
    {/if}
  </div>

  <ul bind:this={listEl} class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1" aria-label="Queue">
    {#each queue.items as item, index (item.id)}
      {@const isCurrent = item.id === queue.queue?.currentItemId}
      {@const isPast = queue.currentIndex >= 0 && index < queue.currentIndex}
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
        <button
          type="button"
          class="inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-signal"
          aria-label={`Reorder ${item.title} (arrow keys)`}
          title="Drag to reorder"
          onpointerdown={(e) => startReorder(e, index)}
          onpointermove={moveReorder}
          onpointerup={endReorder}
          onpointercancel={endReorder}
          onkeydown={(e) => keyReorder(e, index)}
        >
          <GripVerticalIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class={`flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left hover:bg-signal/10 disabled:opacity-40 ${isCurrent ? "bg-signal/10" : ""}`}
          disabled={!item.playable}
          title={item.playable ? `Play from “${item.title}”` : "Not playable"}
          onclick={() => void queue.jump(item.id)}
        >
          <span class={`w-6 shrink-0 text-right font-mono text-[10px] tabular-nums ${isCurrent ? "text-signal" : "text-muted-foreground"}`}>
            {#if isCurrent && queue.playing}
              <span class="zap-busy-bars inline-flex scale-75" aria-label="Playing"><span></span><span></span><span></span></span>
            {:else}
              {index + 1}
            {/if}
          </span>
          <span class="min-w-0 flex-1">
            <span class={`block truncate text-[13px] ${isCurrent ? "text-signal" : isPast ? "text-muted-foreground" : "text-foreground"}`}
              >{item.title}</span
            >
            <span class="block truncate font-mono text-[10px] text-muted-foreground">{item.artists ?? "Unknown"}</span>
          </span>
          <span class="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(item.durationMs)}</span>
        </button>
        <button
          type="button"
          class="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 group-hover:opacity-100 hover:text-destructive"
          aria-label={`Remove ${item.title}`}
          title="Remove"
          onclick={() => void queue.remove(item.id)}
        >
          <XIcon class="size-3.5" />
        </button>
      </li>
    {/each}
  </ul>
</div>
