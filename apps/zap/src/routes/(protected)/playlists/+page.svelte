<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import LinkIcon from "@lucide/svelte/icons/link";
  import MergeIcon from "@lucide/svelte/icons/merge";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TagsIcon from "@lucide/svelte/icons/tags";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import TagQueryEditor from "$lib/components/TagQueryEditor.svelte";
  import { playlistRelationBadge } from "$lib/playlist-relation-label";
  import { effectiveTagQuery, tagQueryProblem } from "$lib/tag-filter";
  import { toast } from "$lib/toast.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let playlists = $state(data.playlists ?? []);
  let busy = $state(false);
  let busyLabel = $state("Working…");
  let newName = $state("");
  let newTagsOpen = $state(false);
  let newTagQuery = $state("");
  let newTagIds = $state<string[]>([]);
  let mergeIds = $state<string[]>([]);
  let deleteTarget = $state<{ id: string; name: string; trackCount: number } | null>(null);
  let deleteOpen = $state(false);
  let deleting = $state(false);

  let followCode = $state("");
  let linkOpen = $state(false);
  let linkName = $state("");
  let linkCodeInput = $state("");
  let linkSources = $state<{ id: string; name: string; ownerUserId: string; shareCode: string | null }[]>([]);
  let linkMemberQuery = $state("");

  const newTagQueryProblem = $derived(newTagsOpen ? tagQueryProblem(newTagQuery, data.availableTags) : null);
  const newEffectiveTagQuery = $derived(newTagsOpen ? effectiveTagQuery({ tagQuery: newTagQuery, tagIds: newTagIds }, data.availableTags) : "");
  const mergeable = $derived(playlists.filter((p) => p.kind !== "linked" && p.canEdit));

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
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      busy = false;
    }
  }

  async function followByCode() {
    if (!followCode.trim() || busy) return;
    busy = true;
    busyLabel = "Following playlist…";
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "follow", shareCode: followCode.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Follow failed");
      followCode = "";
      window.location.href = `/playlists/${body.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Follow failed");
    } finally {
      busy = false;
    }
  }

  async function addLinkSource() {
    if (!linkCodeInput.trim() || busy) return;
    busy = true;
    busyLabel = "Looking up playlist…";
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookupShareCode", shareCode: linkCodeInput.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Lookup failed");
      if (linkSources.some((s) => s.id === body.id)) throw new Error("Already added");
      if (linkSources.some((s) => s.ownerUserId === body.ownerUserId)) {
        throw new Error("Sources must belong to different accounts");
      }
      const entered = linkCodeInput.trim().toUpperCase();
      linkSources = [
        ...linkSources,
        { id: body.id, name: body.name, ownerUserId: body.ownerUserId, shareCode: body.shareCode ?? entered },
      ];
      linkCodeInput = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      busy = false;
    }
  }

  async function createLinked() {
    if (!linkName.trim() || linkSources.length < 2 || busy) return;
    busy = true;
    busyLabel = "Creating linked playlist…";
    try {
      const members = linkMemberQuery
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createLinked",
          name: linkName.trim(),
          sourcePlaylistIds: linkSources.map((s) => s.id),
          memberQueries: members,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Create failed");
      linkName = "";
      linkSources = [];
      linkMemberQuery = "";
      linkOpen = false;
      window.location.href = `/playlists/${body.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      busy = false;
    }
  }

  function toggleMerge(id: string) {
    mergeIds = mergeIds.includes(id) ? mergeIds.filter((x) => x !== id) : [...mergeIds, id];
  }

  function askDelete(pl: { id: string; name: string; trackCount: number }) {
    deleteTarget = pl;
    deleteOpen = true;
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    deleting = true;
    try {
      const res = await fetch(`/api/playlists/${target.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(body?.message ?? "Delete failed");
      playlists = playlists.filter((p) => p.id !== target.id);
      mergeIds = mergeIds.filter((id) => id !== target.id);
      toast.success(`Deleted “${target.name}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
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
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally {
      busy = false;
    }
  }
</script>

<section class="zap-page">
  <PageHeader title="Playlists" />

  <form
    class="zap-filters-panel shrink-0 space-y-3 p-3"
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
        class={`inline-flex items-center justify-center gap-1.5 rounded border px-3 py-2 font-mono text-[11px] ${
          newTagsOpen ? "border-signal/50 text-signal" : "border-border text-muted-foreground hover:text-signal"
        }`}
        aria-expanded={newTagsOpen}
        onclick={() => (newTagsOpen = !newTagsOpen)}
      >
        <TagsIcon class="size-3.5" aria-hidden="true" />
        From tags
        <ChevronDownIcon class={`size-3 transition ${newTagsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <button
        type="submit"
        class="inline-flex items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
        disabled={busy || !newName.trim() || Boolean(newTagQueryProblem)}
      >
        <PlusIcon class="size-3.5" aria-hidden="true" />
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

  <form
    class="zap-filters-panel shrink-0 space-y-2 p-3"
    onsubmit={(e) => {
      e.preventDefault();
      void followByCode();
    }}
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label class="flex-1 space-y-1">
        <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Follow playlist</span>
        <input class="auth-field font-mono uppercase" bind:value={followCode} placeholder="Share code…" maxlength="12" />
      </label>
      <button
        type="submit"
        class="inline-flex items-center justify-center gap-1.5 rounded border border-signal/40 px-3 py-2 text-xs font-medium text-signal hover:bg-signal/10 disabled:opacity-40"
        disabled={busy || !followCode.trim()}
      >
        <UserPlusIcon class="size-3.5" aria-hidden="true" />
        Follow
      </button>
    </div>
    <p class="font-mono text-[10px] text-muted-foreground">Read-only in your list — play only. Collaborators still need an invite.</p>
  </form>

  <div class="zap-filters-panel shrink-0 space-y-3 p-3">
    <button
      type="button"
      class={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[11px] ${
        linkOpen ? "border-signal/50 text-signal" : "border-border text-muted-foreground hover:text-signal"
      }`}
      aria-expanded={linkOpen}
      onclick={() => (linkOpen = !linkOpen)}
    >
      <LinkIcon class="size-3.5" aria-hidden="true" />
      Linked playlist
      <ChevronDownIcon class={`size-3 transition ${linkOpen ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {#if linkOpen}
      <div class="space-y-3 border-t border-border/50 pt-3">
        <p class="font-mono text-[10px] text-muted-foreground">
          Combine public playlists from <span class="text-signal">different accounts</span>. Tracks update automatically from sources; no one
          can add songs by hand. Members can play and rename.
        </p>
        <label class="block space-y-1">
          <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Name</span>
          <input class="auth-field" bind:value={linkName} placeholder="Linked mix…" maxlength="80" />
        </label>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label class="flex-1 space-y-1">
            <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Source share code</span>
            <input class="auth-field font-mono uppercase" bind:value={linkCodeInput} placeholder="Code…" maxlength="12" />
          </label>
          <button
            type="button"
            class="rounded border border-border px-3 py-2 font-mono text-[11px] disabled:opacity-40"
            disabled={busy || !linkCodeInput.trim()}
            onclick={() => void addLinkSource()}
          >
            Add source
          </button>
        </div>
        {#if linkSources.length}
          <ul class="space-y-1 font-mono text-[11px] text-muted-foreground">
            {#each linkSources as src (src.id)}
              <li class="flex items-center justify-between gap-2">
                <span class="min-w-0 truncate">{src.name}{#if src.shareCode}
                    · {src.shareCode}{/if}</span
                >
                <button
                  type="button"
                  class="text-destructive hover:underline"
                  onclick={() => (linkSources = linkSources.filter((s) => s.id !== src.id))}
                >
                  Remove
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <label class="block space-y-1">
          <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Members (optional)</span>
          <input class="auth-field" bind:value={linkMemberQuery} placeholder="email or username, comma-separated" />
        </label>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
          disabled={busy || !linkName.trim() || linkSources.length < 2}
          onclick={() => void createLinked()}
        >
          <LinkIcon class="size-3.5" aria-hidden="true" />
          Create linked ({linkSources.length} sources)
        </button>
      </div>
    {/if}
  </div>

  <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
    {#if busy}
      <BusyStatus label={busyLabel} />
    {/if}
    <div class="space-y-2">
      <h2 class="zap-section-label font-mono text-[10px] tracking-[0.18em] uppercase">Zap playlists</h2>
      {#if playlists.length === 0}
        <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No playlists yet.</p>
      {:else}
        <ul class="zap-track-host divide-y divide-border/60">
          {#each playlists as pl (pl.id)}
            {@const badge = playlistRelationBadge(pl.relation, pl.kind)}
            <li class="flex items-center gap-2 px-3 py-2.5">
              {#if pl.kind !== "linked" && pl.canEdit}
                <input
                  class="zap-checkbox"
                  type="checkbox"
                  checked={mergeIds.includes(pl.id)}
                  onchange={() => toggleMerge(pl.id)}
                  title="Select for merge"
                />
              {:else}
                <span class="inline-block size-4 shrink-0" aria-hidden="true"></span>
              {/if}
              <a href={`/playlists/${pl.id}`} class="min-w-0 flex-1 text-sm hover:text-signal">
                <span class="font-medium">{pl.name}</span>
                <span class="ml-2 font-mono text-[10px] text-muted-foreground"
                  >{pl.trackCount} · {pl.visibility}{#if pl.kind === "standard" && !pl.tagQuery}
                    · freehand{/if}{#if badge}
                    · {badge}{/if}</span
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
          class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary/60 disabled:opacity-40"
          disabled={mergeIds.length < 2 || busy || mergeable.length < 2}
          onclick={() => void mergeSelected()}
        >
          <MergeIcon class="size-3.5" aria-hidden="true" />
          Merge selected ({mergeIds.length})
        </button>
      {/if}
    </div>

    <div class="space-y-2 border-t border-border/50 pt-4">
      <h2 class="zap-section-label font-mono text-[10px] tracking-[0.18em] uppercase">Saved queues</h2>
      {#if !data.savedQueues?.length}
        <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          None yet — use “Save for later” in a session.
        </p>
      {:else}
        <ul class="zap-track-host divide-y divide-border/60">
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
