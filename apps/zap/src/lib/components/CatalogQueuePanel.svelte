<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import Repeat1Icon from "@lucide/svelte/icons/repeat-1";
  import SaveIcon from "@lucide/svelte/icons/save";
  import ShuffleIcon from "@lucide/svelte/icons/shuffle";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import SquareIcon from "@lucide/svelte/icons/square";
  import XIcon from "@lucide/svelte/icons/x";
  import { formatClock, moveItem } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import QueueTagMarks from "$lib/components/QueueTagMarks.svelte";
  import SeekBar from "$lib/components/SeekBar.svelte";

  let {
    queue,
    audioBlocked = false,
    localNote = null,
    /** Only show tags when the floating queue is maximized (fullscreen). */
    showTags = false,
    onunlock,
  }: {
    queue: CatalogQueueClient;
    /** Browser refused autoplay on this device — needs a tap. */
    audioBlocked?: boolean;
    /** Why this device is silent (remote-only, session open…). */
    localNote?: string | null;
    showTags?: boolean;
    onunlock?: () => void;
  } = $props();

  const current = $derived(queue.currentItem);
  const durationMs = $derived(current?.durationMs ?? 0);
  /** Queue order before the playhead; ascending — recently played at the bottom. */
  const pastItems = $derived(queue.currentIndex > 0 ? queue.items.slice(0, queue.currentIndex) : []);
  /** Up-next only — currently playing lives in the bottom chrome. */
  const upcomingItems = $derived(queue.currentIndex >= 0 ? queue.items.slice(queue.currentIndex + 1) : queue.items);

  let scrubMs = $state<number | null>(null);
  let saveOpen = $state(false);
  let saveName = $state("");
  let savedLink = $state<{ id: string; name: string } | null>(null);
  let pastOpen = $state(true);

  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let pastListEl = $state<HTMLUListElement | null>(null);

  /** When Played before opens (or grows), pin scroll to the most recent track at the bottom. */
  $effect(() => {
    if (!pastOpen) return;
    const el = pastListEl;
    const n = pastItems.length;
    if (!el || n === 0) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  });

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

