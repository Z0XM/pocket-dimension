<script lang="ts">
  import { onMount } from "svelte";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import type { Room } from "livekit-client";
  import type { ParticipantColor } from "$lib/participant-colors";
  import type { StageGridLayout, StageLayoutMode } from "$lib/stage-grid";
  import type { AutoLayoutPreset } from "$lib/call/auto-layout";
  import StageGridArea from "./StageGridArea.svelte";
  import VideoGrid from "./VideoGrid.svelte";
  import GridSettingsPanel from "./GridSettingsPanel.svelte";
  import type { DetectedGesture, HandLandmark } from "$lib/gestures/gesture-types";

  type Props = {
    room: Room;
    slug?: string;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    hideParticipantVideos?: boolean;
    hideNonVideoTiles?: boolean;
    disableSpeakingGlows?: boolean;
    layoutMode?: StageLayoutMode;
    autoLayoutPreset?: AutoLayoutPreset;
    galleryDensity?: number;
    sidebarSplitRatio?: number;
    pinnedTileKey?: string | null;
    bottomInset?: number;
    minimizedTileKeys?: string[];
    hiddenVideoTileKeys?: string[];
    fullscreenTileKey?: string | null;
    selfViewHidden?: boolean;
    onMinimizeTile?: (key: string) => void;
    onToggleHideVideo?: (key: string) => void;
    onToggleTileFullscreen?: (key: string) => void;
    onTogglePinTile?: (key: string) => void;
    showGridSettings?: boolean;
    showInCallDevices?: boolean;
    onLayoutModeChange?: (mode: StageLayoutMode) => void;
    onAutoLayoutPresetChange?: (preset: AutoLayoutPreset) => void;
    onHideNonVideoTilesChange?: (value: boolean) => void;
    onGalleryDensityChange?: (value: number) => void;
    onSidebarSplitRatioChange?: (value: number) => void;
    onHideSelfView?: () => void;
    onCloseGridSettings?: () => void;
    stageRef?: HTMLElement | null;
    trackingOverlayVisible?: boolean;
    handLandmarks?: HandLandmark[] | null;
    handGesture?: DetectedGesture;
    handGestureHoldProgress?: number;
  };

  let {
    room,
    slug = "",
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    localMicEnabled,
    localTileColor,
    hideParticipantVideos = false,
    hideNonVideoTiles = false,
    disableSpeakingGlows = false,
    layoutMode = "grid",
    autoLayoutPreset = "dynamic",
    galleryDensity = 5,
    sidebarSplitRatio = 0.72,
    pinnedTileKey = null,
    bottomInset = 0,
    minimizedTileKeys = [],
    hiddenVideoTileKeys = [],
    fullscreenTileKey = null,
    selfViewHidden = false,
    onMinimizeTile,
    onToggleHideVideo,
    onToggleTileFullscreen,
    onTogglePinTile,
    showGridSettings = false,
    showInCallDevices = false,
    onLayoutModeChange,
    onAutoLayoutPresetChange,
    onHideNonVideoTilesChange,
    onGalleryDensityChange,
    onSidebarSplitRatioChange,
    onHideSelfView,
    onCloseGridSettings,
    stageRef = $bindable(null),
    trackingOverlayVisible = false,
    handLandmarks = null,
    handGesture = "none",
    handGestureHoldProgress = 0,
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

<div bind:this={stageEl} class="stage-root relative size-full bg-background">
  <StageGridArea
    bottomInset={stageFullscreen ? 0 : bottomInset}
    fullscreen={stageFullscreen}
    showGridLines={layoutMode === "grid"}
    bind:layout={gridLayout}
  >
    {#snippet children({ layout })}
      <VideoGrid
        {room}
        {slug}
        {activeSpeakerIdentity}
        {audioLevels}
        {localDisplayName}
        {mediaRevision}
        gridLayout={layout}
        {layoutMode}
        {autoLayoutPreset}
        {galleryDensity}
        {sidebarSplitRatio}
        {pinnedTileKey}
        {localMicEnabled}
        {localTileColor}
        {hideParticipantVideos}
        {hideNonVideoTiles}
        {disableSpeakingGlows}
        {minimizedTileKeys}
        {hiddenVideoTileKeys}
        {fullscreenTileKey}
        {onMinimizeTile}
        {onToggleHideVideo}
        {onToggleTileFullscreen}
        {onTogglePinTile}
        {trackingOverlayVisible}
        {handLandmarks}
        {handGesture}
        {handGestureHoldProgress}
      />
    {/snippet}
  </StageGridArea>

  {#if showGridSettings && onLayoutModeChange && onAutoLayoutPresetChange && onCloseGridSettings}
    <GridSettingsPanel
      {layoutMode}
      {autoLayoutPreset}
      bottomInset={stageFullscreen ? 0 : bottomInset}
      {hideNonVideoTiles}
      {galleryDensity}
      {sidebarSplitRatio}
      {selfViewHidden}
      {onLayoutModeChange}
      {onAutoLayoutPresetChange}
      {onHideNonVideoTilesChange}
      {onGalleryDensityChange}
      {onSidebarSplitRatioChange}
      {onHideSelfView}
      onClose={onCloseGridSettings}
    />
  {/if}

  {#if !showGridSettings && !showInCallDevices}
    <button
      type="button"
      class="absolute right-3 top-3 z-30 inline-flex size-11 items-center justify-center rounded-md border border-border/70 bg-card/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring safe-top sm:size-8"
      aria-label={stageFullscreen ? "Exit stage fullscreen" : "Fullscreen stage"}
      onclick={toggleStageFullscreen}
    >
      {#if stageFullscreen}
        <Minimize2Icon class="size-4" aria-hidden="true" />
      {:else}
        <Maximize2Icon class="size-4" aria-hidden="true" />
      {/if}
    </button>
  {/if}
</div>

<style>
  .stage-root:fullscreen {
    width: 100%;
    height: 100%;
  }
</style>
