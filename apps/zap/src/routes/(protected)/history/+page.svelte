<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import ListMusicIcon from "@lucide/svelte/icons/list-music";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { invalidateAll } from "$app/navigation";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import { toast } from "$lib/toast.svelte";
  import { formatClock, runTrackDisplayTitle, type CatalogQueueRunTrack } from "$lib/catalog-queue";
  import { getCatalogQueue } from "$lib/catalog-queue-client.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const queue = getCatalogQueue();
  let busyRunId = $state<string | null>(null);
  let saveRunId = $state<string | null>(null);
  let saveName = $state("");
  let deleteRunId = $state<string | null>(null);
  let deleteOpen = $state(false);
  let replaceOpen = $state(false);
  let pendingRestartId = $state<string | null>(null);
  let viewTracksRunId = $state<string | null>(null);
  let viewTracks = $state<CatalogQueueRunTrack[] | null>(null);
  let viewTracksLoading = $state(false);

  const activeRunId = $derived(queue?.queue?.id ?? null);

  async function runAction(runId: string, fn: () => Promise<unknown>) {
    if (!queue || busyRunId) return;
    busyRunId = runId;
    await fn();
    if (queue.error) toast.error(queue.error);
    busyRunId = null;
    await invalidateAll();
  }

  function requestRestart(runId: string) {
    if (!queue) return;
    if (queue.needsReplaceConfirm && activeRunId !== runId) {
      pendingRestartId = runId;
      replaceOpen = true;
      return;
    }
    void runAction(runId, () => queue.activateRun(runId, "restart"));
  }

  async function confirmRestart() {
    const runId = pendingRestartId;
    if (!runId || !queue) return;
    replaceOpen = false;
    pendingRestartId = null;
    await runAction(runId, () => queue.activateRun(runId, "restart"));
  }

  function formatWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  /** Queue title = when it was played (started), not a song-title mashup. */
  function runTitle(iso: string) {
    return formatWhen(iso);
  }

  function openSave(runId: string, createdAt: string) {
    saveRunId = saveRunId === runId ? null : runId;
    saveName = `Queue · ${runTitle(createdAt)}`;
  }

  function trackHref(track: CatalogQueueRunTrack) {
    if (track.externalUrl) return track.externalUrl;
    const label = runTrackDisplayTitle(track);
    return `/catalogue?q=${encodeURIComponent(label)}`;
  }

  function isExternalHref(href: string) {
    return href.startsWith("http://") || href.startsWith("https://");
  }

  function linkAttrs(href: string) {
    return isExternalHref(href) ? { href, target: "_blank" as const, rel: "noopener noreferrer" } : { href };
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
    const tracks = await queue.fetchRunTracks(runId);
    if (viewTracksRunId !== runId) return;
    viewTracksLoading = false;
    if (tracks) viewTracks = tracks;
    else if (queue.error) toast.error(queue.error);
  }

  async function saveRun(runId: string) {
    if (!queue || !saveName.trim()) return;
    busyRunId = runId;
    const playlist = await queue.saveRunAsPlaylist(runId, saveName.trim());
    busyRunId = null;
    if (playlist) {
      toast.success(`Saved as “${playlist.name}”.`);
      saveRunId = null;
    } else if (queue.error) toast.error(queue.error);
  }
</script>

<div class="space-y-3">
  {#if !data.queueRuns?.length}
    <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
      No queues yet — press play on a track in the <a href="/catalogue" class="text-signal hover:underline">Catalogue</a>.
    </p>
  {:else}
    <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
      {#each data.queueRuns as run (run.id)}
        {@const isActive = run.id === activeRunId}
        <li class="space-y-2 px-4 py-3">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="min-w-0 flex-1 truncate text-sm font-medium" title={runTitle(run.createdAt)}>
              {runTitle(run.createdAt)}
            </h2>
            {#if isActive}<span class="rounded border border-signal/40 px-1 font-mono text-[10px] text-signal">playing now</span>{/if}
          </div>
          <p class="font-mono text-[11px] text-muted-foreground">
            {run.trackCount} track{run.trackCount === 1 ? "" : "s"}
            {#if run.currentIndex != null}
              · stopped at {run.currentIndex + 1}/{run.trackCount} ({formatClock(run.positionMs)})
            {:else}
              · finished
            {/if}
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
              onclick={() => requestRestart(run.id)}
            >
              <RotateCcwIcon class="size-3" /> Restart
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:text-signal disabled:opacity-40"
              disabled={!queue || busyRunId !== null || run.currentIndex == null}
              title={run.currentIndex == null ? "This queue played to the end" : "Continue where it stopped"}
              onclick={() => void runAction(run.id, () => queue!.activateRun(run.id, "resume"))}
            >
              <PlayIcon class="size-3" /> Resume
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:text-signal disabled:opacity-40"
              disabled={!queue || busyRunId !== null}
              onclick={() => openSave(run.id, run.createdAt)}
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
                    {@const href = track.available ? trackHref(track) : null}
                    <li class="flex gap-2" class:text-muted-foreground={!track.available}>
                      <span class="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span class="min-w-0 flex-1">
                        {#if href}
                          <a
                            class="block truncate font-sans text-xs font-medium text-foreground hover:text-signal hover:underline"
                            class:italic={!track.available}
                            title={label}
                            {...linkAttrs(href)}
                          >
                            {label}
                            {#if isExternalHref(href)}
                              <ExternalLinkIcon class="ml-1 inline size-3 align-text-top text-muted-foreground" aria-hidden="true" />
                            {/if}
                          </a>
                        {:else}
                          <span class="block truncate font-sans text-xs font-medium italic" title={label}>{label}</span>
                        {/if}
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
        </li>
      {/each}
    </ul>
  {/if}
</div>

<ConfirmDialog
  bind:open={replaceOpen}
  title="Replace your queue?"
  body={`Your current queue of ${queue?.items.length ?? 0} song${(queue?.items.length ?? 0) === 1 ? "" : "s"} will be closed, and this queue will be started.`}
  confirmLabel="Start this queue"
  busy={busyRunId !== null}
  onconfirm={confirmRestart}
/>

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
