<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import TagQueryEditor from "$lib/components/TagQueryEditor.svelte";
  import { effectiveTagQuery, tagQueryProblem } from "$lib/tag-filter";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let playlists = $state(data.playlists ?? []);
  let busy = $state(false);
  let busyLabel = $state("Working…");
  let error = $state<string | null>(null);
  let newName = $state("");
  let newTagsOpen = $state(false);
  let newTagQuery = $state("");
  let newTagIds = $state<string[]>([]);
  let mergeIds = $state<string[]>([]);
  let deleteTarget = $state<{ id: string; name: string; trackCount: number } | null>(null);
  let deleteOpen = $state(false);
  let deleting = $state(false);
  let deletedMessage = $state<string | null>(null);

  const newTagQueryProblem = $derived(newTagsOpen ? tagQueryProblem(newTagQuery, data.availableTags) : null);
  const newEffectiveTagQuery = $derived(newTagsOpen ? effectiveTagQuery({ tagQuery: newTagQuery, tagIds: newTagIds }, data.availableTags) : "");

  $effect(() => {
    playlists = data.playlists ?? [];
  });

  async function refresh() {
    const res = await fetch("/api/playlists", { credentials: "same-origin" });
    if (!res.ok) return;
    const body = await res.json();
    playlists = body.playlists ?? [];
  }

  async function create() {
    if (!newName.trim() || busy || newTagQueryProblem) return;
    busy = true;
    busyLabel = "Creating playlist…";
    error = null;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), tagQuery: newEffectiveTagQuery || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Create failed");
      newName = "";
      await refresh();
      window.location.href = `/playlists/${body.id}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Create failed";
    } finally {
      busy = false;
    }
  }

  function toggleMerge(id: string) {
    mergeIds = mergeIds.includes(id) ? mergeIds.filter((x) => x !== id) : [...mergeIds, id];
  }

  function askDelete(pl: { id: string; name: string; trackCount: number }) {
    deleteTarget = pl;
    deletedMessage = null;
    deleteOpen = true;
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    deleting = true;
    error = null;
    try {
      const res = await fetch(`/api/playlists/${target.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(body?.message ?? "Delete failed");
      playlists = playlists.filter((p) => p.id !== target.id);
      mergeIds = mergeIds.filter((id) => id !== target.id);
      deletedMessage = `Deleted “${target.name}”.`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Delete failed";
    } finally {
      deleting = false;
      deleteOpen = false;
      deleteTarget = null;
    }
  }

  async function mergeSelected() {
    if (mergeIds.length < 2 || busy) return;
    busy = true;
    busyLabel = "Merging playlists…";
    error = null;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          name: `Merge ${new Date().toLocaleDateString()}`,
          sourcePlaylistIds: mergeIds,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Merge failed");
      mergeIds = [];
      window.location.href = `/playlists/${body.id}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Merge failed";
    } finally {
      busy = false;
    }
  }
</script>

<section class="space-y-8">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">Playlists</h1>
  </div>

  <form
    class="space-y-3 rounded-lg border border-border/70 bg-card/50 p-4"
    onsubmit={(e) => {
      e.preventDefault();
      void create();
    }}
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label class="flex-1 space-y-1">
        <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">New playlist</span>
        <input class="auth-field" bind:value={newName} placeholder="Name…" maxlength="80" />
      </label>
      <button
        type="button"
        class={`inline-flex items-center justify-center gap-1 rounded border px-3 py-2 font-mono text-[11px] ${
          newTagsOpen ? "border-signal/50 text-signal" : "border-border text-muted-foreground hover:text-signal"
        }`}
        aria-expanded={newTagsOpen}
        onclick={() => (newTagsOpen = !newTagsOpen)}
      >
        From tags
        <ChevronDownIcon class={`size-3 transition ${newTagsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <button
        type="submit"
        class="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
        disabled={busy || !newName.trim() || Boolean(newTagQueryProblem)}
      >
        {busy && busyLabel.startsWith("Creating") ? "Creating…" : "Create"}
      </button>
    </div>
    {#if newTagsOpen}
      <div class="border-t border-border/50 pt-3">
        <TagQueryEditor
          compact
          bind:tagQuery={newTagQuery}
          bind:selectedTagIds={newTagIds}
          availableTags={data.availableTags}
          topTagIds={data.topTagIds}
          tagQueryError={newTagQueryProblem}
        />
        <p class="mt-2 font-mono text-[10px] text-muted-foreground">
          {#if newEffectiveTagQuery}
            Fills the playlist with your tracks matching <span class="text-signal">{newEffectiveTagQuery}</span>; rebuild any time from the playlist
            page.
          {:else}
            Optional — leave empty for a freehand playlist: add tracks from the catalogue (⋮ → Add to playlist) or save a queue.
          {/if}
        </p>
      </div>
    {/if}
  </form>

  {#if busy}
    <BusyStatus label={busyLabel} />
  {/if}
  {#if error}
    <p class="auth-error">{error}</p>
  {/if}
  {#if deletedMessage}
    <p class="text-sm text-signal">{deletedMessage}</p>
  {/if}

  <div class="space-y-2">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Zap playlists</h2>
    {#if playlists.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No playlists yet.</p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each playlists as pl (pl.id)}
          <li class="flex items-center gap-2 px-3 py-2.5">
            <input
              class="zap-checkbox"
              type="checkbox"
              checked={mergeIds.includes(pl.id)}
              onchange={() => toggleMerge(pl.id)}
              title="Select for merge"
            />
            <a href={`/playlists/${pl.id}`} class="min-w-0 flex-1 text-sm hover:text-signal">
              <span class="font-medium">{pl.name}</span>
              <span class="ml-2 font-mono text-[10px] text-muted-foreground"
                >{pl.trackCount} · {pl.visibility}{#if !pl.tagQuery}
                  · freehand{/if}{#if !pl.canEdit}
                  · collab{/if}</span
              >
              {#if pl.tagQuery}
                <span class="mt-0.5 block truncate font-mono text-[10px] text-signal/80" title={pl.tagQuery}>tags: {pl.tagQuery}</span>
              {/if}
            </a>
            {#if pl.canDelete}
              <button
                type="button"
                class="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                aria-label={`Delete ${pl.name}`}
                title="Delete playlist"
                disabled={busy || deleting}
                onclick={() => askDelete(pl)}
              >
                <Trash2Icon class="size-3.5" aria-hidden="true" />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary/60 disabled:opacity-40"
        disabled={mergeIds.length < 2 || busy}
        onclick={() => void mergeSelected()}
      >
        Merge selected ({mergeIds.length})
      </button>
    {/if}
  </div>

  <div class="space-y-2 border-t border-border/50 pt-6">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Saved queues (session snapshots)</h2>
    <p class="text-xs text-muted-foreground">Frozen copies of a session queue — not the same as Zap playlists. Load them from a live session.</p>
    {#if !data.savedQueues?.length}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        None yet — use “Save for later” in a session.
      </p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.savedQueues as sq (sq.id)}
          <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p class="font-medium">{sq.name}</p>
              <p class="font-mono text-[11px] text-muted-foreground">{sq.trackCount} tracks · {sq.titles.slice(0, 3).join(", ")}</p>
            </div>
            {#if data.primaryLive}
              <a
                href={`/session/${data.primaryLive.id}`}
                class="rounded border border-signal/40 px-2 py-1 font-mono text-[10px] text-signal hover:bg-signal/10"
              >
                Open session to load
              </a>
            {:else if data.canStart}
              <span class="font-mono text-[10px] text-muted-foreground">Start a session to load</span>
            {:else}
              <span class="font-mono text-[10px] text-muted-foreground">Join/resume a session to load</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<ConfirmDialog
  bind:open={deleteOpen}
  title="Delete playlist?"
  body={deleteTarget
    ? `“${deleteTarget.name}” (${deleteTarget.trackCount} track${deleteTarget.trackCount === 1 ? "" : "s"}) will be deleted for you and any collaborators. The tracks stay in the catalogue and in your queue.`
    : ""}
  confirmLabel="Delete playlist"
  danger
  busy={deleting}
  onconfirm={confirmDelete}
/>
