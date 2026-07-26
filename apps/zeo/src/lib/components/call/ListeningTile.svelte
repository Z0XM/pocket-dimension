<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import Music2Icon from "@lucide/svelte/icons/music-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import AudioLevelIndicator from "$lib/components/call/AudioLevelIndicator.svelte";
  import TileVolumeSlider from "$lib/components/call/TileVolumeSlider.svelte";
  import type { ListeningSnapshot, ListeningSnapshotQueueItem } from "$lib/server/listening/types";

  type SearchResult = {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    source: string;
  };

  type Props = {
    snapshot: ListeningSnapshot | null;
    slug: string;
    isDj: boolean;
    audioLevel?: number;
    listenVolume?: number;
    speakersEnabled?: boolean;
    busy?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onSkip?: () => void;
    onPrevious?: () => void;
    onSeek?: (positionMs: number) => void;
    onListenVolumeChange?: (volume: number) => void;
    onSnapshot?: (snapshot: ListeningSnapshot | null) => void;
  };

  let {
    snapshot,
    slug,
    isDj,
    audioLevel = 0,
    listenVolume = 100,
    speakersEnabled = true,
    busy = false,
    onPlay,
    onPause,
    onSkip,
    onPrevious,
    onSeek,
    onListenVolumeChange,
    onSnapshot,
  }: Props = $props();

  let scrubMs = $state(0);
  let scrubbing = $state(false);
  let positionAnchorMs = 0;
  let positionAnchorTime = 0;
  let lastPlaybackGeneration: number | null = null;
  let lastPositionUpdatedAt: string | null = null;
  let lastPlaybackState: string | null = null;
  let searchQuery = $state("");
  let searchResults = $state<SearchResult[]>([]);
  let pastedLink = $state<(SearchResult & { url: string }) | null>(null);
  let resolvingPaste = $state(false);
  let panelBusy = $state(false);
  let panelError = $state<string | null>(null);

  function looksLikeYouTubeUrl(text: string) {
    const value = text.trim();
    try {
      const url = new URL(value);
      return url.hostname === "youtu.be" || /(^|\.)youtube\.com$/.test(url.hostname);
    } catch {
      return false;
    }
  }

  function watchUrlForVideoId(videoId: string) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  const item = $derived(snapshot?.currentItem ?? null);
  const session = $derived(snapshot?.session ?? null);
  const queue = $derived(snapshot?.queue ?? []);
  const playing = $derived(session?.playbackState === "playing");
  const loading = $derived(session?.playbackState === "loading");
  const durationMs = $derived(item?.durationMs ?? 0);
  const controlsBusy = $derived(busy || panelBusy);
  const artUrl = $derived(item?.thumbnailUrl ?? null);
  const seekProgress = $derived(durationMs > 0 ? Math.min(100, Math.max(0, (scrubMs / durationMs) * 100)) : 0);

  const queueSections = $derived.by(() => {
    const currentId = session?.currentQueueItemId ?? null;
    const index = currentId ? queue.findIndex((entry) => entry.id === currentId) : -1;

    // Idle / nothing playing: keep history in Played, don't promote the whole queue to Now/Up next.
    if (index < 0 || session?.playbackState === "idle") {
      return { previous: queue, current: null as typeof item, upNext: [] as typeof queue };
    }

    const previous = index > 0 ? queue.slice(0, index) : [];
    const current = queue[index] ?? item;
    const upNext = queue.slice(index + 1);
    return { previous, current, upNext };
  });

  function clampScrub(ms: number) {
    let next = Math.max(0, ms);
    if (durationMs > 0) next = Math.min(next, durationMs);
    return next;
  }

  function applyServerClock() {
    const pos = session?.positionMs ?? 0;
    const generation = session?.playbackGeneration ?? 0;
    const updatedAt = session?.positionUpdatedAt ?? null;
    const state = session?.playbackState ?? null;
    const serverNow = snapshot?.serverNow ? Date.parse(snapshot.serverNow) : Date.now();
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : serverNow;
    const serverElapsed = state === "playing" ? Math.max(0, serverNow - updatedAtMs) : 0;
    const next = clampScrub(pos + serverElapsed);

    positionAnchorMs = next;
    positionAnchorTime = performance.now();
    lastPlaybackGeneration = generation;
    lastPositionUpdatedAt = updatedAt;
    lastPlaybackState = state;
    if (!scrubbing) scrubMs = next;
  }

  $effect(() => {
    if (!session) {
      lastPlaybackGeneration = null;
      lastPositionUpdatedAt = null;
      lastPlaybackState = null;
      if (!scrubbing) scrubMs = 0;
      return;
    }

    const generation = session.playbackGeneration;
    const updatedAt = session.positionUpdatedAt;
    const state = session.playbackState;
    const shouldReset = generation !== lastPlaybackGeneration || updatedAt !== lastPositionUpdatedAt || state !== lastPlaybackState;

    if (shouldReset) {
      applyServerClock();
    }
  });

  $effect(() => {
    if (!playing || scrubbing || loading) return;

    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - positionAnchorTime;
      scrubMs = clampScrub(positionAnchorMs + elapsed);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  });

  function formatTime(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function commitSeek() {
    const target = clampScrub(scrubMs);
    scrubbing = false;
    positionAnchorMs = target;
    positionAnchorTime = performance.now();
    scrubMs = target;
    onSeek?.(target);
  }

  function applySnapshot(next: ListeningSnapshot) {
    onSnapshot?.(next.session && !next.session.endedAt ? next : null);
  }

  async function runQueueAction(action: () => Promise<Response>) {
    panelError = null;
    panelBusy = true;
    try {
      const response = await action();
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(body?.message ?? body?.error ?? `Request failed (${response.status})`);
      }
      applySnapshot((await response.json()) as ListeningSnapshot);
      return true;
    } catch (error) {
      panelError = error instanceof Error ? error.message : "Something went wrong";
      return false;
    } finally {
      panelBusy = false;
    }
  }

  async function runSearch() {
    if (pastedLink) {
      searchResults = [pastedLink];
      return;
    }
    const q = searchQuery.trim();
    if (!q) return;
    panelError = null;
    panelBusy = true;
    try {
      const response = await fetch(`/api/rooms/${slug}/listening/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) {
        panelError = "Search failed";
        return;
      }
      const body = (await response.json()) as { items?: SearchResult[]; results?: SearchResult[] };
      searchResults = body.items ?? body.results ?? [];
    } finally {
      panelBusy = false;
    }
  }

  async function resolvePastedYouTubeUrl(rawUrl: string) {
    const url = rawUrl.trim();
    resolvingPaste = true;
    panelError = null;
    searchQuery = "";
    searchResults = [];
    pastedLink = null;
    try {
      const response = await fetch(`/api/rooms/${slug}/listening/search?q=${encodeURIComponent(url)}`);
      if (!response.ok) {
        searchQuery = url;
        panelError = "Couldn’t resolve that YouTube link";
        return;
      }
      const body = (await response.json()) as { items?: SearchResult[]; results?: SearchResult[] };
      const item = (body.items ?? body.results ?? [])[0];
      if (!item) {
        searchQuery = url;
        panelError = "Couldn’t resolve that YouTube link";
        return;
      }
      pastedLink = {
        ...item,
        url: watchUrlForVideoId(item.videoId),
        source: item.source || "url",
      };
      searchResults = [pastedLink];
    } catch {
      searchQuery = url;
      panelError = "Couldn’t resolve that YouTube link";
    } finally {
      resolvingPaste = false;
    }
  }

  function onSearchPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
    if (!looksLikeYouTubeUrl(text)) return;
    event.preventDefault();
    void resolvePastedYouTubeUrl(text);
  }

  function enqueueVideo(entry: { videoId: string; title: string; channelTitle?: string | null; thumbnailUrl?: string | null; source?: string }) {
    void runQueueAction(() =>
      fetch(`/api/rooms/${slug}/listening/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: entry.videoId,
          title: entry.title,
          channelTitle: entry.channelTitle ?? null,
          thumbnailUrl: entry.thumbnailUrl ?? null,
          source: entry.source ?? "search",
        }),
      })
    ).then((ok) => {
      if (!ok) return;
      clearSearch();
    });
  }

  function enqueueUrl() {
    if (pastedLink) {
      enqueueVideo(pastedLink);
      return;
    }
    const q = searchQuery.trim();
    if (!q) return;
    void runQueueAction(() =>
      fetch(`/api/rooms/${slug}/listening/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: q }),
      })
    ).then((ok) => {
      if (!ok) return;
      clearSearch();
    });
  }

  function removeQueueItem(id: string) {
    void runQueueAction(() =>
      fetch(`/api/rooms/${slug}/listening/queue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", itemId: id }),
      })
    );
  }

  function clearSearch() {
    searchQuery = "";
    searchResults = [];
    pastedLink = null;
    resolvingPaste = false;
  }
