<script lang="ts">
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let playlists = $state(data.playlists ?? []);
  let busy = $state(false);
  let busyLabel = $state("Working…");
  let error = $state<string | null>(null);
  let newName = $state("");
  let mergeIds = $state<string[]>([]);

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
    if (!newName.trim() || busy) return;
    busy = true;
    busyLabel = "Creating playlist…";
    error = null;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
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
    <p class="mt-1 text-sm text-muted-foreground">
      Zap-native playlists (owned / collab). Session snapshots live below as <span class="font-mono text-signal">saved queues</span> — a separate concept.
    </p>
  </div>

  <div class="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/50 p-4 sm:flex-row sm:items-end">
    <label class="flex-1 space-y-1">
      <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">New playlist</span>
      <input class="auth-field" bind:value={newName} placeholder="Name…" maxlength="80" />
    </label>
    <button
      type="button"
      class="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
      disabled={busy || !newName.trim()}
      onclick={() => void create()}
    >
      {busy && busyLabel.startsWith("Creating") ? "Creating…" : "Create"}
    </button>
  </div>

  {#if busy}
    <BusyStatus label={busyLabel} />
  {/if}
  {#if error}
    <p class="auth-error">{error}</p>
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
                >{pl.trackCount} · {pl.visibility}{#if !pl.canEdit}
                  · collab{/if}</span
              >
            </a>
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
