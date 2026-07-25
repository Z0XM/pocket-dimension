<script lang="ts">
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import Music2Icon from "@lucide/svelte/icons/music-2";
  import AudioLevelIndicator from "$lib/components/call/AudioLevelIndicator.svelte";
  import TileVolumeSlider from "$lib/components/call/TileVolumeSlider.svelte";
  import type { ListeningSnapshot } from "$lib/server/listening/types";

  type Props = {
    snapshot: ListeningSnapshot | null;
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
  };

  let {
    snapshot,
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
  }: Props = $props();

  let scrubMs = $state(0);
  let scrubbing = $state(false);

  const item = $derived(snapshot?.currentItem ?? null);
  const session = $derived(snapshot?.session ?? null);
  const playing = $derived(session?.playbackState === "playing");
  const durationMs = $derived(item?.durationMs ?? 0);

  $effect(() => {
    if (!scrubbing) {
      scrubMs = session?.positionMs ?? 0;
    }
  });

  function formatTime(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function commitSeek() {
    scrubbing = false;
    onSeek?.(scrubMs);
  }
</script>

<div class="flex h-full min-h-0 flex-col justify-end bg-gradient-to-b from-secondary/40 via-card to-card p-3">
  <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2">
    {#if item?.thumbnailUrl}
      <img src={item.thumbnailUrl} alt="" class="aspect-square w-28 max-w-[40%] rounded-lg object-cover shadow-md sm:w-36" />
    {:else}
      <div class="flex aspect-square w-28 max-w-[40%] items-center justify-center rounded-lg bg-secondary sm:w-36">
        <Music2Icon class="size-10 text-muted-foreground" aria-hidden="true" />
      </div>
    {/if}
    <div class="w-full space-y-1 text-center">
      <p class="truncate text-sm font-medium text-foreground">{item?.title ?? "Nothing playing"}</p>
      <p class="truncate text-xs text-muted-foreground">{item?.channelTitle ?? "Shared Listening"}</p>
    </div>
    {#if session?.errorMessage}
      <p class="text-center text-xs text-destructive">{session.errorMessage}</p>
    {/if}
  </div>

  <div class="space-y-2">
    <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span class="w-8 tabular-nums">{formatTime(scrubMs)}</span>
      <input
        type="range"
        class="h-1.5 flex-1 accent-participant-orange disabled:opacity-50"
        min="0"
        max={durationMs || Math.max(scrubMs, 1)}
        step="500"
        bind:value={scrubMs}
        disabled={!isDj || !item || !onSeek || busy}
        onpointerdown={() => (scrubbing = true)}
        onpointerup={commitSeek}
        onkeyup={(event) => {
          if (event.key === "Enter" || event.key === " ") commitSeek();
        }}
        aria-label="Seek"
      />
      <span class="w-8 text-right tabular-nums">{durationMs ? formatTime(durationMs) : "—"}</span>
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1">
        {#if isDj}
          <button type="button" class="action-btn-ghost size-9" aria-label="Previous" disabled={busy || !onPrevious} onclick={onPrevious}>
            <SkipBackIcon class="size-4" />
          </button>
          <button
            type="button"
            class="action-btn-ghost size-9"
            aria-label={playing ? "Pause" : "Play"}
            disabled={busy || (!onPlay && !onPause)}
            onclick={() => (playing ? onPause?.() : onPlay?.())}
          >
            {#if playing}
              <PauseIcon class="size-4 text-participant-orange" />
            {:else}
              <PlayIcon class="size-4 text-participant-orange" />
            {/if}
          </button>
          <button type="button" class="action-btn-ghost size-9" aria-label="Next" disabled={busy || !onSkip} onclick={onSkip}>
            <SkipForwardIcon class="size-4" />
          </button>
        {:else}
          <span class="px-1 text-xs text-muted-foreground">{playing ? "Playing" : "Paused"}</span>
        {/if}
      </div>

      <div class="flex min-w-0 flex-1 items-center justify-end gap-2">
        <AudioLevelIndicator level={audioLevel} class="!h-2 !min-w-16 w-16" />
        {#if onListenVolumeChange}
          <TileVolumeSlider value={listenVolume} disabled={!speakersEnabled} label="Listening volume" onChange={onListenVolumeChange} />
        {/if}
      </div>
    </div>
  </div>
</div>
