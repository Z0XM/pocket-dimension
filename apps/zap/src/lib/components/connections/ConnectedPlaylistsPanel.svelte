<script lang="ts">
  import { goto } from "$app/navigation";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import LinkIcon from "@lucide/svelte/icons/link";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { youtubePlaylistHref } from "$lib/history-time";
  import { toast } from "$lib/toast.svelte";

  let {
    linked = true,
    showHide = true,
    showFilters = true,
    compact = false,
    onchanged,
  }: {
    linked?: boolean;
    /** Connections-only: hide/unhide playlist from default filters. */
    showHide?: boolean;
    showFilters?: boolean;
    /** Playlists tab: tighter chrome, no section heading. */
    compact?: boolean;
    onchanged?: () => void;
  } = $props();

  type ImportStatus = "fully_imported" | "partially_imported" | "not_imported";
  type PlaylistFilter = "all" | "imported" | "not_imported" | "hidden" | "synced" | "connected";
  type SyncMode = "additive" | "exact";
  type SyncInterval = "off" | "hourly" | "every_6_hours" | "daily";

  type PlaylistRow = {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    itemCount: number | null;
    importStatus: ImportStatus;
    alreadyImported: number;
    autoSync: boolean;
    hidden: boolean;
    zapPlaylistId: string | null;
    syncMode: SyncMode;
    syncInterval: SyncInterval;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  };

  type SyncPreview = {
    youtubePlaylistId: string;
    title: string;
    zapPlaylistId: string | null;
    syncMode: SyncMode;
    syncInterval: SyncInterval;
    connected: boolean;
    adds: Array<{ videoId: string; title: string; mediaAssetId: string | null; needsDownload: boolean }>;
    removes: Array<{ videoId: string; title: string; mediaAssetId: string | null; needsDownload: boolean }>;
    alreadyMatched: number;
    ytTotal: number;
    zapTotal: number;
    willDownload: number;
  };

  const FILTERS: { id: PlaylistFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "connected", label: "Connected" },
    { id: "imported", label: "Imported" },
    { id: "not_imported", label: "Not Imported" },
    { id: "hidden", label: "Hidden" },
    { id: "synced", label: "Auto sync" },
  ];

  const INTERVAL_OPTIONS: { id: SyncInterval; label: string }[] = [
    { id: "off", label: "Off" },
    { id: "hourly", label: "Every hour" },
    { id: "every_6_hours", label: "Every 6 hours" },
    { id: "daily", label: "Daily" },
  ];

  let playlists = $state<PlaylistRow[]>([]);
  let playlistQuery = $state("");
  let playlistFilter = $state<PlaylistFilter>(compact ? "all" : "not_imported");
  let filterReady = $state(false);
  let loadingPlaylists = $state(false);
  let busyId = $state<string | null>(null);
  let syncPreview = $state<SyncPreview | null>(null);
  let syncPreviewOpen = $state(false);
  let syncBusy = $state(false);

  function matchesFilter(row: PlaylistRow, filter: PlaylistFilter): boolean {
    if (filter === "hidden") return row.hidden;
    if (row.hidden && showHide) return false;
    if (filter === "all") return true;
    if (filter === "connected") return Boolean(row.zapPlaylistId);
    if (filter === "imported") return row.importStatus === "fully_imported" || row.importStatus === "partially_imported";
    if (filter === "not_imported") return row.importStatus === "not_imported" && !row.zapPlaylistId;
    if (filter === "synced") return row.autoSync || row.syncInterval !== "off";
    return true;
  }

  const filteredPlaylists = $derived.by(() => {
    const q = playlistQuery.trim().toLowerCase();
    return playlists.filter((p) => {
      if (showFilters && !matchesFilter(p, playlistFilter)) return false;
      if (!showFilters && showHide && p.hidden) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q);
    });
  });

  function when(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function statusLabel(s: ImportStatus) {
    if (s === "fully_imported") return "Fully imported";
    if (s === "partially_imported") return "Partially imported";
    return "Not imported";
  }

  function intervalLabel(v: SyncInterval) {
    return INTERVAL_OPTIONS.find((o) => o.id === v)?.label ?? v;
  }

  function pickDefaultFilter(rows: PlaylistRow[]): PlaylistFilter {
    if (compact) return "all";
    const hasNotImported = rows.some((p) => !p.hidden && p.importStatus === "not_imported" && !p.zapPlaylistId);
    if (hasNotImported) return "not_imported";
    if (rows.some((p) => p.zapPlaylistId)) return "connected";
    return "synced";
  }

  function normalizeRow(p: PlaylistRow): PlaylistRow {
    return {
      ...p,
      hidden: Boolean(p.hidden),
      zapPlaylistId: p.zapPlaylistId ?? null,
      syncMode: p.syncMode === "exact" ? "exact" : "additive",
      syncInterval: (["off", "hourly", "every_6_hours", "daily"] as SyncInterval[]).includes(p.syncInterval) ? p.syncInterval : "off",
      autoSync: Boolean(p.autoSync) || (p.syncInterval !== undefined && p.syncInterval !== "off"),
    };
  }

  export async function loadPlaylists() {
    if (!linked) return;
    loadingPlaylists = true;
    try {
      const res = await fetch("/api/connections/youtube/playlists", { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      const next = ((body.playlists ?? []) as PlaylistRow[]).map(normalizeRow);
      playlists = next;
      if (!filterReady) {
        playlistFilter = pickDefaultFilter(playlists);
        filterReady = true;
      }
      onchanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load playlists");
    } finally {
      loadingPlaylists = false;
    }
  }

  async function patchPlaylist(row: PlaylistRow, patch: { autoSync?: boolean; hidden?: boolean; syncMode?: SyncMode; syncInterval?: SyncInterval }) {
    busyId = row.id;
    try {
      const res = await fetch(`/api/connections/youtube/playlists/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, title: row.title }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      playlists = playlists.map((p) =>
        p.id === row.id
          ? normalizeRow({
              ...p,
              autoSync: typeof body.autoSync === "boolean" ? body.autoSync : p.autoSync,
              hidden: typeof body.hidden === "boolean" ? body.hidden : p.hidden,
              syncMode: body.syncMode === "exact" || body.syncMode === "additive" ? body.syncMode : p.syncMode,
              syncInterval:
                body.syncInterval && ["off", "hourly", "every_6_hours", "daily"].includes(body.syncInterval) ? body.syncInterval : p.syncInterval,
              zapPlaylistId: body.zapPlaylistId ?? p.zapPlaylistId,
            })
          : p
      );
      if (typeof patch.hidden === "boolean") {
        toast.success(patch.hidden ? `Hid “${row.title}”.` : `Unhid “${row.title}”.`);
      } else if (patch.syncMode) {
        toast.success(`Sync mode → ${patch.syncMode}`);
      } else if (patch.syncInterval) {
        toast.success(`Auto sync → ${intervalLabel(patch.syncInterval)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update playlist");
    } finally {
      busyId = null;
    }
  }

  async function connectPlaylist(row: PlaylistRow) {
    busyId = row.id;
    try {
      const res = await fetch(`/api/connections/youtube/playlists/${encodeURIComponent(row.id)}/connect`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: row.title, syncMode: row.syncMode, syncInterval: row.syncInterval }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(body?.message ?? `Connect failed (${res.status})`);
      playlists = playlists.map((p) =>
        p.id === row.id
          ? normalizeRow({
              ...p,
              zapPlaylistId: body.zapPlaylistId ?? p.zapPlaylistId,
              title: body.title ?? p.title,
            })
          : p
      );
      if (body.jobId) {
        toast.info(`Connected “${body.title ?? row.title}” — downloading missing tracks.`);
        await goto("/jobs");
      } else {
        toast.success(`Connected “${body.title ?? row.title}” (${body.mappedNow ?? 0} tracks).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connect failed");
    } finally {
      busyId = null;
    }
  }

  async function openSyncPreview(row: PlaylistRow) {
    if (!row.zapPlaylistId) {
      await connectPlaylist(row);
      return;
    }
    busyId = row.id;
    try {
      const qs = row.title ? `?title=${encodeURIComponent(row.title)}` : "";
      const res = await fetch(`/api/connections/youtube/playlists/${encodeURIComponent(row.id)}/sync${qs}`, {
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Preview failed (${res.status})`);
      syncPreview = body.preview as SyncPreview;
      syncPreviewOpen = true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync preview failed");
    } finally {
      busyId = null;
    }
  }

  async function acceptSync() {
    if (!syncPreview) return;
    syncBusy = true;
    try {
      const res = await fetch(`/api/connections/youtube/playlists/${encodeURIComponent(syncPreview.youtubePlaylistId)}/sync`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", syncMode: syncPreview.syncMode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(body?.message ?? `Sync failed (${res.status})`);
      syncPreviewOpen = false;
      syncPreview = null;
      if (body.jobId) {
        toast.info("Sync accepted — downloading missing tracks, then updating your Zap playlist.");
        await goto("/jobs");
        return;
      }
      const bits = [body.added ? `+${body.added}` : null, body.removed ? `−${body.removed}` : null].filter(Boolean);
      toast.success(bits.length ? `Synced (${bits.join(", ")}).` : "Already in sync.");
      await loadPlaylists();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      syncBusy = false;
    }
  }

  $effect(() => {
    if (linked) void loadPlaylists();
  });
</script>

<div class={compact ? "space-y-3" : "space-y-3"}>
  {#if !compact}
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Playlists</h2>
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
  {:else if linked}
    <div class="flex justify-end">
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center border border-border text-muted-foreground hover:border-signal/50 hover:text-signal disabled:opacity-40"
        aria-label="Refresh playlists"
        disabled={loadingPlaylists || busyId !== null}
        onclick={() => void loadPlaylists()}
      >
        <RefreshCwIcon class={`size-3.5 ${loadingPlaylists ? "animate-spin" : ""}`} aria-hidden="true" />
      </button>
    </div>
  {/if}

  {#if !linked}
    <p class="font-mono text-[11px] text-muted-foreground">
      Connect YouTube in <a class="text-signal underline" href="/connections?tab=youtube">Connections</a> first.
    </p>
  {:else if loadingPlaylists && playlists.length === 0}
    <p class="font-mono text-[11px] text-muted-foreground">Loading playlists…</p>
  {:else if playlists.length === 0}
    <p class="font-mono text-[11px] text-muted-foreground">No playlists found.</p>
  {:else}
    {#if showFilters}
      <div class="flex flex-wrap gap-1 border-b border-border/60 pb-2">
        {#each FILTERS.filter((f) => (showHide ? true : f.id !== "hidden")) as f (f.id)}
          <button
            type="button"
            class={`px-2.5 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase ${
              playlistFilter === f.id ? "border-b-2 border-signal text-signal" : "text-muted-foreground hover:text-signal"
            }`}
            aria-pressed={playlistFilter === f.id}
            onclick={() => (playlistFilter = f.id)}
          >
            {f.label}
          </button>
        {/each}
      </div>
    {/if}
    <div class="relative min-w-0">
      <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        class="zap-underline-field w-full pl-9"
        type="search"
        placeholder="Search playlists…"
        aria-label="Search playlists by name"
        bind:value={playlistQuery}
        autocomplete="off"
      />
    </div>
    {#if filteredPlaylists.length === 0}
      <p class="font-mono text-[11px] text-muted-foreground">
        {playlistQuery.trim()
          ? `No playlists match “${playlistQuery.trim()}”.`
          : playlistFilter === "hidden"
            ? "No hidden playlists."
            : playlistFilter === "connected"
              ? "No connected Zap mirrors yet — use Connect on a playlist."
              : playlistFilter === "not_imported"
                ? "Nothing left to import — try Connected or All."
                : "No playlists in this filter."}
      </p>
    {:else}
      <ul class="zap-track-host">
        {#each filteredPlaylists as row (row.id)}
          <li class="space-y-2 px-3 py-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                {#if row.zapPlaylistId}
                  <a class="truncate text-sm font-medium hover:text-signal" href={`/playlists/${row.zapPlaylistId}`}>
                    {row.title}
                  </a>
                {:else}
                  <p class="truncate text-sm font-medium">{row.title}</p>
                {/if}
                <p class="font-mono text-[10px] text-muted-foreground">
                  {#if row.itemCount != null}
                    {row.itemCount} on YouTube
                    {#if row.alreadyImported > 0}
                      · {row.alreadyImported} in library{/if}
                    · {statusLabel(row.importStatus)}
                  {:else}
                    {statusLabel(row.importStatus)}
                    {#if row.alreadyImported > 0}
                      · {row.alreadyImported} in library{/if}
                  {/if}
                  {#if row.zapPlaylistId}
                    · mirrored
                  {/if}
                  {#if row.hidden}
                    · hidden
                  {/if}
                  {#if row.syncInterval !== "off"}
                    · {intervalLabel(row.syncInterval)} · {row.syncMode}
                  {/if}
                  {#if row.lastSyncedAt}
                    · synced {when(row.lastSyncedAt)}
                  {/if}
                </p>
                {#if row.lastSyncError}
                  <p class="font-mono text-[10px] text-destructive">{row.lastSyncError}</p>
                {/if}
              </div>
              <div class="flex items-center gap-1">
                {#if row.zapPlaylistId}
                  <button
                    type="button"
                    class="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-signal disabled:opacity-40"
                    aria-label={`Sync ${row.title}`}
                    title="Preview sync changes"
                    disabled={busyId !== null || syncBusy}
                    onclick={() => void openSyncPreview(row)}
                  >
                    <RefreshCwIcon class={`size-3.5 ${busyId === row.id ? "animate-spin" : ""}`} aria-hidden="true" />
                  </button>
                {/if}
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
            </div>

            <div class="flex flex-wrap items-center gap-2">
              {#if row.zapPlaylistId}
                <label class="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span class="sr-only">Sync mode for {row.title}</span>
                  <select
                    class="rounded border border-border bg-transparent px-1.5 py-1 text-[10px] text-foreground"
                    value={row.syncMode}
                    disabled={busyId === row.id}
                    onchange={(e) => void patchPlaylist(row, { syncMode: (e.currentTarget as HTMLSelectElement).value as SyncMode })}
                  >
                    <option value="additive">Additive</option>
                    <option value="exact">Exact</option>
                  </select>
                </label>
                <label class="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span class="sr-only">Auto sync interval for {row.title}</span>
                  <select
                    class="rounded border border-border bg-transparent px-1.5 py-1 text-[10px] text-foreground"
                    value={row.syncInterval}
                    disabled={busyId === row.id}
                    onchange={(e) =>
                      void patchPlaylist(row, {
                        syncInterval: (e.currentTarget as HTMLSelectElement).value as SyncInterval,
                      })}
                  >
                    {#each INTERVAL_OPTIONS as opt (opt.id)}
                      <option value={opt.id}>{opt.label}</option>
                    {/each}
                  </select>
                </label>
              {:else}
                <button
                  type="button"
                  class="auth-btn !px-2.5 !py-1 inline-flex items-center gap-1"
                  disabled={busyId !== null}
                  onclick={() => void connectPlaylist(row)}
                >
                  <LinkIcon class="size-3" aria-hidden="true" />
                  {busyId === row.id ? "…" : "Connect"}
                </button>
              {/if}

              {#if showHide}
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-signal disabled:opacity-40"
                  disabled={busyId === row.id}
                  title={row.hidden ? "Show in list" : "Hide from list"}
                  onclick={() => void patchPlaylist(row, { hidden: !row.hidden })}
                >
                  {#if row.hidden}
                    <EyeIcon class="size-3.5" aria-hidden="true" />
                    Unhide
                  {:else}
                    <EyeOffIcon class="size-3.5" aria-hidden="true" />
                    Hide
                  {/if}
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="font-mono text-[10px] text-muted-foreground">
      Connect creates a Zap playlist with the same name and maps YouTube tracks (downloading any that are missing). Sync preview shows adds/removes —
      Additive only adds; Exact also removes tracks gone from YouTube. Auto sync applies on the interval you choose.
    </p>
  {/if}
</div>

<ConfirmDialog
  bind:open={syncPreviewOpen}
  title="Sync preview"
  confirmLabel={syncBusy ? "Applying…" : "Accept changes"}
  cancelLabel="Discard"
  busy={syncBusy}
  onconfirm={() => void acceptSync()}
>
  {#if syncPreview}
    <p class="text-sm text-muted-foreground">
      <span class="text-foreground">{syncPreview.title}</span>
      · {syncPreview.syncMode}
      · YT {syncPreview.ytTotal} · Zap {syncPreview.zapTotal}
    </p>
    {#if syncPreview.adds.length === 0 && (syncPreview.syncMode === "additive" || syncPreview.removes.length === 0)}
      <p class="mt-3 font-mono text-[11px] text-muted-foreground">No changes to apply.</p>
    {:else}
      {#if syncPreview.adds.length > 0}
        <div class="mt-3 space-y-1">
          <p class="font-mono text-[10px] tracking-[0.12em] text-signal uppercase">
            Add ({syncPreview.adds.length})
            {#if syncPreview.willDownload > 0}
              · {syncPreview.willDownload} to download{/if}
          </p>
          <ul class="max-h-36 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground">
            {#each syncPreview.adds.slice(0, 40) as t (t.videoId)}
              <li class="truncate">
                + {t.title}{#if t.needsDownload}<span class="text-signal"> · download</span>{/if}
              </li>
            {/each}
            {#if syncPreview.adds.length > 40}
              <li>…and {syncPreview.adds.length - 40} more</li>
            {/if}
          </ul>
        </div>
      {/if}
      {#if syncPreview.removes.length > 0}
        <div class="mt-3 space-y-1">
          <p class="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            {syncPreview.syncMode === "exact" ? `Remove (${syncPreview.removes.length})` : `Would remove in Exact (${syncPreview.removes.length})`}
          </p>
          <ul class="max-h-36 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground">
            {#each syncPreview.removes.slice(0, 40) as t (t.mediaAssetId ?? t.videoId)}
              <li class="truncate">− {t.title}</li>
            {/each}
            {#if syncPreview.removes.length > 40}
              <li>…and {syncPreview.removes.length - 40} more</li>
            {/if}
          </ul>
        </div>
      {/if}
    {/if}
  {/if}
</ConfirmDialog>
