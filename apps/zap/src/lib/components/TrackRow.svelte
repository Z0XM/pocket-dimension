<script lang="ts">
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import ListPlusIcon from "@lucide/svelte/icons/list-plus";
  import ListStartIcon from "@lucide/svelte/icons/list-start";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import CustomTagInput from "$lib/components/CustomTagInput.svelte";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import { deleteSongAsAdmin, SONG_DELETE_CONFIRM_BODY } from "$lib/admin-song-delete";
  import { formatClock, type EnqueueMode } from "$lib/catalog-queue";
  import type { CatalogQueueClient } from "$lib/catalog-queue-client.svelte";
  import { enhance } from "$app/forms";

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
    tags: { id: string; name: string; kind: string }[];
  };

  type TagOption = { id: string; name: string; kind: string };
  type PlaylistOption = { id: string; name: string };

  let {
    track,
    availableTags,
    queue = null,
    playlists = [],
    canDelete = false,
    ondeleted,
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
    /** Fired after a successful tag save so the parent can update local row state. */
    ontags?: (id: string, tags: TrackItem["tags"]) => void;
  } = $props();

  let deleteOpen = $state(false);
  let deleting = $state(false);
  let editing = $state(false);
  let editTagIds = $state<string[]>([]);
  let editCustomTags = $state<string[]>([]);
  let editCustomDraft = $state("");
  let tagFormEl = $state<HTMLFormElement | null>(null);
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);

  let menuOpen = $state(false);
  let menuBtn = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let menuStyle = $state("");

  const unavailable = $derived(track.available === false);
  const isCurrent = $derived(Boolean(queue?.currentItem && queue.currentItem.mediaAssetId === track.id));
  const isPlaying = $derived(isCurrent && Boolean(queue?.playing));
  const durationMs = $derived(track.durationMs ?? queue?.currentItem?.durationMs ?? 0);

  async function confirmDelete() {
    deleting = true;
    error = null;
    const outcome = await deleteSongAsAdmin(track.id);
    deleting = false;
    deleteOpen = false;
    if (!outcome.ok) {
      error = outcome.message;
      return;
    }
    ondeleted?.(track.id, outcome.message);
  }

  async function togglePlay() {
    error = null;
    if (!track.playable) {
      error = unavailable ? "Song not available — no audio source yet." : "No audio file for this track.";
      return;
    }
    if (!queue) return;
    // Play now = insert after the playhead and jump to it (normal queue playback).
    if (isCurrent) await queue.togglePlay();
    else await queue.playNow(track.id);
    if (queue.error) error = queue.error;
  }

  async function enqueue(mode: EnqueueMode) {
    menuOpen = false;
    if (!queue) return;
    error = null;
    await queue.enqueue([track.id], mode);
    if (queue.error) error = queue.error;
  }

  async function addToPlaylist(pl: PlaylistOption) {
    menuOpen = false;
    error = null;
    info = null;
    try {
      const res = await fetch(`/api/playlists/${pl.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addTrack", mediaAssetId: track.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Add failed");
      info = `Added to “${pl.name}”.`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Add failed";
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
    const openUp = window.innerHeight - rect.bottom < 260 && rect.top > window.innerHeight - rect.bottom;
    menuStyle = openUp ? `right:${right}px;bottom:${window.innerHeight - rect.top + 4}px` : `right:${right}px;top:${rect.bottom + 4}px`;
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

  function startEdit() {
    editing = true;
    editTagIds = track.tags.map((t) => t.id);
    editCustomTags = [];
    editCustomDraft = "";
  }
</script>

<li class={`zap-track flex flex-col gap-3 px-4 py-3 ${isCurrent ? "is-current" : ""}`}>
  <div class="flex items-start gap-3 sm:items-center sm:gap-4">
    <button
      type="button"
      class="zap-track-play flex size-10 shrink-0 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 disabled:opacity-40"
      disabled={!track.playable || !queue || (queue.pending > 0 && !isCurrent)}
      title={unavailable ? "Song not available" : isCurrent ? undefined : queue?.active ? "Play next (insert after current and skip to it)" : "Play"}
      aria-label={unavailable ? "Song not available" : isPlaying ? "Pause" : "Play"}
      onclick={togglePlay}
    >
      {#if isPlaying}
        <PauseIcon class="size-4" />
      {:else}
        <PlayIcon class="size-4" />
      {/if}
    </button>

    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div class="min-w-0 flex-1">
          <p
            class="zap-track-title truncate font-medium {isCurrent ? 'text-signal' : unavailable ? 'text-muted-foreground' : 'text-foreground'}"
            title={track.title}
          >
            {track.title}
          </p>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {track.artists ?? "Unknown"} · {formatClock(track.durationMs)} · {track.sourceType}
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
        <div class="flex shrink-0 flex-wrap items-center gap-1 sm:max-w-[45%] sm:justify-end">
          {#each track.tags as tag}
            <span class="zap-tag-chip px-2 py-0.5 text-[10px]">{tag.name}</span>
          {/each}
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-signal hover:bg-signal/10"
            onclick={() => (editing ? (editing = false) : startEdit())}
          >
            {editing ? "Cancel" : "Edit tags"}
          </button>
          {#if canDelete}
            <button
              type="button"
              class="inline-flex size-6 shrink-0 items-center justify-center rounded border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40"
              aria-label={`Delete ${track.title}`}
              title="Delete song"
              disabled={deleting}
              onclick={() => (deleteOpen = true)}
            >
              <Trash2Icon class="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          {/if}
          {#if queue && track.playable}
            <button
              type="button"
              bind:this={menuBtn}
              class="inline-flex size-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-signal/10 hover:text-signal"
              aria-label={`More actions for ${track.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onclick={toggleMenu}
            >
              <EllipsisVerticalIcon class="size-3.5" />
            </button>
          {/if}
        </div>
      </div>

      {#if isCurrent && queue}
        <div class="flex items-center gap-2">
          <span class="w-10 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(queue.positionMs)}</span>
          <input
            class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
            type="range"
            min="0"
            max={Math.max(durationMs / 1000, 1)}
            step="0.5"
            value={queue.positionMs / 1000}
            aria-label={`Seek ${track.title}`}
            onchange={(e) => void queue.seek(Number((e.currentTarget as HTMLInputElement).value) * 1000)}
          />
          <span class="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{formatClock(durationMs)}</span>
        </div>
      {/if}
      {#if error}
        <p class="font-mono text-[11px] text-destructive">{error}</p>
      {/if}
      {#if info}
        <p class="font-mono text-[11px] text-signal">{info}</p>
      {/if}
    </div>
  </div>

  {#if menuOpen}
    <div
      bind:this={menuEl}
      class="fixed z-50 w-52 overflow-hidden rounded border border-border bg-popover py-1 shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_12%,transparent)]"
      style={menuStyle}
      role="menu"
    >
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

  {#if editing}
    <form
      method="POST"
      action="?/setTags"
      class="space-y-2 rounded border border-border/60 bg-background/40 p-3"
      bind:this={tagFormEl}
      use:enhance={() => {
        return async ({ result, update }) => {
          // Keep local catalogue list; apply returned tags via ontags (invalidateAll would reload
          // data but catalogue hydration ignores tag-only changes).
          await update({ reset: false, invalidateAll: false });
          if (result.type !== "success") return;
          const data = result.data as { tagOk?: boolean; mediaAssetId?: string; tags?: TrackItem["tags"] } | undefined;
          if (data?.tagOk && Array.isArray(data.tags)) {
            ontags?.(track.id, data.tags);
          }
          editing = false;
        };
      }}
    >
      <input type="hidden" name="mediaAssetId" value={track.id} />
      <TagMultiSelect
        options={availableTags}
        bind:selected={editTagIds}
        name="tagIds"
        placeholder="Select tags…"
        onconfirm={() => tagFormEl?.requestSubmit()}
      />
      <CustomTagInput bind:tags={editCustomTags} bind:draft={editCustomDraft} name="customTags" />
      <button type="submit" class="auth-btn w-fit">Save tags</button>
    </form>
  {/if}

  {#if canDelete}
    <ConfirmDialog
      bind:open={deleteOpen}
      title={`Delete "${track.title}"?`}
      body={SONG_DELETE_CONFIRM_BODY}
      confirmLabel="Delete song"
      danger
      busy={deleting}
      onconfirm={confirmDelete}
    />
  {/if}
</li>
