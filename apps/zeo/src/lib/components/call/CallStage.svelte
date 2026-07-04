<script lang="ts">
  import { onMount } from "svelte";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import type { Room } from "livekit-client";
  import type { ParticipantColor } from "$lib/participant-colors";
  import type { StageGridLayout } from "$lib/stage-grid";
  import StageGridArea from "./StageGridArea.svelte";
  import VideoGrid from "./VideoGrid.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    hideParticipantVideos?: boolean;
    disableSpeakingGlows?: boolean;
    bottomInset?: number;
    minimizedTileKeys?: string[];
    pinnedTileKeys?: string[];
    hiddenVideoTileKeys?: string[];
    fullscreenTileKey?: string | null;
    onMinimizeTile?: (key: string) => void;
    onToggleHideVideo?: (key: string) => void;
    onTogglePin?: (key: string) => void;
    onToggleTileFullscreen?: (key: string) => void;
    stageRef?: HTMLElement | null;
  };

  let {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    localMicEnabled,
    localTileColor,
    hideParticipantVideos = false,
    disableSpeakingGlows = false,
    bottomInset = 0,
    minimizedTileKeys = [],
    pinnedTileKeys = [],
    hiddenVideoTileKeys = [],
    fullscreenTileKey = null,
    onMinimizeTile,
    onToggleHideVideo,
    onTogglePin,
    onToggleTileFullscreen,
    stageRef = $bindable(null),
  }: Props = $props();

  let stageEl = $state<HTMLElement | null>(null);
  let gridLayout = $state<StageGridLayout | null>(null);
  let stageFullscreen = $state(false);

  $effect(() => {
    stageRef = stageEl;
  });

  async function toggleStageFullscreen() {
    if (!stageEl) return;

    try {
      if (document.fullscreenElement === stageEl) {
        await document.exitFullscreen();
      } else {
        await stageEl.requestFullscreen();
      }
    } catch {
      // Browser may block fullscreen without a direct user gesture.
    }
  }

  onMount(() => {
    const syncStageFullscreen = () => {
      stageFullscreen = document.fullscreenElement === stageEl;
    };

    document.addEventListener("fullscreenchange", syncStageFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncStageFullscreen);
  });
</script>

<div bind:this={stageEl} class="relative size-full bg-background">
  <StageGridArea {bottomInset} bind:layout={gridLayout}>
    {#snippet children({ layout })}
      <VideoGrid
        {room}
        {activeSpeakerIdentity}
        {audioLevels}
        {localDisplayName}
        {mediaRevision}
        gridLayout={layout}
        {localMicEnabled}
        {localTileColor}
        {hideParticipantVideos}
        {disableSpeakingGlows}
        {minimizedTileKeys}
        {pinnedTileKeys}
        {hiddenVideoTileKeys}
        {fullscreenTileKey}
        {onMinimizeTile}
        {onToggleHideVideo}
        {onTogglePin}
        {onToggleTileFullscreen}
      />
    {/snippet}
  </StageGridArea>

  <button
    type="button"
    class="absolute right-3 top-3 z-30 inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    aria-label={stageFullscreen ? "Exit stage fullscreen" : "Fullscreen stage"}
    onclick={toggleStageFullscreen}
  >
    {#if stageFullscreen}
      <Minimize2Icon class="size-4" aria-hidden="true" />
    {:else}
      <Maximize2Icon class="size-4" aria-hidden="true" />
    {/if}
  </button>
</div>
