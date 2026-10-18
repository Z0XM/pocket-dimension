<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import CustomTagInput from "$lib/components/CustomTagInput.svelte";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import { nextPlaybackAction } from "$lib/playback-action";
  import { enhance } from "$app/forms";

  export type TrackItem = {
    id: string;
    title: string;
    artists: string | null;
    description?: string | null;
    channelTitle?: string | null;
    channelId?: string | null;
    durationMs: number | null;
    sourceType: string;
    playable: boolean;
    /** False for metadata-only rows (deleted / private / blocked source). */
    available?: boolean;
    unavailableReason?: string | null;
    externalUrl?: string | null;
    tags: { id: string; name: string; kind: string }[];
  };

  type TagOption = { id: string; name: string; kind: string };

  let {
    track,
    availableTags,
    activeId = $bindable<string | null>(null),
    audioEl = $bindable<HTMLAudioElement | null>(null),
  }: {
    track: TrackItem;
    availableTags: TagOption[];
    activeId?: string | null;
    audioEl?: HTMLAudioElement | null;
  } = $props();

  let editing = $state(false);
  let editTagIds = $state<string[]>([]);
  let editCustomTags = $state<string[]>([]);
  let editCustomDraft = $state("");
  const unavailable = $derived(track.available === false);
  let current = $state(0);
  let duration = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);
  /** Event-synced; do not derive from audioEl.paused (not Svelte-reactive). */
  let uiPlaying = $state(false);

  const isActive = $derived(activeId === track.id);
  let playGen = 0;

  function formatTime(sec: number) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function formatDurationMs(ms: number | null) {
    if (ms == null) return "—";
    return formatTime(ms / 1000);
  }

  function isThisLoaded(el: HTMLAudioElement) {
    return el.dataset.assetId === track.id && Boolean(el.currentSrc || el.src);
  }

  function syncFromElement() {
    if (!audioEl) {
      uiPlaying = false;
      return;
    }
    const mine = isThisLoaded(audioEl);
    uiPlaying = mine && !audioEl.paused;
    if (mine) {
      current = audioEl.currentTime;
      if (Number.isFinite(audioEl.duration)) duration = audioEl.duration;
    }
  }

  function onTimeUpdate() {
    if (!audioEl || !isThisLoaded(audioEl)) return;
    current = audioEl.currentTime;
    if (Number.isFinite(audioEl.duration)) duration = audioEl.duration;
  }

  function onEnded() {
    if (!audioEl || !isThisLoaded(audioEl)) return;
    uiPlaying = false;
    current = 0;
    if (activeId === track.id) activeId = null;
  }

  $effect(() => {
    if (!isActive) uiPlaying = false;
  });

  $effect(() => {
    if (!audioEl) return;
    const el = audioEl;
    const onPlay = () => syncFromElement();
    const onPause = () => syncFromElement();
    el.addEventListener("play", onPlay);
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onTimeUpdate);
    syncFromElement();
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onTimeUpdate);
    };
  });

  async function loadAndPlay(el: HTMLAudioElement) {
    const gen = ++playGen;
    loading = true;
    error = null;
    try {
      // Only (re)assign src when switching tracks — never on resume after pause
      if (!isThisLoaded(el)) {
        el.pause();
        el.src = `/api/media/${track.id}/audio`;
        el.dataset.assetId = track.id;
        el.load();
      }
      activeId = track.id;
      await el.play();
      if (gen !== playGen) return;
      uiPlaying = true;
    } catch (err) {
      if (gen !== playGen) return;
      error = err instanceof Error ? err.message : "Playback failed";
      uiPlaying = false;
      if (activeId === track.id) activeId = null;
    } finally {
      if (gen === playGen) loading = false;
    }
  }

  async function togglePlay() {
    error = null;
    if (!track.playable) {
      error = unavailable ? "Song not available — no audio source yet." : "No audio file for this track.";
      return;
    }
    if (!audioEl) return;
    const el = audioEl;
    const action = nextPlaybackAction(isThisLoaded(el), el.paused);

    if (action === "pause") {
      el.pause();
      uiPlaying = false;
      // keep activeId so seek bar stays usable and resume can continue
      return;
    }

    if (action === "resume") {
      const gen = ++playGen;
      loading = true;
      try {
        activeId = track.id;
        await el.play();
        if (gen !== playGen) return;
        uiPlaying = true;
      } catch {
        // Media element may be stuck after an aborted range request — hard reload once
        if (gen !== playGen) return;
        el.removeAttribute("src");
        delete el.dataset.assetId;
        await loadAndPlay(el);
      } finally {
        if (gen === playGen) loading = false;
      }
      return;
    }

    await loadAndPlay(el);
  }

  function seek(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!audioEl || !isThisLoaded(audioEl)) return;
    const next = Number(input.value);
    if (Number.isFinite(next)) {
      audioEl.currentTime = next;
      current = next;
    }
  }

  function startEdit() {
    editing = true;
    editTagIds = track.tags.map((t) => t.id);
    editCustomTags = [];
    editCustomDraft = "";
  }