{#snippet queueRow(item: (typeof queue.items)[number], muted = false)}
  {@const index = queue.items.findIndex((i) => i.id === item.id)}
  <li
    data-qi={index}
    class={`zap-queue-row zap-track group flex items-center gap-1 px-1.5 ${muted ? "opacity-80" : ""} ${dragFrom === index ? "opacity-40" : ""} ${
      dragOver === index && dragFrom != null && dragFrom !== index ? (dragFrom < index ? "border-b-2 border-signal" : "border-t-2 border-signal") : ""
    }`}
  >
    {#if !muted}
      <button
        type="button"
        class="zap-transport-btn size-7 shrink-0 cursor-grab touch-none"
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
    {/if}
    <button
      type="button"
      class={`flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left disabled:opacity-40 sm:py-1 ${muted ? "text-muted-foreground hover:text-foreground" : ""}`}
      disabled={!item.playable}
      title={item.playable ? `Play from “${item.title}”` : "Not playable"}
      onclick={() => void queue.jump(item.id)}
    >
      <span class="w-6 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{index + 1}</span>
      <span class="min-w-0 flex-1">
        <span class="zap-track-title block truncate text-[13px] text-foreground">{item.title}</span>
        {#if !muted}
          <span class="block truncate font-mono text-[10px] text-muted-foreground">{item.artists ?? "Unknown"}</span>
        {/if}
      </span>
      {#if showTags && (item.tags?.length ?? 0) > 0}
        <span class="hidden max-w-[45%] shrink-0 flex-wrap items-center justify-end gap-0.5 sm:flex">
          <QueueTagMarks tags={item.tags ?? []} />
        </span>
      {/if}
      {#if !muted}
        <span class="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(item.durationMs)}</span>
      {/if}
    </button>
    <button
      type="button"
      class="inline-flex size-7 shrink-0 items-center justify-center rounded text-destructive opacity-70 group-hover:opacity-100 hover:bg-destructive/10"
      aria-label={`Remove ${item.title}`}
      title="Remove"
      onclick={() => void queue.remove(item.id)}
    >
      <XIcon class="size-3.5" />
    </button>
  </li>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  {#if pastItems.length}
    <div class="shrink-0 border-b border-border/60">
      <button
        type="button"
        class="flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase hover:bg-signal/5 hover:text-signal"
        aria-expanded={pastOpen}
        aria-controls="queue-played-before"
        onclick={() => (pastOpen = !pastOpen)}
      >
        <ChevronDownIcon class={`size-3.5 shrink-0 transition-transform ${pastOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
        <span class="min-w-0 flex-1">Played before</span>
        <span class="tabular-nums normal-case tracking-normal">{pastItems.length}</span>
      </button>
      {#if pastOpen}
        <ul
          bind:this={pastListEl}
          id="queue-played-before"
          class="zap-track-host max-h-36 overflow-y-auto overscroll-contain px-1.5 pb-1"
          aria-label="Played before"
        >
          {#each pastItems as item (item.id)}
            {@render queueRow(item, true)}
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <ul bind:this={listEl} class="zap-track-host min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5" aria-label="Up next">
    {#if upcomingItems.length === 0}
      <li class="px-3 py-4 font-mono text-[11px] text-muted-foreground">
        {queue.items.length === 0 ? "Queue is empty" : current ? "Nothing up next" : "Queue finished"}
      </li>
    {:else}
      {#each upcomingItems as item (item.id)}
        {@render queueRow(item)}
      {/each}
    {/if}
  </ul>

  <div class="zap-queue-now shrink-0 border-t border-border/60 px-3 py-2.5">
    <div class="flex items-stretch gap-2 sm:gap-3">
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div class="min-w-0">
          <p class={`truncate font-medium ${showTags ? "text-base" : "text-sm"}`} title={current?.title}>
            {current?.title ?? "Queue finished — press play to start over"}
          </p>
          <p class="truncate font-mono text-[11px] text-muted-foreground">
            {current?.artists ?? "—"} · {queue.currentIndex >= 0
              ? `${queue.currentIndex + 1} / ${queue.items.length}`
              : `${queue.items.length} tracks`}
          </p>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="zap-meta-disclosure h-7 gap-1 px-1" title="Save this queue as a freehand playlist" onclick={openSave}>
            <SaveIcon class="size-3.5" /> Save
          </button>
          <button
            type="button"
            class="inline-flex h-7 items-center gap-1 px-1 font-mono text-[10px] text-destructive hover:underline"
            title="Stop and move this queue to History"
            onclick={() => void queue.stop()}
          >
            <SquareIcon class="size-3.5" /> Stop
          </button>
        </div>
      </div>

      <div class={`flex shrink-0 items-center self-stretch ${showTags ? "gap-1" : "gap-0.5"}`} role="group" aria-label="Transport">
        <button
          type="button"
          class={`zap-transport-btn disabled:opacity-40 ${showTags ? "size-11" : "size-8"}`}
          aria-label="Previous"
          title="Previous"
          disabled={queue.items.length === 0}
          onclick={() => void queue.previous()}
        >
          <SkipBackIcon class={showTags ? "size-5" : "size-3.5"} />
        </button>
        <button
          type="button"
          class={`zap-transport-play disabled:opacity-40 ${showTags ? "size-14" : "size-9"} ${queue.playing ? "is-active" : ""}`}
          aria-label={queue.playing ? "Pause" : "Play"}
          title={queue.playing ? "Pause" : "Play"}
          disabled={queue.items.length === 0}
          onclick={() => void queue.togglePlay()}
        >
          {#if queue.playing}
            <PauseIcon class={showTags ? "size-7" : "size-4"} />
          {:else}
            <PlayIcon class={showTags ? "size-7" : "size-4"} />
          {/if}
        </button>
        <button
          type="button"
          class={`zap-transport-btn disabled:opacity-40 ${showTags ? "size-11" : "size-8"}`}
          aria-label="Next"
          title="Next"
          disabled={!current}
          onclick={() => void queue.next()}
        >
          <SkipForwardIcon class={showTags ? "size-5" : "size-3.5"} />
        </button>
        <button
          type="button"
          class={`zap-transport-btn disabled:opacity-40 ${showTags ? "size-11" : "size-8"} ${queue.shuffle ? "text-signal" : ""}`}
          aria-label={queue.shuffle ? "Shuffle on" : "Shuffle off"}
          aria-pressed={queue.shuffle}
          title={queue.shuffle ? "Shuffle on" : "Shuffle off"}
          disabled={queue.items.length < 2}
          onclick={() => void queue.setShuffle(!queue.shuffle)}
        >
          <ShuffleIcon class={showTags ? "size-5" : "size-3.5"} />
        </button>
        <button
          type="button"
          class={`zap-transport-btn disabled:opacity-40 ${showTags ? "size-11" : "size-8"} ${queue.loop !== "off" ? "text-signal" : ""}`}
          aria-label={queue.loop === "one" ? "Loop one" : queue.loop === "all" ? "Loop all" : "Loop off"}
          title={queue.loop === "one" ? "Loop one" : queue.loop === "all" ? "Loop all" : "Loop off"}
          disabled={queue.items.length === 0}
          onclick={() => void queue.cycleLoop()}
        >
          {#if queue.loop === "one"}
            <Repeat1Icon class={showTags ? "size-5" : "size-3.5"} />
          {:else}
            <RepeatIcon class={showTags ? "size-5" : "size-3.5"} />
          {/if}
        </button>
      </div>
    </div>

    <div class="mt-2.5 flex items-center gap-2">
      <span class="w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(scrubMs ?? queue.positionMs)}</span>
      <SeekBar valueMs={queue.positionMs} {durationMs} disabled={!current} onseek={(ms) => void queue.seek(ms)} onscrub={(ms) => (scrubMs = ms)} />
      <span class="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(durationMs)}</span>
    </div>

    {#if audioBlocked}
      <button
        type="button"
        class="mt-2 w-full rounded border border-signal/50 bg-signal/10 px-2 py-1.5 font-mono text-[11px] text-signal"
        onclick={onunlock}
      >
        Tap to start audio on this device
      </button>
    {:else if localNote}
      <p class="mt-2 font-mono text-[10px] text-muted-foreground">{localNote}</p>
    {/if}
    {#if saveOpen}
      <form
        class="mt-2 flex gap-1.5"
        onsubmit={(e) => {
          e.preventDefault();
          void saveAsPlaylist();
        }}
      >
        <input class="zap-underline-field h-8 py-0 text-xs" bind:value={saveName} maxlength="80" aria-label="Playlist name" />
        <button
          type="submit"
          class="rounded bg-primary px-2 text-xs text-primary-foreground disabled:opacity-40"
          disabled={!saveName.trim() || queue.pending > 0}>Save</button
        >
      </form>
    {/if}
    {#if savedLink}
      <p class="mt-2 font-mono text-[10px] text-signal">
        Saved — <a class="underline" href={`/playlists/${savedLink.id}`}>{savedLink.name}</a>
      </p>
    {/if}
    {#if queue.error}
      <p class="mt-2 font-mono text-[10px] text-destructive">{queue.error}</p>
    {/if}
  </div>
</div>
