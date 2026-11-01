<script lang="ts">
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import ListPlusIcon from "@lucide/svelte/icons/list-plus";
  import ListStartIcon from "@lucide/svelte/icons/list-start";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import TagsIcon from "@lucide/svelte/icons/tags";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import EditTagsDialog from "$lib/components/EditTagsDialog.svelte";
  import SeekBar from "$lib/components/SeekBar.svelte";
  import SongDispositionDialog from "$lib/components/SongDispositionDialog.svelte";
  import { archiveSongAsAdmin, deleteSongAsAdmin } from "$lib/admin-song-delete";
  import { formatClock, type EnqueueMode } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import { toast } from "$lib/toast.svelte";

  export type TrackItem = {
    id: string;
    title: string;
    artists: string | null;
    description?: string | null;
    channelTitle?: string | null;
    channelId?: string | null;
    durationMs: number | null;
    sourceType: string;
    playable: boolean;
    /** False for metadata-only rows (deleted / private / blocked source). */
    available?: boolean;
    unavailableReason?: string | null;
    externalUrl?: string | null;
    tags: { id: string; name: string; kind: string; icon?: string | null }[];
  };

  type TagOption = { id: string; name: string; kind: string; icon?: string | null };
  type PlaylistOption = { id: string; name: string };

  let {
    track,
    availableTags,
    queue = null,
    playlists = [],
    canDelete = false,
    ondeleted,
    onarchived,
    ontags,
  }: {
    track: TrackItem;
    availableTags: TagOption[];
    /** Personal catalogue queue — play / enqueue actions go through it. */
    queue?: CatalogQueueClient | null;
    /** Playlists this user can add tracks to. */
    playlists?: PlaylistOption[];
    /** Zap admins only; the server enforces it regardless. */
    canDelete?: boolean;
    ondeleted?: (id: string, message: string) => void;
    onarchived?: (id: string, message: string) => void;
    /** Fired after a successful tag save so the parent can update local row state. */
    ontags?: (id: string, tags: TrackItem["tags"]) => void;
  } = $props();

  let deleteOpen = $state(false);
  let disposing = $state(false);
  let editTagsOpen = $state(false);
  let scrubMs = $state<number | null>(null);

  let menuOpen = $state(false);
  let menuOpenUp = $state(false);
  let menuBtn = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let menuStyle = $state("");

  const unavailable = $derived(track.available === false);
  const isCurrent = $derived(Boolean(queue?.currentItem && queue.currentItem.mediaAssetId === track.id));
  const isPlaying = $derived(isCurrent && Boolean(queue?.playing));
  const durationMs = $derived(track.durationMs ?? queue?.currentItem?.durationMs ?? 0);

  async function confirmArchive() {
    disposing = true;
    const outcome = await archiveSongAsAdmin(track.id);
    disposing = false;
    deleteOpen = false;
    if (!outcome.ok) {
      toast.error(outcome.message);
      return;
    }
    if (onarchived) onarchived(track.id, outcome.message);
    else ondeleted?.(track.id, outcome.message);
  }

  async function confirmDelete() {
    disposing = true;
    const outcome = await deleteSongAsAdmin(track.id);
    disposing = false;
    deleteOpen = false;
    if (!outcome.ok) {
      toast.error(outcome.message);
      return;
    }
    ondeleted?.(track.id, outcome.message);
  }

  async function togglePlay() {
    if (!track.playable) {
      toast.error(unavailable ? "Song not available — no audio source yet." : "No audio file for this track.");
      return;
    }
    if (!queue) return;
    // Play now = insert after the playhead and jump to it (normal queue playback).
    if (isCurrent) await queue.togglePlay();
    else await queue.playNow(track.id);
    // queue client already toasts request failures
  }

  async function enqueue(mode: EnqueueMode) {
    menuOpen = false;
    if (!queue) return;
    await queue.enqueue([track.id], mode);
  }

  async function addToPlaylist(pl: PlaylistOption) {
    menuOpen = false;
    try {
      const res = await fetch(`/api/playlists/${pl.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addTrack", mediaAssetId: track.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Add failed");
      toast.success(`Added to “${pl.name}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
  }

  function toggleMenu() {
    if (menuOpen) {
      menuOpen = false;
      return;
    }
    if (!menuBtn) return;
    const rect = menuBtn.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    menuOpenUp = window.innerHeight - rect.bottom < 260 && rect.top > window.innerHeight - rect.bottom;
    menuStyle = menuOpenUp ? `right:${right}px;bottom:${window.innerHeight - rect.top + 4}px` : `right:${right}px;top:${rect.bottom + 4}px`;
    menuOpen = true;
  }

  $effect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuEl?.contains(t) || menuBtn?.contains(t)) return;
      menuOpen = false;
    };
    const close = () => (menuOpen = false);
    const id = window.setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  });