</script>

<li class="flex flex-col gap-3 px-4 py-3">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
    <button
      type="button"
      class="flex size-10 shrink-0 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 disabled:opacity-40"
      disabled={!track.playable || loading}
      title={unavailable ? "Song not available" : undefined}
      aria-label={unavailable ? "Song not available" : uiPlaying ? "Pause" : "Play"}
      onclick={togglePlay}
    >
      {#if loading}
        <span class="font-mono text-[10px]">…</span>
      {:else if uiPlaying}
        <PauseIcon class="size-4" />
      {:else}
        <PlayIcon class="size-4" />
      {/if}
    </button>

    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="truncate font-medium {unavailable ? 'text-muted-foreground' : 'text-foreground'}">{track.title}</p>
          <p class="font-mono text-xs text-muted-foreground">
            {track.artists ?? "Unknown"} · {formatDurationMs(track.durationMs)} · {track.sourceType}
          </p>
          {#if unavailable}
            <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px]">
              <span class="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive">Song not available</span>
              {#if track.unavailableReason}<span class="text-muted-foreground">{track.unavailableReason}</span>{/if}
              {#if track.externalUrl}
                <a
                  class="text-muted-foreground underline-offset-2 hover:text-signal hover:underline"
                  href={track.externalUrl}
                  target="_blank"
                  rel="noreferrer">Source link</a
                >
              {:else}
                <span class="text-muted-foreground">URL not available</span>
              {/if}
            </p>
          {/if}
        </div>
        <div class="flex flex-wrap items-center gap-1">
          {#each track.tags as tag}
            <span class="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{tag.name}</span>
          {/each}
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-signal hover:bg-signal/10"
            onclick={() => (editing ? (editing = false) : startEdit())}
          >
            {editing ? "Cancel" : "Edit tags"}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2" class:hidden={unavailable}>
        <span class="w-10 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{formatTime(isActive ? current : 0)}</span>
        <input
          class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)] disabled:opacity-40"
          type="range"
          min="0"
          max={isActive && duration > 0 ? duration : Math.max((track.durationMs ?? 0) / 1000, 1)}
          step="0.1"
          value={isActive ? current : 0}
          disabled={!isActive}
          oninput={seek}
        />
        <span class="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums"
          >{formatTime(isActive && duration > 0 ? duration : (track.durationMs ?? 0) / 1000)}</span
        >
      </div>
      {#if error}
        <p class="font-mono text-[11px] text-destructive">{error}</p>
      {/if}
    </div>
  </div>

  {#if editing}
    <form
      method="POST"
      action="?/setTags"
      class="space-y-2 rounded border border-border/60 bg-background/40 p-3"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === "success") editing = false;
        };
      }}
    >
      <input type="hidden" name="mediaAssetId" value={track.id} />
      <TagMultiSelect options={availableTags} bind:selected={editTagIds} name="tagIds" placeholder="Select tags…" />
      <CustomTagInput bind:tags={editCustomTags} bind:draft={editCustomDraft} name="customTags" />
      <button type="submit" class="auth-btn w-fit">Save tags</button>
    </form>
  {/if}
</li>
