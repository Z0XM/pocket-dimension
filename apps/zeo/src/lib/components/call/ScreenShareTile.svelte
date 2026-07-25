<script lang="ts">
  import MonitorOffIcon from "@lucide/svelte/icons/monitor-off";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeOffIcon from "@lucide/svelte/icons/volume-off";
  import type { LocalParticipant, RemoteParticipant } from "livekit-client";
  import type { TileMediaStats } from "$lib/livekit/tile-stats";
  import AudioLevelIndicator from "./AudioLevelIndicator.svelte";
  import ScreenShareVideo from "./ScreenShareVideo.svelte";
  import TileStatsOverlay from "./TileStatsOverlay.svelte";
  import TileVolumeSlider from "./TileVolumeSlider.svelte";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    isLocal?: boolean;
    hidden?: boolean;
    audioOnly?: boolean;
    showStats?: boolean;
    stats?: TileMediaStats | null;
    audioLevel?: number;
    listenVolume?: number;
    speakersEnabled?: boolean;
    onListenVolumeChange?: (volume: number) => void;
    shareVideoEnabled?: boolean;
    shareAudioEnabled?: boolean;
    shareAudioAvailable?: boolean;
    onToggleShareVideo?: () => void;
    onToggleShareAudio?: () => void;
  };

  const {
    participant,
    displayName,
    isLocal = false,
    hidden = false,
    audioOnly = false,
    showStats = false,
    stats = null,
    audioLevel = 0,
    listenVolume = 100,
    speakersEnabled = true,
    onListenVolumeChange,
    shareVideoEnabled = !audioOnly,
    shareAudioEnabled = false,
    shareAudioAvailable = false,
    onToggleShareVideo,
    onToggleShareAudio,
  }: Props = $props();

  const showVolumeSlider = $derived(!isLocal && Boolean(onListenVolumeChange));
  const showLocalShareControls = $derived(isLocal && Boolean(onToggleShareVideo || onToggleShareAudio));

  const actionClass =
    "inline-flex size-8 items-center justify-center rounded-sm text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40 sm:size-7";
</script>

<div class="relative size-full overflow-hidden rounded-lg">
  {#if showStats}
    <TileStatsOverlay {stats} />
  {/if}

  {#if hidden}
    <div class="flex size-full items-center justify-center bg-secondary">
      <span class="text-sm font-medium text-muted-foreground">{audioOnly ? "Audio hidden" : "Screen hidden"}</span>
    </div>
  {:else if audioOnly}
    <div class="flex size-full flex-col items-center justify-center gap-3 bg-secondary">
      <Volume2Icon class="size-10 text-muted-foreground/80" aria-hidden="true" />
      <p class="text-sm font-medium text-muted-foreground">Sharing tab audio</p>
    </div>
  {:else}
    <ScreenShareVideo {participant} {isLocal} />
  {/if}

  {#if showLocalShareControls}
    <div
      class="absolute bottom-10 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/55 p-0.5 backdrop-blur-sm"
      role="toolbar"
      tabindex="-1"
      aria-label="Share media controls"
      onpointerdown={(event) => event.stopPropagation()}
    >
      {#if onToggleShareVideo}
        <button
          type="button"
          class="{actionClass} {shareVideoEnabled ? 'bg-white/20 text-white' : ''}"
          aria-label={shareVideoEnabled ? "Turn off video sharing" : "Turn on video sharing"}
          aria-pressed={shareVideoEnabled}
          onclick={onToggleShareVideo}
        >
          {#if shareVideoEnabled}
            <MonitorIcon class="size-3.5" aria-hidden="true" />
          {:else}
            <MonitorOffIcon class="size-3.5" aria-hidden="true" />
          {/if}
        </button>
      {/if}
      {#if onToggleShareAudio}
        <button
          type="button"
          class="{actionClass} {shareAudioEnabled ? 'bg-white/20 text-white' : ''}"
          aria-label={shareAudioEnabled ? "Turn off audio sharing" : "Turn on audio sharing"}
          aria-pressed={shareAudioEnabled}
          disabled={!shareAudioEnabled && !shareAudioAvailable}
          title={!shareAudioEnabled && !shareAudioAvailable ? "Share audio was not granted in the browser picker" : undefined}
          onclick={onToggleShareAudio}
        >
          {#if shareAudioEnabled}
            <Volume2Icon class="size-3.5" aria-hidden="true" />
          {:else}
            <VolumeOffIcon class="size-3.5" aria-hidden="true" />
          {/if}
        </button>
      {/if}
    </div>
  {/if}

  <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
    <p class="min-w-0 truncate text-sm font-medium text-white">{displayName}'s {audioOnly ? "audio" : "screen"}</p>
    {#if showVolumeSlider}
      <div class="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5">
        <AudioLevelIndicator class="shrink-0" level={audioLevel} />
        <TileVolumeSlider
          value={listenVolume}
          disabled={!speakersEnabled}
          label="Volume for {displayName}'s share"
          onChange={(value) => onListenVolumeChange?.(value)}
        />
      </div>
    {/if}
  </div>
</div>
