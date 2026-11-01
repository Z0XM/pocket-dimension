<script lang="ts">
  import { goto } from "$app/navigation";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RadioIcon from "@lucide/svelte/icons/radio";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import XIcon from "@lucide/svelte/icons/x";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import TagQueryEditor from "$lib/components/TagQueryEditor.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import { moveItem } from "$lib/catalog-queue";
  import { getCatalogQueue } from "$lib/catalog-queue-client.svelte";
  import { playlistRelationBadge } from "$lib/playlist-relation-label";
  import { PLAYLIST_TRACK_SORT_OPTIONS, type PlaylistTrackSort } from "$lib/playlist-sort";
  import { effectiveTagQuery, tagFilterKey, tagQueryProblem } from "$lib/tag-filter";
  import { toast } from "$lib/toast.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let playlist = $state(data.playlist);
  let busy = $state(false);
  let busyLabel = $state("Working…");
  let editTagQuery = $state("");
  let editTagIds = $state<string[]>([]);
  let collabQuery = $state("");
  let renameValue = $state("");
  let deleteOpen = $state(false);
  let deleting = $state(false);
  let sortBusy = $state(false);
  let dragFrom = $state<number | null>(null);
  let dragOver = $state<number | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let replaceOpen = $state(false);
  let replaceBusy = $state(false);
  let pendingReplaceIds = $state<string[] | null>(null);

  const queue = getCatalogQueue();
  const hasPlayable = $derived(playlist.items.some((i) => i.playable));
  const canReorder = $derived(playlist.canEdit);
  const relationBadge = $derived(playlistRelationBadge(playlist.relation, playlist.kind));
  const replaceConfirmBody = $derived(
    `Your current queue of ${queue?.items.length ?? 0} song${(queue?.items.length ?? 0) === 1 ? "" : "s"} will be closed, and this queue will be started.`
  );

  async function runReplace(mediaAssetIds: string[]) {
    if (!queue) return;
    replaceBusy = true;
    try {
      await queue.replaceTracks(mediaAssetIds, { play: true });
    } finally {
      replaceBusy = false;
      replaceOpen = false;
      pendingReplaceIds = null;
    }
  }

  async function playPlaylistFrom(startMediaAssetId?: string) {
    if (!queue) return;
    const ids = playlist.items.filter((i) => i.playable).map((i) => i.mediaAssetId);
    if (ids.length === 0) return;
    let ordered = ids;
    if (startMediaAssetId) {
      const idx = ids.indexOf(startMediaAssetId);
      if (idx >= 0) ordered = ids.slice(idx);
    }
    if (queue.needsReplaceConfirm) {
      pendingReplaceIds = ordered;
      replaceOpen = true;
      return;
    }
    await runReplace(ordered);
  }

  async function queuePlaylist(mode: "replace" | "last") {
    if (!queue) return;
    if (mode === "replace") {
      await playPlaylistFrom();
      return;
    }
    await queue.enqueuePlaylist(playlist.id, mode);
  }

  $effect(() => {
    playlist = data.playlist;
    renameValue = data.playlist.name;
  });

  const savedTagQuery = $derived(playlist.tagQuery ?? "");

  $effect(() => {
    editTagQuery = savedTagQuery;
    editTagIds = [];
  });

  const editProblem = $derived(tagQueryProblem(editTagQuery, data.availableTags));
  const editEffective = $derived(effectiveTagQuery({ tagQuery: editTagQuery, tagIds: editTagIds }, data.availableTags));
  const editUnchanged = $derived(
    Boolean(playlist.tagQuery) &&
      tagFilterKey({ tagQuery: editEffective }, data.availableTags) === tagFilterKey({ tagQuery: playlist.tagQuery }, data.availableTags)
  );

  async function action(act: string, extra: Record<string, unknown> = {}) {
    busy = true;
    busyLabel =
      act === "setTagQuery" && extra.tagQuery
        ? "Rebuilding from tags…"
        : act === "addCollaborator"
          ? "Inviting collaborator…"
          : act === "reorder"
            ? "Reordering…"
            : act === "sort"
              ? "Sorting…"
              : "Updating playlist…";
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Action failed");
      playlist = body;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      busy = false;
    }
  }

  function startReorder(e: PointerEvent, index: number) {
    if (!canReorder || busy || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFrom = index;
    dragOver = index;
  }

  function moveReorder(e: PointerEvent) {
    if (dragFrom == null) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-pi]");
    if (row?.dataset.pi) dragOver = Number(row.dataset.pi);
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
    if (from == null || to == null || from === to || busy) return;
    void action("reorder", {
      orderedItemIds: moveItem(
        playlist.items.map((i) => i.id),
        from,
        to
      ),
    });
  }

  function keyReorder(e: KeyboardEvent, index: number) {
    if (!canReorder || busy) return;
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const to = index + delta;
    if (to < 0 || to >= playlist.items.length) return;
    void action("reorder", {
      orderedItemIds: moveItem(
        playlist.items.map((i) => i.id),
        index,
        to
      ),
    });
  }

  async function applySort(sort: PlaylistTrackSort) {
    if (!canReorder || busy || sortBusy) return;
    sortBusy = true;
    try {
      await action("sort", { sort });
    } finally {
      sortBusy = false;
    }
  }

  async function toggleVisibility() {
    busy = true;
    busyLabel = "Updating visibility…";
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: playlist.visibility === "public" ? "private" : "public" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Update failed");
      playlist = body;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      busy = false;
    }
  }

  async function saveRename() {
    const name = renameValue.trim();
    if (!name || !playlist.canRename || busy || name === playlist.name) return;
    busy = true;
    busyLabel = "Renaming…";
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Rename failed");
      playlist = body;
      renameValue = body.name;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      busy = false;
    }
  }

  async function copyShareCode() {
    if (!playlist.shareCode) return;
    try {
      await navigator.clipboard.writeText(playlist.shareCode);
      toast.success("Share code copied");
    } catch {
      toast.info(playlist.shareCode);
    }
  }

  async function unfollow() {
    busy = true;
    busyLabel = "Unfollowing…";
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unfollow" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Unfollow failed");
      await goto("/playlists", { invalidateAll: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unfollow failed");
    } finally {
      busy = false;
    }
  }

  async function deletePlaylist() {
    deleting = true;
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(body?.message ?? "Delete failed");
      deleteOpen = false;
      await goto("/playlists", { invalidateAll: true });
    } catch (err) {
      deleteOpen = false;
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      deleting = false;
    }
  }

  async function loadIntoSession() {
    const sessionId = data.primaryLive?.id;
    if (!sessionId) {
      toast.info("No live session — resume or start one first.");
      return;
    }
    busy = true;
    busyLabel = "Loading into session…";
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/load`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Load failed");
      toast.success("Loaded into session queue.");
      window.location.href = `/session/${sessionId}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      busy = false;
    }
  }
