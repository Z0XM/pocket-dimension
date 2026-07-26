<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import Music2Icon from "@lucide/svelte/icons/music-2";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import ListStartIcon from "@lucide/svelte/icons/list-start";
  import ListEndIcon from "@lucide/svelte/icons/list-end";
  import AudioLevelIndicator from "$lib/components/call/AudioLevelIndicator.svelte";
  import TileVolumeSlider from "$lib/components/call/TileVolumeSlider.svelte";
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
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

  let rootEl = $state<HTMLElement | null>(null);
  let seekTrackEl = $state<HTMLElement | null>(null);
  let seekTrackWidth = $state(180);
  /** Wide tiles use left/right; tall tiles use top/bottom. */
  let isRowLayout = $state(false);

  const WAVE_CYCLES = 10;
  const WAVE_AMP = 5.5;
  const WAVE_PAD_X = 8;
  const WAVE_HEIGHT = 22;
  /** How fast the wave pattern drifts while playing (cycles per second). */
  const WAVE_FLOW_HZ = 0.7;
  const seekClipId = `listening-seek-clip-${Math.random().toString(36).slice(2, 9)}`;
  let wavePhase = $state(0);
  let scrubMs = $state(0);
  let scrubbing = $state(false);
  /** Ignore server clock until the seek response (or a newer generation) lands. */
  let seekPending = $state(false);
  let seekEpoch = 0;
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
  /** Local pending for tile-initiated playback jumps (queue click) before snapshot flips to loading. */
  let actionPending = $state(false);
  /** Optimistic Up next order while dragging / until the snapshot catches up. */
  let upNextOrderIds = $state<string[] | null>(null);
  let draggingUpNextId = $state<string | null>(null);
  let suppressUpNextClickUntil = 0;

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
  const controlsBusy = $derived(busy || panelBusy || actionPending);
  /** Visible when server is loading, parent transport is in-flight, or a local queue jump is pending. */
  const showPlaybackLoading = $derived(loading || busy || actionPending);
  const artUrl = $derived(item?.thumbnailUrl ?? null);
  const seekProgress = $derived(durationMs > 0 ? Math.min(100, Math.max(0, (scrubMs / durationMs) * 100)) : 0);
  const prefetchedVideoIds = $derived(new Set(snapshot?.prefetchedVideoIds ?? []));

  $effect(() => {
    const el = rootEl;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      isRowLayout = width > height;
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  });

  $effect(() => {
    const el = seekTrackEl;
    if (!el) return;

    const update = () => {
      seekTrackWidth = Math.max(48, el.clientWidth);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  });

  function waveY(t: number, phase = wavePhase) {
    return WAVE_HEIGHT / 2 + WAVE_AMP * Math.sin((t * WAVE_CYCLES - phase) * Math.PI * 2);
  }

  function buildWavePath(width: number, phase: number) {
    const inner = Math.max(1, width - WAVE_PAD_X * 2);
    const steps = Math.max(48, Math.floor(inner / 2));
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = WAVE_PAD_X + t * inner;
      const y = waveY(t, phase);
      d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  }

  const seekWavePath = $derived(buildWavePath(seekTrackWidth, wavePhase));
  const seekThumbT = $derived(Math.min(1, Math.max(0, seekProgress / 100)));
  const seekThumbX = $derived(WAVE_PAD_X + seekThumbT * Math.max(1, seekTrackWidth - WAVE_PAD_X * 2));
  const seekThumbY = $derived(waveY(seekThumbT, wavePhase));
  const canSeek = $derived(isDj && Boolean(item && onSeek) && !controlsBusy);

  function scrubFromClientX(clientX: number) {
    const el = seekTrackEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inner = Math.max(1, rect.width - WAVE_PAD_X * 2);
    const t = Math.min(1, Math.max(0, (clientX - rect.left - WAVE_PAD_X) / inner));
    const max = durationMs || Math.max(scrubMs, 1);
    scrubMs = clampScrub(t * max);
  }

  function onSeekPointerDown(event: PointerEvent) {
    if (!canSeek) return;
    event.preventDefault();
    scrubbing = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    scrubFromClientX(event.clientX);
  }

  function onSeekPointerMove(event: PointerEvent) {
    if (!scrubbing || !canSeek) return;
    scrubFromClientX(event.clientX);
  }

  function onSeekPointerUp(event: PointerEvent) {
    if (!scrubbing) return;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    commitSeek();
  }

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

  const displayedUpNext = $derived.by(() => {
    const items = queueSections.upNext;
    if (!upNextOrderIds) return items;
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const ordered = upNextOrderIds.map((id) => byId.get(id)).filter((entry): entry is ListeningSnapshotQueueItem => Boolean(entry));
    // Include any newly arrived up-next items that aren't in the local order yet.
    for (const entry of items) {
      if (!upNextOrderIds.includes(entry.id)) ordered.push(entry);
    }
    return ordered;
  });

  $effect(() => {
    // Clear optimistic order once the snapshot matches (or up-next is empty).
    const serverIds = queueSections.upNext.map((entry) => entry.id);
    if (!upNextOrderIds) return;
    if (draggingUpNextId) return;
    if (serverIds.length === upNextOrderIds.length && serverIds.every((id, index) => id === upNextOrderIds![index])) {
      upNextOrderIds = null;
    }
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

    lastPlaybackGeneration = generation;
    lastPositionUpdatedAt = updatedAt;
    lastPlaybackState = state;

    if (seekPending) {
      if (generation > seekEpoch) {
        seekPending = false;
      } else {
        // Stale position while our seek is in flight — keep local scrub.
        return;
      }
    }

    positionAnchorMs = next;
    positionAnchorTime = performance.now();
    if (!scrubbing) scrubMs = next;
  }

  $effect(() => {
    if (!session) {
      lastPlaybackGeneration = null;
      lastPositionUpdatedAt = null;
      lastPlaybackState = null;
      seekPending = false;
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

  // If the seek request finishes without a generation bump (failed API), drop the hold.
  $effect(() => {
    if (!seekPending || busy) return;
    const generation = session?.playbackGeneration ?? 0;
    if (generation <= seekEpoch) {
      seekPending = false;
      applyServerClock();
    }
  });

  $effect(() => {
    if (!playing || scrubbing || loading || seekPending) return;

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

  $effect(() => {
    if (!playing) return;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      wavePhase = (wavePhase - dt * WAVE_FLOW_HZ + 1) % 1;
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
    const target = Math.round(clampScrub(scrubMs));
    scrubbing = false;
    seekPending = true;
    seekEpoch = session?.playbackGeneration ?? lastPlaybackGeneration ?? 0;
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

  function enqueueVideo(
    entry: { videoId: string; title: string; channelTitle?: string | null; thumbnailUrl?: string | null; source?: string },
    placement: "next" | "last"
  ) {
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
          placement,
        }),
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

  function reorderUpNext(nextUpNextIds: string[]) {
    if (!isDj || controlsBusy) return;
    const previousIds = queueSections.previous.map((entry) => entry.id);
    const currentId = queueSections.current?.id;
    const orderedIds = [...previousIds, ...(currentId ? [currentId] : []), ...nextUpNextIds];

    void runQueueAction(() =>
      fetch(`/api/rooms/${slug}/listening/queue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderedIds }),
      })
    ).then((ok) => {
      if (!ok) {
        upNextOrderIds = null;
      }
    });
  }

  function onUpNextDragStart(entryId: string, event: DragEvent) {
    if (!isDj || controlsBusy) {
      event.preventDefault();
      return;
    }
    draggingUpNextId = entryId;
    upNextOrderIds = displayedUpNext.map((entry) => entry.id);
    event.dataTransfer?.setData("text/plain", entryId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function onUpNextDragOver(overId: string, event: DragEvent) {
    if (!isDj || !draggingUpNextId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    if (draggingUpNextId === overId) return;

    const order = upNextOrderIds ?? displayedUpNext.map((entry) => entry.id);
    const from = order.indexOf(draggingUpNextId);
    const to = order.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, draggingUpNextId);
    upNextOrderIds = next;
  }

  function onUpNextDrop(event: DragEvent) {
    event.preventDefault();
    if (!draggingUpNextId || !upNextOrderIds) return;
    const nextIds = [...upNextOrderIds];
    draggingUpNextId = null;
    suppressUpNextClickUntil = Date.now() + 250;
    reorderUpNext(nextIds);
  }

  function onUpNextDragEnd() {
    suppressUpNextClickUntil = Date.now() + 250;
    if (draggingUpNextId && upNextOrderIds) {
      const nextIds = [...upNextOrderIds];
      draggingUpNextId = null;
      reorderUpNext(nextIds);
      return;
    }
    draggingUpNextId = null;
  }

  function playQueueItem(id: string) {
    if (!isDj || controlsBusy) return;
    actionPending = true;
    void runQueueAction(() =>
      fetch(`/api/rooms/${slug}/listening/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: id }),
      })
    ).finally(() => {
      actionPending = false;
    });
  }

  function requestPlay() {
    if (showPlaybackLoading || !onPlay) return;
    onPlay();
  }

  function requestPause() {
    if (!onPause || actionPending) return;
    onPause();
  }

  function togglePlayback() {
    if (playing || loading) {
      requestPause();
      return;
    }
    requestPlay();
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
    class="listening-seek flex items-center gap-2.5 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] text-white/80 shadow-sm backdrop-blur-md"
  >
    <span class="w-8 shrink-0 tabular-nums text-white/70">{formatTime(scrubMs)}</span>
    <div
      bind:this={seekTrackEl}
      class="relative min-w-0 flex-1 {canSeek ? 'cursor-pointer' : 'cursor-default opacity-80'}"
      style:height="{WAVE_HEIGHT}px"
      role="slider"
      tabindex={canSeek ? 0 : -1}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={durationMs || Math.max(scrubMs, 1)}
      aria-valuenow={Math.round(scrubMs)}
      aria-valuetext={formatTime(scrubMs)}
      aria-disabled={!canSeek}
      onpointerdown={onSeekPointerDown}
      onpointermove={onSeekPointerMove}
      onpointerup={onSeekPointerUp}
      onpointercancel={onSeekPointerUp}
      onkeydown={(event) => {
        if (!canSeek) return;
        const max = durationMs || Math.max(scrubMs, 1);
        const step = Math.max(500, Math.round(max / 50));
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          scrubbing = true;
          scrubMs = clampScrub(scrubMs + step);
          commitSeek();
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          scrubbing = true;
          scrubMs = clampScrub(scrubMs - step);
          commitSeek();
        } else if (event.key === "Home") {
          event.preventDefault();
          scrubbing = true;
          scrubMs = 0;
          commitSeek();
        } else if (event.key === "End") {
          event.preventDefault();
          scrubbing = true;
          scrubMs = max;
          commitSeek();
        }
      }}
    >
      <svg
        class="pointer-events-none absolute inset-0 overflow-visible"
        width="100%"
        height={WAVE_HEIGHT}
        viewBox={`0 0 ${seekTrackWidth} ${WAVE_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={seekClipId}>
            <rect x="0" y="0" width={Math.max(0, seekThumbX + 1)} height={WAVE_HEIGHT} />
          </clipPath>
        </defs>
        <path d={seekWavePath} fill="none" stroke="rgb(255 255 255 / 0.22)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path
          d={seekWavePath}
          fill="none"
          stroke="color-mix(in srgb, var(--participant-orange) 92%, white)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          clip-path={`url(#${seekClipId})`}
        />
        <circle
          cx={seekThumbX}
          cy={seekThumbY}
          r="5"
          fill="color-mix(in srgb, var(--participant-orange) 92%, white)"
          stroke="color-mix(in srgb, var(--participant-orange) 70%, black)"
          stroke-width="1.5"
        />
      </svg>
    </div>
    <span class="w-8 shrink-0 text-right tabular-nums text-white/70">{durationMs ? formatTime(durationMs) : "—"}</span>
  </div>
{/snippet}

{#snippet queueRow(entry: ListeningSnapshotQueueItem, kind: "previous" | "current" | "next")}
  {@const canJump = isDj && kind !== "current"}
  {@const canReorder = isDj && kind === "next"}
  <div
    class="flex items-center gap-2 rounded-lg px-2 py-1.5 {kind === 'current'
      ? 'bg-black/60 ring-1 ring-participant-orange/50'
      : kind === 'previous'
        ? 'bg-black/40 opacity-55'
        : 'bg-black/45'} {canJump ? 'cursor-pointer transition-colors hover:bg-black/70 hover:opacity-100' : ''} {draggingUpNextId === entry.id
      ? 'opacity-60 ring-1 ring-participant-orange/40'
      : ''}"
    role={canJump ? "button" : undefined}
    tabindex={canJump ? 0 : undefined}
    aria-label={canJump ? `Play ${entry.title}` : undefined}
    aria-grabbed={canReorder && draggingUpNextId === entry.id ? "true" : undefined}
    ondragover={canReorder
      ? (event) => {
          onUpNextDragOver(entry.id, event);
        }
      : undefined}
    ondrop={canReorder ? onUpNextDrop : undefined}
    onclick={() => {
      if (!canJump || draggingUpNextId || Date.now() < suppressUpNextClickUntil) return;
      playQueueItem(entry.id);
    }}
    onkeydown={(event) => {
      if (!canJump) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        playQueueItem(entry.id);
      }
    }}
  >
    {#if canReorder}
      <button
        type="button"
        class="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white/70 active:cursor-grabbing disabled:opacity-40"
        draggable="true"
        disabled={controlsBusy}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        onclick={(event) => event.stopPropagation()}
        ondragstart={(event) => {
          event.stopPropagation();
          onUpNextDragStart(entry.id, event);
        }}
        ondragend={onUpNextDragEnd}
      >
        <GripVerticalIcon class="size-3.5" />
      </button>
    {/if}
    <div class="relative size-8 shrink-0">
      {#if entry.thumbnailUrl}
        <img src={entry.thumbnailUrl} alt="" draggable="false" class="size-8 rounded object-cover {kind === 'previous' ? 'grayscale' : ''}" />
      {:else}
        <div class="flex size-8 items-center justify-center rounded bg-white/10">
          <Music2Icon class="size-3.5 text-white/45" />
        </div>
      {/if}
      {#if entry.prefetched || prefetchedVideoIds.has(entry.videoId)}
        <span
          class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-participant-orange shadow-[0_0_0_1.5px_rgba(0,0,0,0.65)]"
          title="Ready to play"
          aria-label="Ready to play"
        ></span>
      {/if}
    </div>
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
        onclick={(event) => {
          event.stopPropagation();
          removeQueueItem(entry.id);
        }}
      >
        <XIcon class="size-3.5" />
      </button>
    {/if}
  </div>
{/snippet}

<div bind:this={rootEl} class="listening-tile relative flex h-full min-h-0 flex-col overflow-hidden text-white">
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

    <div class="flex min-h-0 flex-1 {isRowLayout ? 'flex-row gap-2.5' : 'flex-col'}">
      <div class="group/cover relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl {isRowLayout ? 'h-full flex-1' : 'mb-2 flex-[0.95]'}">
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
                class="listening-transport absolute inset-0 flex items-center justify-center transition-opacity duration-200 {showPlaybackLoading
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-none opacity-0 group-hover/cover:pointer-events-auto group-hover/cover:opacity-100 group-focus-within/cover:pointer-events-auto group-focus-within/cover:opacity-100'}"
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
                  aria-label={showPlaybackLoading ? "Loading" : playing || loading ? "Pause" : "Play"}
                  aria-busy={showPlaybackLoading}
                  disabled={(!onPlay && !onPause) || (showPlaybackLoading && !onPause)}
                  onclick={togglePlayback}
                >
                  {#if showPlaybackLoading}
                    <Loader2Icon class="size-8 animate-spin text-participant-orange" aria-hidden="true" />
                  {:else if playing}
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
              <div
                class="inline-flex size-16 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-md transition-opacity duration-200 sm:size-[4.5rem] {showPlaybackLoading
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/cover:opacity-100'}"
                role="status"
                aria-label={showPlaybackLoading ? "Loading" : playing ? "Playing" : "Paused"}
                aria-busy={showPlaybackLoading}
              >
                {#if showPlaybackLoading}
                  <Loader2Icon class="size-8 animate-spin text-participant-orange" aria-hidden="true" />
                {:else if playing}
                  <PauseIcon class="size-8 text-participant-orange" />
                {:else}
                  <PlayIcon class="size-8 translate-x-0.5 text-participant-orange" />
                {/if}
              </div>
            {/if}
          </div>

          <div class="px-3 pb-3 pt-1">
            {@render seekBar()}
          </div>
        </div>
      </div>

      <div
        class="flex min-h-0 min-w-0 flex-col space-y-2 rounded-2xl border border-white/15 bg-black/60 p-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl {isRowLayout
          ? 'h-full flex-1'
          : 'shrink-0'}"
      >
        <div
          class="relative shrink-0 rounded-xl border border-white/15 bg-black/55 transition-[border-color,box-shadow] focus-within:border-white/30 focus-within:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
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
          </div>

          {#if searchResults.length}
            <ul class="max-h-28 space-y-0.5 overflow-y-auto border-t border-white/10 p-1.5">
              {#each searchResults as result (result.videoId)}
                <li class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/10">
                  <div class="relative size-7 shrink-0">
                    {#if result.thumbnailUrl}
                      <img src={result.thumbnailUrl} alt="" class="size-7 rounded object-cover" />
                    {:else}
                      <div class="flex size-7 items-center justify-center rounded bg-white/10">
                        <Music2Icon class="size-3.5 text-white/50" />
                      </div>
                    {/if}
                    {#if prefetchedVideoIds.has(result.videoId)}
                      <span
                        class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-participant-orange shadow-[0_0_0_1.5px_rgba(0,0,0,0.65)]"
                        title="Ready to play"
                        aria-label="Ready to play"
                      ></span>
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[11px] font-medium text-white">{result.title}</p>
                    <p class="truncate text-[10px] text-white/50">{result.channelTitle}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger>
                        <button
                          type="button"
                          class="inline-flex size-7 items-center justify-center rounded-md text-participant-orange hover:bg-white/10 disabled:opacity-50"
                          disabled={controlsBusy}
                          aria-label="Play next"
                          onclick={() => enqueueVideo(result, "next")}
                        >
                          <ListStartIcon class="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Play next</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <button
                          type="button"
                          class="inline-flex size-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                          disabled={controlsBusy}
                          aria-label="Play last"
                          onclick={() => enqueueVideo(result, "last")}
                        >
                          <ListEndIcon class="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Play last</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="min-h-0 space-y-2 overflow-y-auto pr-0.5 {isRowLayout ? 'flex-1' : 'max-h-44'}">
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

          {#if displayedUpNext.length}
            <div class="space-y-1">
              <p class="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Up next</p>
              <div class="space-y-1" role={isDj ? "list" : undefined} aria-label={isDj ? "Up next queue, drag to reorder" : undefined}>
                {#each displayedUpNext as entry (entry.id)}
                  {@render queueRow(entry, "next")}
                {/each}
              </div>
            </div>
          {/if}
        </div>
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

  .listening-seek [role="slider"]:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--participant-orange) 70%, white);
    outline-offset: 2px;
    border-radius: 9999px;
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