</script>

<li class={`zap-track group flex flex-col gap-2 py-1 sm:gap-3 sm:py-1.5 ${isCurrent ? "is-current" : ""}`}>
  <div class="flex items-start gap-2 sm:items-center sm:gap-4">
    <button
      type="button"
      class="zap-track-play flex size-8 shrink-0 items-center justify-center rounded border-2 border-border bg-transparent text-muted-foreground transition-[border-color,color,background] disabled:opacity-40 sm:size-10 {isCurrent
        ? ''
        : 'group-hover:border-signal group-hover:text-signal'}"
      disabled={!track.playable || !queue || (queue.pending > 0 && !isCurrent)}
      title={unavailable ? "Song not available" : isCurrent ? undefined : queue?.active ? "Play next (insert after current and skip to it)" : "Play"}
      aria-label={unavailable ? "Song not available" : isPlaying ? "Pause" : "Play"}
      onclick={togglePlay}
    >
      {#if isPlaying}
        <PauseIcon class="size-3.5 sm:size-4" />
      {:else}
        <PlayIcon class="size-3.5 sm:size-4" />
      {/if}
    </button>

    <div class="min-w-0 flex-1 space-y-1 sm:space-y-2">
      <div class="flex items-center justify-between gap-2 sm:gap-3">
        <div class="min-w-0 flex-1">
          <p
            class="zap-track-title truncate text-sm font-normal sm:text-base {isCurrent
              ? 'text-signal'
              : unavailable
                ? 'text-muted-foreground'
                : 'text-foreground group-hover:text-signal'}"
            title={track.title}
          >
            {track.title}
          </p>
          <p class="truncate font-mono text-[10px] text-muted-foreground sm:text-xs">
            {track.artists ?? "Unknown"} · {formatClock(track.durationMs)}
          </p>
          {#if unavailable}
            <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px]">
              <span class="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive">Song not available</span>
              {#if track.unavailableReason}<span class="text-muted-foreground">{track.unavailableReason}</span>{/if}
              {#if track.externalUrl}
                <a
                  class="text-muted-foreground underline-offset-2 hover:text-signal hover:underline"
                  href={track.externalUrl}
                  target="_blank"
                  rel="noreferrer">Source link</a
                >
              {:else}
                <span class="text-muted-foreground">URL not available</span>
              {/if}
            </p>
          {/if}
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-0.5 sm:max-w-[45%] sm:gap-1">
          {#each track.tags as tag}
            {#if tag.icon}
              <span class="hidden text-base leading-none sm:inline" title={tag.name} aria-label={tag.name}>{tag.icon}</span>
            {:else}
              <span class="zap-tag-chip hidden px-2 py-0.5 text-[10px] sm:inline-flex" title={tag.name} aria-label={tag.name}>{tag.name}</span>
            {/if}
          {/each}
          <button
            type="button"
            class="inline-flex size-5 shrink-0 items-center justify-center rounded text-signal hover:bg-white/80 hover:text-[#12100e] sm:size-6"
            aria-label={`Edit tags for ${track.title}`}
            title="Edit tags"
            onclick={() => (editTagsOpen = true)}
          >
            <TagsIcon class="size-3 sm:size-3.5" aria-hidden="true" />
          </button>
          {#if canDelete}
            <button
              type="button"
              class="inline-flex size-5 shrink-0 items-center justify-center rounded border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40 sm:size-6"
              aria-label={`Delete ${track.title}`}
              title="Delete song"
              disabled={disposing}
              onclick={() => (deleteOpen = true)}
            >
              <Trash2Icon class="size-3 shrink-0 sm:size-3.5" aria-hidden="true" />
            </button>
          {/if}
          {#if queue && track.playable}
            <button
              type="button"
              bind:this={menuBtn}
              class="inline-flex size-5 items-center justify-center rounded border border-border text-muted-foreground hover:bg-signal/10 hover:text-signal sm:size-6"
              aria-label={`More actions for ${track.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onclick={toggleMenu}
            >
              <EllipsisVerticalIcon class="size-3 sm:size-3.5" />
            </button>
          {/if}
        </div>
      </div>

      {#if track.tags.length}
        <div class="flex flex-wrap items-center gap-0.5 sm:hidden">
          {#each track.tags as tag}
            {#if tag.icon}
              <span class="text-base leading-none" title={tag.name} aria-label={tag.name}>{tag.icon}</span>
            {:else}
              <span class="zap-tag-chip px-1.5 py-0 text-[9px]" title={tag.name} aria-label={tag.name}>{tag.name}</span>
            {/if}
          {/each}
        </div>
      {/if}

      {#if isCurrent && queue}
        <div class="flex items-center gap-2">
          <span class="w-10 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(scrubMs ?? queue.positionMs)}</span>
          <SeekBar
            valueMs={queue.positionMs}
            {durationMs}
            ariaLabel={`Seek ${track.title}`}
            onseek={(ms) => void queue.seek(ms)}
            onscrub={(ms) => (scrubMs = ms)}
          />
          <span class="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(durationMs)}</span>
        </div>
      {/if}
    </div>
  </div>

  {#if menuOpen}
    <div bind:this={menuEl} class={`zap-dropdown fixed z-50 w-52 overflow-hidden py-1 ${menuOpenUp ? "is-up" : ""}`} style={menuStyle} role="menu">
      <button type="button" role="menuitem" class="zap-menu-item" onclick={() => void enqueue("next")}>
        <ListStartIcon class="size-3.5" /> Play next
      </button>
      <button type="button" role="menuitem" class="zap-menu-item" onclick={() => void enqueue("queue")}>
        <ListPlusIcon class="size-3.5" /> Add to queue
      </button>
      <button type="button" role="menuitem" class="zap-menu-item" onclick={() => void enqueue("last")}>
        <ListEndIcon class="size-3.5" /> Play last
      </button>
      {#if playlists.length}
        <p class="mt-1 border-t border-border/60 px-3 pt-2 pb-1 font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
          Add to playlist
        </p>
        <div class="max-h-40 overflow-y-auto">
          {#each playlists as pl (pl.id)}
            <button type="button" role="menuitem" class="zap-menu-item" onclick={() => void addToPlaylist(pl)}>
              <span class="truncate">{pl.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <EditTagsDialog
    bind:open={editTagsOpen}
    mediaAssetId={track.id}
    trackTitle={track.title}
    {availableTags}
    initialSelected={track.tags.map((t) => t.id)}
    onsaved={(tags) => ontags?.(track.id, tags)}
  />

  {#if canDelete}
    <SongDispositionDialog
      bind:open={deleteOpen}
      title={`Remove "${track.title}"?`}
      body={`Archive hides it from everyone except Admin → Songs (reversible). Delete permanently removes the catalogue row and storage object.`}
      busy={disposing}
      onarchive={confirmArchive}
      ondelete={confirmDelete}
    />
  {/if}
</li>
