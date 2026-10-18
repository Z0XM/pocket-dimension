<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ListMusicIcon from "@lucide/svelte/icons/list-music";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { invalidateAll } from "$app/navigation";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { formatClock, runTrackDisplayTitle, type CatalogQueueRunTrack } from "$lib/catalog-queue";
  import { getCatalogQueue } from "$lib/catalog-queue-client.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const queue = getCatalogQueue();
  let busyRunId = $state<string | null>(null);
  let runError = $state<string | null>(null);
  let saveRunId = $state<string | null>(null);
  let saveName = $state("");
  let saved = $state<{ runId: string; id: string; name: string } | null>(null);
  let deleteRunId = $state<string | null>(null);
  let deleteOpen = $state(false);
  let viewTracksRunId = $state<string | null>(null);
  let viewTracks = $state<CatalogQueueRunTrack[] | null>(null);
  let viewTracksLoading = $state(false);

  const activeRunId = $derived(queue?.queue?.id ?? null);

  async function runAction(runId: string, fn: () => Promise<unknown>) {
    if (!queue || busyRunId) return;
    busyRunId = runId;
    runError = null;
    await fn();
    runError = queue.error;
    busyRunId = null;
    await invalidateAll();
  }

  function openSave(runId: string, titles: string[]) {
    saved = null;
    saveRunId = saveRunId === runId ? null : runId;
    saveName = titles[0] ? `${titles[0]} & more` : `Queue · ${new Date().toLocaleDateString()}`;
  }

  async function toggleViewTracks(runId: string) {
    if (viewTracksRunId === runId) {
      viewTracksRunId = null;
      viewTracks = null;
      viewTracksLoading = false;
      return;
    }
    if (!queue) return;
    viewTracksRunId = runId;
    viewTracks = null;
    viewTracksLoading = true;
    runError = null;
    const tracks = await queue.fetchRunTracks(runId);
    if (viewTracksRunId !== runId) return;
    viewTracksLoading = false;
    if (tracks) viewTracks = tracks;
    else runError = queue.error;
  }

  async function saveRun(runId: string) {
    if (!queue || !saveName.trim()) return;
    busyRunId = runId;
    runError = null;
    const playlist = await queue.saveRunAsPlaylist(runId, saveName.trim());
    busyRunId = null;
    if (playlist) {
      saved = { runId, id: playlist.id, name: playlist.name };
      saveRunId = null;
    } else runError = queue.error;
  }

  function formatWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function activityKindLabel(kind: string) {
    if (kind === "playlist_import") return "Playlist";
    if (kind === "url_import") return "URL";
    if (kind === "upload") return "Upload";
    return kind;
  }
</script>

