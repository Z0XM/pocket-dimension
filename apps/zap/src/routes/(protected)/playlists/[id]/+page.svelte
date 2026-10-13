<script lang="ts">
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import ListBusyOverlay from "$lib/components/ListBusyOverlay.svelte";
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let playlist = $state(data.playlist);
  let busy = $state(false);
  let busyLabel = $state("Working…");
  let error = $state<string | null>(null);
  let buildTagIds = $state<string[]>([]);
  let collabQuery = $state("");
  let loadMsg = $state<string | null>(null);

  $effect(() => {
    playlist = data.playlist;
  });

  async function action(act: string, extra: Record<string, unknown> = {}) {
    busy = true;
    busyLabel = act === "buildFromTags" ? "Rebuilding from tags…" : act === "addCollaborator" ? "Inviting collaborator…" : "Updating playlist…";
    error = null;
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
      error = err instanceof Error ? err.message : "Action failed";
    } finally {
      busy = false;
    }
  }

  async function toggleVisibility() {
    busy = true;
    busyLabel = "Updating visibility…";
    error = null;
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
      error = err instanceof Error ? err.message : "Update failed";
    } finally {
      busy = false;
    }
  }

  async function loadIntoSession() {
    const sessionId = data.primaryLive?.id;
    if (!sessionId) {
      error = "No live session — resume or start one first.";
      return;
    }
    busy = true;
    busyLabel = "Loading into session…";
    error = null;
    loadMsg = null;
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/load`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Load failed");
      loadMsg = "Loaded into session queue.";
      window.location.href = `/session/${sessionId}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Load failed";
    } finally {
      busy = false;
    }
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p class="font-mono text-[10px] text-muted-foreground">
        <a href="/playlists" class="text-signal hover:underline">Playlists</a>
      </p>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight">{playlist.name}</h1>
      <p class="font-mono text-[10px] text-muted-foreground uppercase">{playlist.visibility} · {playlist.trackCount} tracks</p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#if data.primaryLive}
        <button
          type="button"
          class="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          disabled={busy || playlist.items.length === 0}
          onclick={() => void loadIntoSession()}
        >
          Add to live session
        </button>
      {:else if data.canStart}
        <span class="font-mono text-[10px] text-muted-foreground self-center">Start a session to queue this playlist</span>
      {/if}
      {#if playlist.canEdit && playlist.ownerUserId === data.playlist.ownerUserId}
        <button
          type="button"
          class="rounded border border-border px-2 py-1 font-mono text-[10px]"
          disabled={busy}
          onclick={() => void toggleVisibility()}
        >
          Make {playlist.visibility === "public" ? "private" : "public"}
        </button>
      {/if}
    </div>
  </div>

  {#if busy}
    <BusyStatus label={busyLabel} />
  {/if}
  {#if error}
    <p class="auth-error">{error}</p>
  {/if}
  {#if loadMsg}
    <p class="text-sm text-signal">{loadMsg}</p>
  {/if}

  {#if playlist.canEdit}
    <div class="space-y-3 rounded-lg border border-border/70 bg-card/40 p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Build from tags (AND)</p>
      <div class="flex flex-wrap gap-2">
        {#each data.availableTags as tag}
          <button
            type="button"
            class={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
              buildTagIds.includes(tag.id) ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
            onclick={() => {
              buildTagIds = buildTagIds.includes(tag.id) ? buildTagIds.filter((t) => t !== tag.id) : [...buildTagIds, tag.id];
            }}
          >
            {tag.name}
          </button>
        {/each}
      </div>
      <button
        type="button"
        class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
        disabled={busy || buildTagIds.length === 0}
        onclick={() => void action("buildFromTags", { tagIds: buildTagIds })}
      >
        Rebuild from tags
      </button>

      <div class="border-t border-border/50 pt-3">
        <p class="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Add collaborator</p>
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
      </div>
    </div>
  {/if}

  {#if playlist.collaborators.length}
    <ul class="font-mono text-[11px] text-muted-foreground">
      {#each playlist.collaborators as c}
        <li>{c.displayName} · {c.role}</li>
      {/each}
    </ul>
  {/if}

  <div>
    <p class="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Tracks</p>
    {#if busy && playlist.items.length === 0 && busyLabel.startsWith("Rebuild")}
      <TrackListSkeleton rows={4} compact />
    {:else if playlist.items.length === 0}
      <p class="text-sm text-muted-foreground">Empty — build from tags above.</p>
    {:else}
      <ListBusyOverlay {busy} label={busyLabel}>
        <ul class="max-h-[28rem] min-h-[6rem] space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-card/30 p-2">
          {#each playlist.items as item}
            <li class="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary/40">
              <span class="min-w-0 truncate">
                {item.title}
                <span class="font-mono text-[10px] text-muted-foreground"> · {item.artists ?? "—"}</span>
              </span>
              {#if playlist.canEdit}
                <span class="flex shrink-0 gap-1">
                  <button
                    type="button"
                    class="font-mono text-[10px] text-muted-foreground hover:text-signal"
                    disabled={busy}
                    onclick={() => void action("exclude", { mediaAssetId: item.mediaAssetId, excluded: true })}
                  >
                    exclude
                  </button>
                  <button
                    type="button"
                    class="font-mono text-[10px] text-destructive"
                    disabled={busy}
                    onclick={() => void action("removeTrack", { mediaAssetId: item.mediaAssetId })}
                  >
                    remove
                  </button>
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </ListBusyOverlay>
    {/if}
  </div>

  {#if playlist.exclusions.length}
    <div>
      <p class="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Excluded from tag rebuilds</p>
      <ul class="space-y-1 font-mono text-[11px]">
        {#each playlist.exclusions as ex}
          <li class="flex justify-between gap-2">
            <span>{ex.title}</span>
            {#if playlist.canEdit}
              <button
                type="button"
                class="text-signal"
                disabled={busy}
                onclick={() => void action("exclude", { mediaAssetId: ex.mediaAssetId, excluded: false })}
              >
                restore
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