</script>

<section class="zap-page">
  <PageHeader title={playlist.name}>
    {#snippet crumb()}
      <a href="/playlists" class="inline-flex items-center gap-1 text-signal hover:underline">
        <ArrowLeftIcon class="size-3" aria-hidden="true" />
        Playlists
      </a>
    {/snippet}
    {#snippet meta()}
      {playlist.visibility} · {playlist.trackCount} tracks
      {#if relationBadge}
        · {relationBadge}{/if}
      {#if playlist.tagQuery && !playlist.canEdit}
        · tags: <span class="text-signal normal-case tracking-normal">{playlist.tagQuery}</span>
      {/if}
    {/snippet}
    {#snippet actions()}
      {#if queue}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-3 py-1.5 text-xs font-medium text-signal hover:bg-signal/20 disabled:opacity-40"
          disabled={busy || !hasPlayable || queue.pending > 0}
          title="Replace your queue with this playlist and play"
          onclick={() => void queuePlaylist("replace")}
        >
          <PlayIcon class="size-3.5" aria-hidden="true" />
          Play
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-signal disabled:opacity-40"
          disabled={busy || !hasPlayable || queue.pending > 0}
          title="Append this playlist to your queue"
          onclick={() => void queuePlaylist("last")}
        >
          <ListEndIcon class="size-3.5" aria-hidden="true" />
          Queue
        </button>
      {/if}
      {#if data.primaryLive}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          disabled={busy || playlist.items.length === 0}
          onclick={() => void loadIntoSession()}
        >
          <RadioIcon class="size-3.5" aria-hidden="true" />
          Live session
        </button>
      {:else if data.canStart}
        <span class="font-mono text-[10px] text-muted-foreground self-center">Start a session to queue</span>
      {/if}
      {#if playlist.shareCode}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-signal disabled:opacity-40"
          disabled={busy}
          title={playlist.visibility === "private"
            ? "Share code (make public before others can follow)"
            : "Copy share code for others to follow"}
          onclick={() => void copyShareCode()}
        >
          <CopyIcon class="size-3.5" aria-hidden="true" />
          {playlist.shareCode}
        </button>
      {/if}
      {#if playlist.relation === "follower"}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-40"
          disabled={busy}
          onclick={() => void unfollow()}
        >
          <UserMinusIcon class="size-3.5" aria-hidden="true" />
          Unfollow
        </button>
      {/if}
      {#if playlist.canDelete && playlist.kind !== "linked"}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-signal/50 hover:bg-signal/10 hover:text-signal disabled:opacity-40"
          disabled={busy}
          title={playlist.visibility === "public" ? "Make private" : "Make public"}
          onclick={() => void toggleVisibility()}
        >
          {#if playlist.visibility === "public"}
            <EyeOffIcon class="size-3.5" aria-hidden="true" />
            Make private
          {:else}
            <EyeIcon class="size-3.5" aria-hidden="true" />
            Make public
          {/if}
        </button>
      {/if}
      {#if playlist.canDelete}
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 font-mono text-[10px] text-destructive hover:bg-destructive/10 disabled:opacity-40"
          disabled={busy || deleting}
          aria-label="Delete playlist"
          title="Delete playlist"
          onclick={() => (deleteOpen = true)}
        >
          <Trash2Icon class="size-3.5" aria-hidden="true" />
        </button>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">

  {#if busy}
    <BusyStatus label={busyLabel} />
  {/if}
  {#if playlist.canRename}
    <form
      class="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-4 sm:flex-row sm:items-end"
      onsubmit={(e) => {
        e.preventDefault();
        void saveRename();
      }}
    >
      <label class="min-w-0 flex-1 space-y-1">
        <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Name</span>
        <input class="auth-field" bind:value={renameValue} maxlength="80" />
      </label>
      <button
        type="submit"
        class="rounded border border-border px-3 py-2 font-mono text-[11px] disabled:opacity-40"
        disabled={busy || !renameValue.trim() || renameValue.trim() === playlist.name}
      >
        Save name
      </button>
    </form>
  {/if}

  {#if playlist.kind === "linked"}
    <div class="rounded-lg border border-border/70 bg-card p-4">
      <p class="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Linked sources</p>
      <p class="mb-2 font-mono text-[10px] text-muted-foreground">Tracks refresh automatically when sources gain songs. Manual adds are disabled.</p>
      {#if playlist.sources?.length}
        <ul class="space-y-1 font-mono text-[11px] text-muted-foreground">
          {#each playlist.sources as src}
            <li>
              <a href={`/playlists/${src.id}`} class="hover:text-signal">{src.name}</a>
              {#if src.shareCode}<span class="ml-1 opacity-70">· {src.shareCode}</span>{/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-sm text-muted-foreground">No sources.</p>
      {/if}
    </div>
  {/if}

  {#if playlist.canEdit}
    <div class="space-y-3 rounded-lg border border-border/70 bg-card p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Build from tags</p>
        {#if playlist.tagQuery}
          <p class="font-mono text-[10px] text-muted-foreground">saved: <span class="text-signal">{playlist.tagQuery}</span></p>
        {/if}
      </div>
      <TagQueryEditor
        compact
        bind:tagQuery={editTagQuery}
        bind:selectedTagIds={editTagIds}
        availableTags={data.availableTags}
        topTagIds={data.topTagIds}
        tagQueryError={editProblem}
      />
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
          disabled={busy || !editEffective || Boolean(editProblem)}
          onclick={() => void action("setTagQuery", { tagQuery: editEffective })}
        >
          {editUnchanged ? "Rebuild from tags" : "Save & rebuild"}
        </button>
        {#if playlist.tagQuery}
          <button
            type="button"
            class="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-signal disabled:opacity-40"
            disabled={busy}
            title="Keep current tracks, stop treating this as a tag playlist"
            onclick={() => void action("setTagQuery", { tagQuery: null })}
          >
            Clear tag query
          </button>
        {/if}
        <span class="font-mono text-[10px] text-muted-foreground">Uses your tags; removed tracks stay out of rebuilds.</span>
      </div>
    </div>
  {/if}

  {#if playlist.canDelete}
    <div class="rounded-lg border border-border/70 bg-card p-4">
      <p class="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        {playlist.kind === "linked" ? "Add member" : "Add collaborator"}
      </p>
      <div class="flex gap-2">
        <input class="auth-field flex-1" bind:value={collabQuery} placeholder="email or username" />
        <button
          type="button"
          class="rounded border border-border px-2 py-1 font-mono text-[10px] disabled:opacity-40"
          disabled={busy || !collabQuery.trim()}
          onclick={() => void action("addCollaborator", { collaborator: collabQuery.trim() })}
        >
          Invite
        </button>
      </div>
      {#if playlist.kind === "linked"}
        <p class="mt-2 font-mono text-[10px] text-muted-foreground">Members can play and rename; tracks stay source-driven.</p>
      {:else}
        <p class="mt-2 font-mono text-[10px] text-muted-foreground">Collaborators can edit tracks. Following is separate (share code).</p>
      {/if}
    </div>
  {/if}

  {#if playlist.collaborators.length}
    <ul class="font-mono text-[11px] text-muted-foreground">
      {#each playlist.collaborators as c}
        <li>{c.displayName} · {playlist.kind === "linked" && c.role === "collaborator" ? "member" : c.role}</li>
      {/each}
    </ul>
  {/if}
  <div>
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Tracks</p>
      {#if playlist.canEdit && playlist.items.length > 1}
        <label class="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span class="uppercase tracking-[0.12em]">Sort</span>
          <select
            class="rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground disabled:opacity-40"
            disabled={busy || sortBusy}
            value=""
            onchange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value as PlaylistTrackSort | "";
              (e.currentTarget as HTMLSelectElement).value = "";
              if (v) void applySort(v);
            }}
          >
            <option value="" disabled>Choose…</option>
            {#each PLAYLIST_TRACK_SORT_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
    {#if playlist.canEdit && playlist.tagQuery && playlist.items.length > 1}
      <p class="mb-2 font-mono text-[10px] text-muted-foreground">
        Sort & drag save order until the next tag rebuild.
      </p>
    {/if}
    {#if busy && playlist.items.length === 0 && busyLabel.startsWith("Rebuild")}
      <TrackListSkeleton rows={4} compact />
    {:else if playlist.items.length === 0}
      <p class="text-sm text-muted-foreground">
        Empty{#if playlist.kind === "linked"}
          — waiting for tracks from linked sources{:else if playlist.canEdit}
          — build from tags above{/if}.
      </p>
    {:else}
      <ListBusyOverlay {busy} label={busyLabel}>
        <ul
          bind:this={listEl}
          class="max-h-[28rem] min-h-[6rem] space-y-0 overflow-y-auto rounded-lg border border-border/70 bg-card py-1"
          aria-label="Playlist tracks"
        >
          {#each playlist.items as item, index (item.id)}
            <li
              data-pi={index}
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
                  disabled={busy}
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
              <span class="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
              <button
                type="button"
                class="min-w-0 flex-1 truncate px-1 py-1.5 text-left text-sm hover:text-signal disabled:opacity-40"
                disabled={busy || !item.playable || !queue || (queue.pending > 0 && !queue.needsReplaceConfirm)}
                title={item.playable ? `Play from “${item.title}”` : "Not playable"}
                onclick={() => void playPlaylistFrom(item.mediaAssetId)}
              >
                {item.title}
                <span class="font-mono text-[10px] text-muted-foreground"> · {item.artists ?? "—"}</span>
              </button>
              {#if playlist.canEdit}
                <button
                  type="button"
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded text-destructive opacity-70 hover:bg-destructive/10 hover:opacity-100 disabled:opacity-40"
                  disabled={busy}
                  aria-label={`Remove ${item.title}`}
                  title="Remove"
                  onclick={() => void action("exclude", { mediaAssetId: item.mediaAssetId, excluded: true })}
                >
                  <XIcon class="size-3.5" aria-hidden="true" />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      </ListBusyOverlay>
    {/if}
  </div>

  {#if playlist.exclusions.length}
    <div>
      <p class="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Added in the past</p>
      <ul class="space-y-1 rounded-lg border border-border/50 bg-card py-1 font-mono text-[11px]">
        {#each playlist.exclusions as ex}
          <li class="flex items-center justify-between gap-2 px-2 py-1">
            <span class="min-w-0 truncate text-muted-foreground">{ex.title}</span>
            {#if playlist.canEdit}
              <button
                type="button"
                class="inline-flex items-center gap-1 text-signal hover:underline disabled:opacity-40"
                disabled={busy}
                title="Restore to playlist"
                onclick={() => void action("exclude", { mediaAssetId: ex.mediaAssetId, excluded: false })}
              >
                <RotateCcwIcon class="size-3" aria-hidden="true" />
                Restore
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  </div>
</section>

<ConfirmDialog
  bind:open={replaceOpen}
  title="Replace your queue?"
  body={replaceConfirmBody}
  confirmLabel="Start this queue"
  busy={replaceBusy}
  onconfirm={() => {
    if (pendingReplaceIds) void runReplace(pendingReplaceIds);
  }}
/>

<ConfirmDialog
  bind:open={deleteOpen}
  title="Delete playlist?"
  body={`“${playlist.name}” (${playlist.trackCount} track${playlist.trackCount === 1 ? "" : "s"}) will be deleted for you and any collaborators. The tracks stay in the catalogue and in your queue.`}
  confirmLabel="Delete playlist"
  danger
  busy={deleting}
  onconfirm={deletePlaylist}
/>