<section class="space-y-8">
  <div>
    <h1 class="text-3xl font-semibold tracking-tight">History</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Catalogue queues, plays and imports. Session snapshots (saved queues) live under
      <a href="/playlists" class="text-signal hover:underline">Playlists</a>.
    </p>
  </div>

  <div class="space-y-3">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Catalogue queues</h2>
    {#if runError}
      <p class="auth-error mb-0 p-2">{runError}</p>
    {/if}
    {#if !data.queueRuns?.length}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        No queues yet — press play on a track in the <a href="/catalogue" class="text-signal hover:underline">Catalogue</a>.
      </p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.queueRuns as run (run.id)}
          {@const isActive = run.id === activeRunId}
          <li class="space-y-2 px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="min-w-0 flex-1 truncate text-sm font-medium" title={run.titles.join(" · ")}>
                {run.titles.slice(0, 3).join(" · ")}{run.trackCount > 3 ? ` +${run.trackCount - 3}` : ""}
              </p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={run.updatedAt}>{formatWhen(run.updatedAt)}</time>
            </div>
            <p class="font-mono text-[11px] text-muted-foreground">
              {run.trackCount} track{run.trackCount === 1 ? "" : "s"}
              {#if run.currentIndex != null}
                · stopped at {run.currentIndex + 1}/{run.trackCount} ({formatClock(run.positionMs)})
              {:else}
                · finished
              {/if}
              {#if isActive}<span class="ml-1 rounded border border-signal/40 px-1 text-signal">playing now</span>{/if}
            </p>
            <div class="flex flex-wrap gap-1.5 font-mono text-[10px]">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:text-signal disabled:opacity-40"
                disabled={!queue || viewTracksLoading}
                aria-expanded={viewTracksRunId === run.id}
                onclick={() => void toggleViewTracks(run.id)}
              >
                <ListMusicIcon class="size-3" />
                {viewTracksRunId === run.id ? "Hide songs" : "View songs"}
                <ChevronDownIcon class={`size-3 transition ${viewTracksRunId === run.id ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-signal/40 bg-signal/10 px-2 py-1 text-signal hover:bg-signal/20 disabled:opacity-40"
                disabled={!queue || busyRunId !== null}
                onclick={() => void runAction(run.id, () => queue!.activateRun(run.id, "restart"))}
              >
                <RotateCcwIcon class="size-3" /> Restart queue
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:text-signal disabled:opacity-40"
                disabled={!queue || busyRunId !== null || run.currentIndex == null}
                title={run.currentIndex == null ? "This queue played to the end" : "Continue where it stopped"}
                onclick={() => void runAction(run.id, () => queue!.activateRun(run.id, "resume"))}
              >
                <PlayIcon class="size-3" /> Resume queue
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:text-signal disabled:opacity-40"
                disabled={!queue || busyRunId !== null}
                onclick={() => openSave(run.id, run.titles)}
              >
                <SaveIcon class="size-3" /> Save as playlist
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                disabled={!queue || busyRunId !== null}
                onclick={() => {
                  deleteRunId = run.id;
                  deleteOpen = true;
                }}
              >
                <Trash2Icon class="size-3" /> Remove
              </button>
            </div>
            {#if viewTracksRunId === run.id}
              <div class="rounded border border-border/60 bg-background/40 px-3 py-2">
                {#if viewTracksLoading}
                  <p class="font-mono text-[11px] text-muted-foreground">Loading tracks…</p>
                {:else if viewTracks}
                  <ol class="max-h-64 space-y-1.5 overflow-y-auto font-mono text-[11px]">
                    {#each viewTracks as track, i (track.id)}
                      {@const label = runTrackDisplayTitle(track)}
                      <li class="flex gap-2" class:text-muted-foreground={!track.available}>
                        <span class="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                        <span class="min-w-0 flex-1">
                          <span class="block truncate font-sans text-xs font-medium" class:italic={!track.available} title={label}
                            >{label}</span
                          >
                          {#if track.available && track.artists}
                            <span class="block truncate text-muted-foreground">{track.artists}</span>
                          {:else if !track.available}
                            <span class="block text-muted-foreground">Unavailable</span>
                          {/if}
                        </span>
                        {#if run.currentIndex === i}
                          <span class="shrink-0 text-signal">stopped here</span>
                        {/if}
                      </li>
                    {/each}
                  </ol>
                {/if}
              </div>
            {/if}
            {#if saveRunId === run.id}
              <form
                class="flex gap-2"
                onsubmit={(e) => {
                  e.preventDefault();
                  void saveRun(run.id);
                }}
              >
                <input class="auth-field h-8 py-0 text-xs" bind:value={saveName} maxlength="80" aria-label="Playlist name" />
                <button
                  type="submit"
                  class="rounded bg-primary px-3 text-xs text-primary-foreground disabled:opacity-40"
                  disabled={!saveName.trim() || busyRunId !== null}>Save</button
                >
              </form>
            {/if}
            {#if saved?.runId === run.id}
              <p class="font-mono text-[11px] text-signal">
                Saved as <a class="underline" href={`/playlists/${saved.id}`}>{saved.name}</a>.
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="space-y-3">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Play history</h2>
    {#if !data.playHistory?.length}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        Nothing played yet — play a track from the catalogue or a session.
      </p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.playHistory as play (play.id)}
          <li class="px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-sm font-medium">{play.title}</p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={play.at}>{formatWhen(play.at)}</time>
            </div>
            <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {play.artists ?? "Unknown"}
              {#if play.sessionId}
                · session{/if}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="space-y-3">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Uploads & imports</h2>
    {#if !data.activity?.length}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
        No imports yet —
        <a href="/catalogue?add" class="text-signal hover:underline">Add music</a>.
      </p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.activity as entry (entry.id)}
          <li class="px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-mono text-[11px] text-signal">{activityKindLabel(entry.kind)}</p>
              <time class="font-mono text-[11px] text-muted-foreground" datetime={entry.at}>{formatWhen(entry.at)}</time>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">
              {#if entry.kind === "upload"}
                {entry.title}
              {:else}
                {entry.label}
                · {entry.imported} imported
                {#if entry.unavailable}· {entry.unavailable} not available{/if}
                {#if entry.skipped}· {entry.skipped} skipped{/if}
                {#if entry.failed}· {entry.failed} failed{/if}
              {/if}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<ConfirmDialog
  bind:open={deleteOpen}
  title="Remove this queue from History?"
  body="The tracks stay in the catalogue; only this saved queue run is deleted."
  confirmLabel="Remove"
  danger
  busy={busyRunId !== null}
  onconfirm={() => {
    const id = deleteRunId;
    deleteOpen = false;
    deleteRunId = null;
    if (id) void runAction(id, () => queue!.deleteRun(id));
  }}
/>