</script>

{#snippet seekBar()}
  <div
    class="listening-seek flex items-center gap-2.5 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] text-white/80 shadow-sm backdrop-blur-md"
    style:--seek-progress="{seekProgress}%"
  >
    <span class="w-8 shrink-0 tabular-nums text-white/70">{formatTime(scrubMs)}</span>
    <input
      type="range"
      class="listening-seek-range min-w-0 flex-1 disabled:opacity-50"
      min="0"
      max={durationMs || Math.max(scrubMs, 1)}
      step="500"
      bind:value={scrubMs}
      disabled={!isDj || !item || !onSeek || controlsBusy}
      onpointerdown={() => (scrubbing = true)}
      onpointerup={commitSeek}
      onkeyup={(event) => {
        if (event.key === "Enter" || event.key === " ") commitSeek();
      }}
      aria-label="Seek"
    />
    <span class="w-8 shrink-0 text-right tabular-nums text-white/70">{durationMs ? formatTime(durationMs) : "—"}</span>
  </div>
{/snippet}

{#snippet queueRow(entry: ListeningSnapshotQueueItem, kind: "previous" | "current" | "next")}
  <div
    class="flex items-center gap-2 rounded-lg px-2 py-1.5 {kind === 'current'
      ? 'bg-black/60 ring-1 ring-participant-orange/50'
      : kind === 'previous'
        ? 'bg-black/40 opacity-55'
        : 'bg-black/45'}"
  >
    {#if entry.thumbnailUrl}
      <img src={entry.thumbnailUrl} alt="" class="size-8 shrink-0 rounded object-cover {kind === 'previous' ? 'grayscale' : ''}" />
    {:else}
      <div class="flex size-8 shrink-0 items-center justify-center rounded bg-white/10">
        <Music2Icon class="size-3.5 text-white/45" />
      </div>
    {/if}
    <div class="min-w-0 flex-1">
      <p class="truncate text-[11px] font-medium text-white">{entry.title}</p>
      <p class="truncate text-[10px] text-white/55">
        {#if kind === "current"}
          Now playing{#if entry.channelTitle}
            · {entry.channelTitle}{/if}
        {:else if kind === "previous"}
          Played{#if entry.channelTitle}
            · {entry.channelTitle}{/if}
        {:else}
          Up next{#if entry.channelTitle}
            · {entry.channelTitle}{/if}
        {/if}
      </p>
    </div>
    {#if isDj && kind !== "current"}
      <button
        type="button"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-red-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
        disabled={controlsBusy}
        aria-label="Remove from queue"
        onclick={() => removeQueueItem(entry.id)}
      >
        <XIcon class="size-3.5" />
      </button>
    {/if}
  </div>
{/snippet}

<div class="listening-tile relative flex h-full min-h-0 flex-col overflow-hidden text-white">
  <div class="pointer-events-none absolute inset-0">
    {#if artUrl}
      <img src={artUrl} alt="" class="size-full scale-125 object-cover blur-xl brightness-110 saturate-150 opacity-95" />
      <img src={artUrl} alt="" class="absolute inset-0 size-full scale-105 object-cover opacity-35" />
    {:else}
      <div class="size-full bg-gradient-to-br from-secondary via-card to-background"></div>
    {/if}
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10"></div>
    <div class="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/40"></div>
    <div class="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-accent/15 to-transparent"></div>
  </div>

  <div class="relative z-10 flex h-full min-h-0 flex-col p-2.5 sm:p-3">
    {#if panelError}
      <p class="mb-2 shrink-0 rounded-md bg-destructive/80 px-2 py-1 text-[11px] text-white">{panelError}</p>
    {/if}
    {#if session?.errorMessage}
      <p class="mb-2 shrink-0 rounded-md bg-destructive/80 px-2 py-1 text-[11px] text-white">{session.errorMessage}</p>
    {/if}

    <div class="group/cover relative mb-2 flex min-h-0 flex-[0.95] flex-col overflow-hidden rounded-xl">
      {#if artUrl}
        <img src={artUrl} alt="" class="absolute inset-0 size-full object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25"></div>
      {:else}
        <div class="absolute inset-0 bg-gradient-to-br from-accent/30 to-black"></div>
      {/if}

      <div class="relative z-10 flex min-h-0 flex-1 flex-col">
        <div class="flex items-start justify-between gap-2 px-3 pt-3">
          <div class="min-w-0 flex-1 text-left sm:text-center">
            <p class="truncate text-base font-semibold tracking-tight drop-shadow">{item?.title ?? "Nothing playing"}</p>
            <p class="truncate text-xs text-white/75 drop-shadow">{item?.channelTitle ?? "Shared Listening"}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 shadow-sm backdrop-blur-md">
            <AudioLevelIndicator level={audioLevel} class="!h-2 !min-w-12 w-12" />
            {#if onListenVolumeChange}
              <TileVolumeSlider value={listenVolume} disabled={!speakersEnabled} label="Listening volume" onChange={onListenVolumeChange} />
            {/if}
          </div>
        </div>

        <div class="relative flex min-h-0 flex-1 items-center justify-center px-2">
          {#if isDj}
            <div
              class="listening-transport pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/cover:pointer-events-auto group-hover/cover:opacity-100 group-focus-within/cover:pointer-events-auto group-focus-within/cover:opacity-100"
            >
              <button
                type="button"
                class="absolute left-2 inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-md backdrop-blur-md hover:bg-black/65 disabled:opacity-40 sm:left-3 sm:size-12"
                aria-label="Previous"
                disabled={controlsBusy || !onPrevious}
                onclick={onPrevious}
              >
                <ChevronLeftIcon class="size-7" />
              </button>
              <button
                type="button"
                class="inline-flex size-16 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-md hover:bg-black/70 disabled:opacity-40 sm:size-[4.5rem]"
                aria-label={playing || loading ? "Pause" : "Play"}
                disabled={controlsBusy || (!onPlay && !onPause)}
                onclick={() => (playing || loading ? onPause?.() : onPlay?.())}
              >
                {#if playing || loading}
                  <PauseIcon class="size-8 text-participant-orange" />
                {:else}
                  <PlayIcon class="size-8 translate-x-0.5 text-participant-orange" />
                {/if}
              </button>
              <button
                type="button"
                class="absolute right-2 inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-md backdrop-blur-md hover:bg-black/65 disabled:opacity-40 sm:right-3 sm:size-12"
                aria-label="Next"
                disabled={controlsBusy || !onSkip}
                onclick={onSkip}
              >
                <ChevronRightIcon class="size-7" />
              </button>
            </div>
          {:else}
            <span
              class="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white/80 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover/cover:opacity-100"
            >
              {loading ? "Loading" : playing ? "Playing" : "Paused"}
            </span>
          {/if}
        </div>

        <div class="px-3 pb-3 pt-1">
          {@render seekBar()}
        </div>
      </div>
    </div>

    <div class="shrink-0 space-y-2 rounded-t-2xl border border-white/15 bg-black/60 p-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div
        class="relative rounded-xl border border-white/15 bg-black/55 transition-[border-color,box-shadow] focus-within:border-white/30 focus-within:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
      >
        <div class="flex items-center gap-1.5 px-2 py-1.5">
          <SearchIcon class="size-3.5 shrink-0 text-white/55" aria-hidden="true" />
          {#if pastedLink}
            <a
              class="min-w-0 flex-1 truncate text-xs font-medium text-participant-orange underline-offset-2 hover:underline"
              href={pastedLink.url}
              target="_blank"
              rel="noopener noreferrer"
              title={pastedLink.url}
            >
              {pastedLink.title}
            </a>
          {:else if resolvingPaste}
            <span class="min-w-0 flex-1 truncate text-xs text-white/55">Resolving link…</span>
          {:else}
            <input
              class="listening-search-input min-w-0 flex-1 border-0 bg-transparent text-xs text-white shadow-none placeholder:text-white/45 outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              placeholder="Search or paste YouTube URL"
              bind:value={searchQuery}
              onpaste={onSearchPaste}
              onkeydown={(event) => {
                if (event.key === "Enter") void runSearch();
              }}
            />
          {/if}
          {#if searchQuery || pastedLink || resolvingPaste}
            <button type="button" class="rounded p-1 text-white/50 hover:text-white" aria-label="Clear search" onclick={clearSearch}>
              <XIcon class="size-3.5" />
            </button>
          {/if}
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md bg-participant-orange/90 text-white hover:bg-participant-orange disabled:opacity-50"
            disabled={controlsBusy}
            aria-label="Add URL to queue"
            onclick={enqueueUrl}
          >
            <PlusIcon class="size-4" />
          </button>
        </div>

        {#if searchResults.length}
          <ul class="max-h-28 space-y-0.5 overflow-y-auto border-t border-white/10 p-1.5">
            {#each searchResults as result (result.videoId)}
              <li class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/10">
                {#if result.thumbnailUrl}
                  <img src={result.thumbnailUrl} alt="" class="size-7 shrink-0 rounded object-cover" />
                {:else}
                  <div class="flex size-7 shrink-0 items-center justify-center rounded bg-white/10">
                    <Music2Icon class="size-3.5 text-white/50" />
                  </div>
                {/if}
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[11px] font-medium text-white">{result.title}</p>
                  <p class="truncate text-[10px] text-white/50">{result.channelTitle}</p>
                </div>
                <button
                  type="button"
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-participant-orange hover:bg-white/10 disabled:opacity-50"
                  disabled={controlsBusy}
                  aria-label="Add to queue"
                  onclick={() => enqueueVideo(result)}
                >
                  <PlusIcon class="size-3.5" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="max-h-36 min-h-0 space-y-2 overflow-y-auto pr-0.5">
        {#if queueSections.previous.length}
          <div class="space-y-1">
            <p class="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Played</p>
            <div class="space-y-1">
              {#each queueSections.previous as entry (entry.id)}
                {@render queueRow(entry, "previous")}
              {/each}
            </div>
          </div>
        {/if}

        {#if queueSections.current}
          <div class="space-y-1">
            <p class="px-1 text-[10px] font-semibold uppercase tracking-wider text-participant-orange/80">Now</p>
            <div class="space-y-1">
              {@render queueRow(queueSections.current, "current")}
            </div>
          </div>
        {:else if queue.length === 0}
          <p class="px-1 text-xs text-white/50">Nothing in the queue yet — search or paste a link above.</p>
        {:else}
          <p class="px-1 text-xs text-white/50">Nothing playing — add a song or press play.</p>
        {/if}

        {#if queueSections.upNext.length}
          <div class="space-y-1">
            <p class="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Up next</p>
            <div class="space-y-1">
              {#each queueSections.upNext as entry (entry.id)}
                {@render queueRow(entry, "next")}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  @media (hover: none) {
    .listening-transport {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  }

  .listening-seek-range {
    -webkit-appearance: none;
    appearance: none;
    height: 0.25rem;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--participant-orange) 92%, white) var(--seek-progress),
      rgb(255 255 255 / 0.22) var(--seek-progress)
    );
    outline: none;
    cursor: pointer;
  }

  .listening-seek-range:disabled {
    cursor: not-allowed;
  }

  .listening-seek-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 9999px;
    background: #fff;
    border: 2px solid color-mix(in srgb, var(--participant-orange) 80%, white);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
  }

  .listening-seek-range::-moz-range-thumb {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 9999px;
    background: #fff;
    border: 2px solid color-mix(in srgb, var(--participant-orange) 80%, white);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
  }

  .listening-seek-range::-moz-range-track {
    height: 0.25rem;
    border-radius: 9999px;
    background: transparent;
  }

  /* Kill @tailwindcss/forms / browser default blue focus ring on the search field */
  .listening-search-input,
  .listening-search-input:focus,
  .listening-search-input:focus-visible {
    outline: none !important;
    box-shadow: none !important;
    --tw-ring-shadow: 0 0 #0000;
    --tw-ring-offset-shadow: 0 0 #0000;
  }
</style>
