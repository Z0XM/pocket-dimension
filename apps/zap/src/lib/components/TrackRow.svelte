<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import TagMultiSelect from "$lib/components/TagMultiSelect.svelte";
  import { enhance } from "$app/forms";

  export type TrackItem = {
    id: string;
    title: string;
    artists: string | null;
    durationMs: number | null;
    sourceType: string;
    playable: boolean;
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
  let current = $state(0);
  let duration = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const isActive = $derived(activeId === track.id);
  const isPlaying = $derived(isActive && audioEl != null && !audioEl.paused);

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

  function onTimeUpdate() {
    if (!audioEl || !isActive) return;
    current = audioEl.currentTime;
    if (Number.isFinite(audioEl.duration)) duration = audioEl.duration;
  }

  function onEnded() {
    if (isActive) {
      current = 0;
      activeId = null;
    }
  }

  $effect(() => {
    if (!audioEl) return;
    const el = audioEl;
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onTimeUpdate);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onTimeUpdate);
    };
  });

  async function togglePlay() {
    error = null;
    if (!track.playable) {
      error = "No audio file for this track.";
      return;
    }
    if (!audioEl) return;

    if (isPlaying) {
      audioEl.pause();
      return;
    }

    if (!isActive || audioEl.dataset.assetId !== track.id) {
      loading = true;
      try {
        audioEl.pause();
        audioEl.src = `/api/media/${track.id}/audio`;
        audioEl.dataset.assetId = track.id;
        activeId = track.id;
        await audioEl.play();
      } catch (err) {
        error = err instanceof Error ? err.message : "Playback failed";
        activeId = null;
      } finally {
        loading = false;
      }
      return;
    }

    try {
      await audioEl.play();
    } catch (err) {
      error = err instanceof Error ? err.message : "Playback failed";
    }
  }

  function seek(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!audioEl || !isActive) return;
    const next = Number(input.value);
    if (Number.isFinite(next)) {
      audioEl.currentTime = next;
      current = next;
    }
  }

  function startEdit() {
    editing = true;
    editTagIds = track.tags.map((t) => t.id);
  }
</script>

<li class="flex flex-col gap-3 px-4 py-3">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
    <button
      type="button"
      class="flex size-10 shrink-0 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal hover:bg-signal/20 disabled:opacity-40"
      disabled={!track.playable || loading}
      aria-label={isPlaying ? "Pause" : "Play"}
      onclick={togglePlay}
    >
      {#if loading}
        <span class="font-mono text-[10px]">…</span>
      {:else if isPlaying}
        <PauseIcon class="size-4" />
      {:else}
        <PlayIcon class="size-4" />
      {/if}
    </button>

    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="truncate font-medium text-foreground">{track.title}</p>
          <p class="font-mono text-xs text-muted-foreground">
            {track.artists ?? "Unknown"} · {formatDurationMs(track.durationMs)} · {track.sourceType}
          </p>
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

      <div class="flex items-center gap-2">
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
      <input class="auth-field" type="text" name="customTag" placeholder="New custom tag (optional)" />
      <button type="submit" class="auth-btn w-fit">Save tags</button>
    </form>
  {/if}
</li>
