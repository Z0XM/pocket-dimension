<script lang="ts">
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import ListVideoIcon from "@lucide/svelte/icons/list-video";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import SearchIcon from "@lucide/svelte/icons/search";
  import UnplugIcon from "@lucide/svelte/icons/unplug";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { youtubePlaylistHref } from "$lib/history-time";

  let {
    oauthConfigured,
    linked,
    linkedAt = null,
    activity = [],
    connectHref,
  }: {
    oauthConfigured: boolean;
    linked: boolean;
    linkedAt?: string | null;
    activity?: Array<{ id: string; kind: string; summary: string; at: string }>;
    connectHref: string;
  } = $props();

  type PlaylistRow = {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    itemCount: number | null;
    importStatus: "fully_imported" | "partially_imported" | "not_imported";
    alreadyImported: number;
    autoSync: boolean;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  };

  type Preview = {
    playlistId: string;
    title?: string;
    total: number;
    unavailable: number;
    alreadyImported: number;
    willImport: number;
    unavailableAmongNew: number;
    importStatus: string;
  };

  let playlists = $state<PlaylistRow[]>([]);
  let playlistQuery = $state("");
  let loadingPlaylists = $state(false);
  let listError = $state<string | null>(null);
  let busyId = $state<string | null>(null);
  let preview = $state<Preview | null>(null);
  let previewOpen = $state(false);
  let importBusy = $state(false);
  let importMessage = $state<string | null>(null);
  let disconnectOpen = $state(false);

  const filteredPlaylists = $derived.by(() => {
    const q = playlistQuery.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.title.toLowerCase().includes(q));
  });

  function when(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function statusLabel(s: PlaylistRow["importStatus"]) {
    if (s === "fully_imported") return "Fully imported";
    if (s === "partially_imported") return "Partially imported";
    return "Not imported";
  }

  async function loadPlaylists() {
    if (!linked) return;
    loadingPlaylists = true;
    listError = null;
    try {
      const res = await fetch("/api/connections/youtube/playlists", { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      playlists = body.playlists ?? [];
    } catch (err) {
      listError = err instanceof Error ? err.message : "Failed to load playlists";
    } finally {
      loadingPlaylists = false;
    }
  }

  async function toggleAutoSync(row: PlaylistRow, next: boolean) {
    busyId = row.id;
    listError = null;
    try {
      const res = await fetch(`/api/connections/youtube/playlists/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSync: next, title: row.title }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      playlists = playlists.map((p) => (p.id === row.id ? { ...p, autoSync: Boolean(body.autoSync) } : p));
    } catch (err) {
      listError = err instanceof Error ? err.message : "Could not update auto-sync";
    } finally {
      busyId = null;
    }
  }

  async function openImportPreview(row: PlaylistRow) {
    busyId = row.id;
    listError = null;
    importMessage = null;
    try {
      const qs = row.title ? `?title=${encodeURIComponent(row.title)}` : "";
      const res = await fetch(`/api/connections/youtube/playlists/${encodeURIComponent(row.id)}${qs}`, {
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Preview failed (${res.status})`);
      preview = { ...body.preview, title: body.preview?.title ?? row.title };
      previewOpen = true;
    } catch (err) {
      listError = err instanceof Error ? err.message : "Preview failed";
    } finally {
      busyId = null;
    }
  }

  async function confirmImport() {
    if (!preview) return;
    importBusy = true;
    importMessage = null;
    try {
      const res = await fetch("/api/youtube/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ playlistIds: [preview.playlistId], skipExisting: true, sort: "playlist" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Import failed (${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buf = "";
      let doneMsg: string | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Record<string, unknown>;
          if (ev.type === "done") {
            doneMsg = `Imported ${ev.imported ?? 0} · unavailable ${ev.unavailable ?? 0} · skipped ${ev.skipped ?? 0}`;
          } else if (ev.type === "error") {
            throw new Error(typeof ev.message === "string" ? ev.message : "Import failed");
          }
        }
      }
      importMessage = doneMsg ?? "Import finished";
      previewOpen = false;
      preview = null;
      await loadPlaylists();
    } catch (err) {
      listError = err instanceof Error ? err.message : "Import failed";
      previewOpen = false;
    } finally {
      importBusy = false;
    }
  }

  async function disconnect() {
    disconnectOpen = false;
    busyId = "__disconnect__";
    try {
      const res = await fetch("/api/me/youtube-link", { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error("Disconnect failed");
      window.location.href = "/connections?tab=youtube";
    } catch (err) {
      listError = err instanceof Error ? err.message : "Disconnect failed";
      busyId = null;
    }
  }

  $effect(() => {
    if (linked) void loadPlaylists();
  });
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-start justify-between gap-2">
    <div class="space-y-3 min-w-0 flex-1 border border-border/70 bg-card p-4">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Details</h2>
      {#if !oauthConfigured}
        <p class="text-sm text-muted-foreground">
          Set <span class="font-mono text-signal">GOOGLE_CLIENT_ID</span> and
          <span class="font-mono text-signal">GOOGLE_CLIENT_SECRET</span> to enable Connect YouTube.
        </p>
      {:else if !linked}
        <p class="flex items-center gap-2 text-sm text-muted-foreground">
          <ListVideoIcon class="size-4 shrink-0" aria-hidden="true" />
          Not connected
        </p>
        <a class="auth-btn inline-flex items-center gap-2" href={connectHref}>Connect YouTube</a>
      {:else}
        <p class="flex flex-wrap items-center gap-2 text-sm">
          <ListVideoIcon class="size-4 text-signal" aria-hidden="true" />
          Connected
          <span class="font-mono text-[11px] text-muted-foreground">since {when(linkedAt)}</span>
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-40"
          disabled={busyId !== null}
          onclick={() => (disconnectOpen = true)}
        >
          <UnplugIcon class="size-3.5" aria-hidden="true" />
          Disconnect
        </button>
      {/if}
    </div>
    {#if linked}
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center border border-border text-muted-foreground hover:border-signal/50 hover:text-signal disabled:opacity-40"
        aria-label="Refresh playlists"
        disabled={loadingPlaylists || busyId !== null}
        onclick={() => void loadPlaylists()}
      >
        <RefreshCwIcon class={`size-3.5 ${loadingPlaylists ? "animate-spin" : ""}`} aria-hidden="true" />
      </button>
    {/if}
  </div>

  {#if linked}
    <div class="space-y-3">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Playlists</h2>
      {#if listError}
        <p class="auth-error">{listError}</p>
      {/if}
      {#if importMessage}
        <p class="font-mono text-[11px] text-signal">{importMessage}</p>
      {/if}
      {#if loadingPlaylists && playlists.length === 0}
        <p class="font-mono text-[11px] text-muted-foreground">Loading playlists…</p>
      {:else if playlists.length === 0}
        <p class="font-mono text-[11px] text-muted-foreground">No playlists found.</p>
      {:else}
        <div class="relative min-w-0">
          <SearchIcon
            class="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            class="auth-field w-full pl-9"
            type="search"
            placeholder="Search playlists…"
            aria-label="Search playlists by name"
            bind:value={playlistQuery}
            autocomplete="off"
          />
        </div>
        {#if filteredPlaylists.length === 0}
          <p class="font-mono text-[11px] text-muted-foreground">No playlists match “{playlistQuery.trim()}”.</p>
        {:else}
          <ul class="divide-y divide-border/50 border border-border/70 bg-card">
            {#each filteredPlaylists as row (row.id)}
              <li class="space-y-2 px-3 py-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{row.title}</p>
                    <p class="font-mono text-[10px] text-muted-foreground">
                      {#if row.itemCount != null}
                        {row.itemCount} tracks
                        {#if row.alreadyImported > 0}
                          · {row.alreadyImported} in library{/if}
                        · {statusLabel(row.importStatus)}
                      {:else}
                        {statusLabel(row.importStatus)}
                        {#if row.alreadyImported > 0}
                          · {row.alreadyImported} in library{/if}
                      {/if}
                      {#if row.lastSyncedAt}
                        · synced {when(row.lastSyncedAt)}
                      {/if}
                    </p>
                    {#if row.lastSyncError}
                      <p class="font-mono text-[10px] text-destructive">{row.lastSyncError}</p>
                    {/if}
                  </div>
                  <a
                    class="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-signal"
                    href={youtubePlaylistHref(row.id)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open on YouTube"
                    title="Open on YouTube"
                  >
                    <ExternalLinkIcon class="size-3.5" aria-hidden="true" />
                  </a>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <label class="inline-flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <button
                      type="button"
                      class="zap-toggle"
                      role="switch"
                      aria-checked={row.autoSync}
                      aria-label={`Auto sync ${row.title}`}
                      disabled={busyId === row.id}
                      onclick={() => void toggleAutoSync(row, !row.autoSync)}
                    >
                      <span class="zap-toggle-thumb"></span>
                    </button>
                    Auto sync
                  </label>
                  <button
                    type="button"
                    class="auth-btn !px-2.5 !py-1"
                    disabled={busyId !== null || importBusy}
                    onclick={() => void openImportPreview(row)}
                  >
                    {busyId === row.id ? "…" : "Import"}
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
        <p class="font-mono text-[10px] text-muted-foreground">
          Import status is calculated when you open Import (preview). Auto sync runs when you open Zap (additive only —
          never removes songs).
        </p>
      {/if}
    </div>
  {/if}

  <div class="space-y-3">
    <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Activity</h2>
    {#if activity.length === 0}
      <p class="font-mono text-[11px] text-muted-foreground">No YouTube activity yet.</p>
    {:else}
      <ul class="divide-y divide-border/50 border border-border/70 bg-card">
        {#each activity as entry (entry.id)}
          <li class="px-3 py-2.5">
            <p class="text-sm text-foreground">{entry.summary}</p>
            <p class="mt-0.5 font-mono text-[10px] text-muted-foreground">{entry.kind} · {when(entry.at)}</p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<ConfirmDialog
  bind:open={previewOpen}
  title="Import preview"
  confirmLabel={importBusy ? "Importing…" : "Import new tracks"}
  busy={importBusy}
  onconfirm={() => void confirmImport()}
>
  {#if preview}
    <p class="text-sm text-muted-foreground">
      <span class="text-foreground">{preview.title ?? "Playlist"}</span>
    </p>
    <ul class="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
      <li>Will import: <span class="text-signal">{preview.willImport}</span> of {preview.total}</li>
      <li>Unavailable among those: <span class="text-foreground">{preview.unavailableAmongNew}</span></li>
      <li>Already in library: {preview.alreadyImported}</li>
    </ul>
    <p class="mt-2 font-mono text-[10px] text-muted-foreground">Additive — existing tracks are skipped.</p>
  {/if}
</ConfirmDialog>

<ConfirmDialog
  bind:open={disconnectOpen}
  title="Disconnect YouTube?"
  confirmLabel="Disconnect"
  danger
  onconfirm={() => void disconnect()}
>
  <p class="text-sm text-muted-foreground">Stops playlist listing and auto-sync. Catalogue tracks already imported stay in Zap.</p>
</ConfirmDialog>
