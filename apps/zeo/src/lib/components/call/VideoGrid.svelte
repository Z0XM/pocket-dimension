<script lang="ts">
  import type { Room } from "livekit-client";
  import { buildStageTiles, filterStageTiles, type StageTileEntry } from "$lib/call/stage-tiles";
  import { computeAutoLayoutFrames, type AutoLayoutPreset } from "$lib/call/auto-layout";
  import { computeGameLayoutFrames, teamColorByUserId } from "$lib/call/game-layout";
  import type { GameSnapshotTeam } from "$lib/server/game/types";
  import type { ListeningSnapshot } from "$lib/server/listening/types";
  import { gridPlacementsKey, readStored, writeStored } from "$lib/browser-storage";
  import { displayNameForParticipant } from "$lib/livekit/screen-share";
  import { tileColorForParticipant, type ParticipantColor } from "$lib/participant-colors";
  import {
    applySoftGridSnap,
    clampTilePixelSize,
    computeParticipantGrid,
    maxTilePixelSizeAtPlacement,
    placementFromPixelOffset,
    placementFromTilePosition,
    placementsOverlap,
    snapSizeToGrid,
    tilePosition,
    tilePositionFromPlacement,
    type GridCellPlacement,
    type StageGridLayout,
    type StageLayoutMode,
  } from "$lib/stage-grid";
  import type { LocalParticipant } from "livekit-client";
  import { isScreenShareActive, isScreenShareAudioActive, isScreenShareAudioAvailable } from "$lib/livekit/screen-share";
  import { isTileListenMuted, tileVolumeForKey } from "$lib/livekit/tile-listen-mute";
  import type { TileMediaStats } from "$lib/livekit/tile-stats";
  import GridTile from "./GridTile.svelte";
  import ParticipantTile from "./ParticipantTile.svelte";
  import ScreenShareTile from "./ScreenShareTile.svelte";
  import ListeningTile from "./ListeningTile.svelte";
  import TileActionBar from "./TileActionBar.svelte";
  import type { DetectedGesture, HandLandmark } from "$lib/gestures/gesture-types";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    gridLayout?: StageGridLayout | null;
    layoutMode?: StageLayoutMode;
    autoLayoutPreset?: AutoLayoutPreset;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    hideParticipantVideos?: boolean;
    hideNonVideoTiles?: boolean;
    disableSpeakingGlows?: boolean;
    slug?: string;
    galleryDensity?: number;
    sidebarSplitRatio?: number;
    pinnedTileKey?: string | null;
    minimizedTileKeys?: string[];
    hiddenVideoTileKeys?: string[];
    tileVolumes?: Record<string, number>;
    speakersEnabled?: boolean;
    showTileStats?: boolean;
    tileStats?: Record<string, TileMediaStats>;
    fullscreenTileKey?: string | null;
    onMinimizeTile?: (key: string) => void;
    onToggleHideVideo?: (key: string) => void;
    onToggleTileListenMute?: (key: string) => void;
    onTileVolumeChange?: (key: string, volume: number) => void;
    onToggleTileFullscreen?: (key: string) => void;
    onTogglePinTile?: (key: string) => void;
    onToggleLocalShareVideo?: () => void;
    onToggleLocalShareAudio?: () => void;
    trackingOverlayVisible?: boolean;
    handLandmarks?: HandLandmark[] | null;
    handGesture?: DetectedGesture;
    handGestureHoldProgress?: number;
    gameTeams?: GameSnapshotTeam[];
    listeningSnapshot?: ListeningSnapshot | null;
    listeningIsDj?: boolean;
    listeningBusy?: boolean;
    onListeningPlay?: () => void;
    onListeningPause?: () => void;
    onListeningSkip?: () => void;
    onListeningPrevious?: () => void;
    onListeningSeek?: (positionMs: number) => void;
  };

  const {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    gridLayout = null,
    layoutMode = "grid",
    autoLayoutPreset = "dynamic",
    localMicEnabled,
    localTileColor,
    hideParticipantVideos = false,
    hideNonVideoTiles = false,
    disableSpeakingGlows = false,
    slug = "",
    galleryDensity = 5,
    sidebarSplitRatio = 0.72,
    pinnedTileKey = null,
    minimizedTileKeys = [],
    hiddenVideoTileKeys = [],
    tileVolumes = {},
    speakersEnabled = true,
    showTileStats = true,
    tileStats = {},
    fullscreenTileKey = null,
    onMinimizeTile,
    onToggleHideVideo,
    onToggleTileListenMute,
    onTileVolumeChange,
    onToggleTileFullscreen,
    onTogglePinTile,
    onToggleLocalShareVideo,
    onToggleLocalShareAudio,
    trackingOverlayVisible = false,
    handLandmarks = null,
    handGesture = "none",
    handGestureHoldProgress = 0,
    gameTeams = [],
    listeningSnapshot = null,
    listeningIsDj = false,
    listeningBusy = false,
    onListeningPlay,
    onListeningPause,
    onListeningSkip,
    onListeningPrevious,
    onListeningSeek,
  }: Props = $props();

  const isManualGrid = $derived(layoutMode === "grid");
  const isGameLayout = $derived(layoutMode === "game");
  const listeningActive = $derived(Boolean(listeningSnapshot?.session && !listeningSnapshot.session.endedAt));

  const gridTiles = $derived.by((): StageTileEntry[] => {
    mediaRevision;
    return filterStageTiles(
      buildStageTiles(room, {
        listeningActive,
        listeningBotIdentity: listeningSnapshot?.session?.botIdentity ?? null,
      }),
      { hideNonVideo: hideNonVideoTiles }
    );
  });

  const stageTiles = $derived.by(() => {
    const minimized = new Set(minimizedTileKeys);
    return gridTiles.filter((tile) => !minimized.has(tile.key));
  });

  const tileLayoutSignature = $derived(gridTiles.map((tile) => tile.key).join("|"));

  let gridRoot = $state<HTMLElement | null>(null);
  let tilePlacements = $state<Record<string, GridCellPlacement>>({});
  let customTileSizes = $state<Record<string, { width: number; height: number }>>({});
  let previewSize = $state<{ key: string; width: number; height: number } | null>(null);
  let isResizing = $state(false);
  let layoutSignature = $state("");
  let dragState = $state<{
    key: string;
    startPlacement: GridCellPlacement;
    grabOffsetX: number;
    grabOffsetY: number;
    preview: GridCellPlacement;
  } | null>(null);

  const baseParticipantGrid = $derived.by(() => {
    if (!gridLayout || !isManualGrid) return null;
    return computeParticipantGrid(stageTiles.length, gridLayout);
  });

  const autoLayoutFrames = $derived.by(() => {
    if (isManualGrid || !gridLayout) return null;
    mediaRevision;
    return computeAutoLayoutFrames(stageTiles, gridLayout, autoLayoutPreset, activeSpeakerIdentity, {
      galleryDensity,
      sidebarSplitRatio,
      pinnedTileKey,
    });
  });

  const gameLayoutFrames = $derived.by(() => {
    if (!isGameLayout || !gridLayout) return null;
    mediaRevision;
    return computeGameLayoutFrames(stageTiles, gridLayout, gameTeams, autoLayoutPreset, activeSpeakerIdentity, {
      galleryDensity,
      sidebarSplitRatio,
      pinnedTileKey,
    });
  });

  const gameTeamColors = $derived(teamColorByUserId(gameTeams));

  const canRenderTiles = $derived(Boolean(gridLayout && (isGameLayout ? gameLayoutFrames : isManualGrid ? baseParticipantGrid : autoLayoutFrames)));

  $effect(() => {
    if (!isManualGrid) {
      isResizing = false;
      previewSize = null;
      dragState = null;
      customTileSizes = {};
      resetPlacements();
    }
  });

  $effect(() => {
    const signature = tileLayoutSignature;
    if (signature !== layoutSignature) {
      layoutSignature = signature;
      customTileSizes = {};
      previewSize = null;
      isResizing = false;
      dragState = null;
      resetPlacements();
    }
  });

  function readSavedPlacements() {
    if (!slug) return null;

    const raw = readStored(gridPlacementsKey(slug));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Record<string, GridCellPlacement>;
    } catch {
      return null;
    }
  }

  function resetPlacements() {
    if (!baseParticipantGrid || !gridLayout) {
      tilePlacements = {};
      return;
    }

    const saved = readSavedPlacements();
    const next: Record<string, GridCellPlacement> = {};

    for (const [index, tile] of stageTiles.entries()) {
      if (saved?.[tile.key]) {
        next[tile.key] = saved[tile.key];
      } else {
        next[tile.key] = placementFromTilePosition(tilePosition(baseParticipantGrid, index), gridLayout);
      }
    }

    tilePlacements = next;
  }

  $effect(() => {
    if (!isManualGrid || !slug || Object.keys(tilePlacements).length === 0) return;
    writeStored(gridPlacementsKey(slug), JSON.stringify(tilePlacements));
  });

  function defaultTileSize(key: string, index: number) {
    if (isResizing && previewSize?.key === key) {
      return { width: previewSize.width, height: previewSize.height };
    }

    if (customTileSizes[key]) return customTileSizes[key];
    if (!baseParticipantGrid) return null;

    const position = tilePosition(baseParticipantGrid, index);
    return { width: position.width, height: position.height };
  }

  function getPlacement(key: string, index: number): GridCellPlacement | null {
    if (!gridLayout || !baseParticipantGrid) return null;
    if (dragState?.key === key) return dragState.preview;
    if (tilePlacements[key]) return tilePlacements[key];

    return placementFromTilePosition(tilePosition(baseParticipantGrid, index), gridLayout);
  }

  function tileFrame(key: string, index: number) {
    if (fullscreenTileKey === key && gridLayout) {
      return {
        left: gridLayout.offsetX,
        top: gridLayout.offsetY,
        width: gridLayout.width,
        height: gridLayout.height,
      };
    }

    if (!gridLayout) return null;

    if (isGameLayout) {
      return gameLayoutFrames?.get(key) ?? null;
    }

    if (!isManualGrid) {
      return autoLayoutFrames?.[key] ?? null;
    }

    if (!baseParticipantGrid) return null;

    const placement = getPlacement(key, index);
    const size = defaultTileSize(key, index);
    if (!placement || !size) return null;

    return tilePositionFromPlacement(placement, size.width, size.height, gridLayout);
  }

  function displayNameFor(identity: string, name?: string) {
    if (identity === room.localParticipant.identity) return localDisplayName;
    return name || "Participant";
  }

  function tileVideoHidden(key: string) {
    return hiddenVideoTileKeys.includes(key);
  }

  function resizeLimits(key: string, index: number) {
    if (!gridLayout) return null;

    const placement = getPlacement(key, index);
    if (!placement) return null;

    return {
      maxSize: maxTilePixelSizeAtPlacement(gridLayout, placement),
      minSize: gridLayout.cellSize,
    };
  }

  function handleResizeStart(key: string, size: { width: number; height: number }) {
    isResizing = true;
    previewSize = {
      key,
      ...(customTileSizes[key] ?? size),
    };
  }

  function handleResize(key: string, index: number, widthPx: number, heightPx: number) {
    if (!gridLayout) return;

    const limits = resizeLimits(key, index);
    if (!limits) return;

    const clamped = clampTilePixelSize(widthPx, heightPx, limits.maxSize.width, limits.maxSize.height, limits.minSize);

    previewSize = {
      key,
      ...applySoftGridSnap(clamped.width, clamped.height, gridLayout.cellSize),
    };
  }

  function handleResizeEnd(key: string, index: number, widthPx: number, heightPx: number) {
    if (!gridLayout) {
      isResizing = false;
      previewSize = null;
      return;
    }

    const limits = resizeLimits(key, index);
    if (!limits) {
      isResizing = false;
      previewSize = null;
      return;
    }

    const clamped = clampTilePixelSize(widthPx, heightPx, limits.maxSize.width, limits.maxSize.height, limits.minSize);

    customTileSizes = {
      ...customTileSizes,
      [key]: snapSizeToGrid(clamped.width, clamped.height, gridLayout.cellSize),
    };
    isResizing = false;
    previewSize = null;
  }

  function handleMoveStart(key: string, index: number, event: PointerEvent) {
    if (isResizing || fullscreenTileKey === key || !gridRoot || !gridLayout) return;

    const frame = tileFrame(key, index);
    const placement = getPlacement(key, index);
    if (!frame || !placement) return;

    const rect = gridRoot.getBoundingClientRect();
    dragState = {
      key,
      startPlacement: placement,
      grabOffsetX: event.clientX - rect.left - frame.left,
      grabOffsetY: event.clientY - rect.top - frame.top,
      preview: placement,
    };
  }

  function handleMove(key: string, index: number, event: PointerEvent) {
    if (!dragState || dragState.key !== key || !gridRoot || !gridLayout) return;

    const size = defaultTileSize(key, index);
    if (!size) return;

    const rect = gridRoot.getBoundingClientRect();
    const leftPx = event.clientX - rect.left - dragState.grabOffsetX;
    const topPx = event.clientY - rect.top - dragState.grabOffsetY;

    dragState = {
      ...dragState,
      preview: placementFromPixelOffset(leftPx, topPx, size.width, size.height, gridLayout, { softSnap: true }),
    };
  }

  function handleMoveEnd(key: string, index: number) {
    if (!dragState || dragState.key !== key || !gridLayout) {
      dragState = null;
      return;
    }

    const size = defaultTileSize(key, index);
    if (!size) {
      dragState = null;
      return;
    }

    const frame = tileFrame(key, index);
    if (!frame) {
      dragState = null;
      return;
    }

    const finalPlacement = placementFromPixelOffset(frame.left, frame.top, size.width, size.height, gridLayout, { softSnap: false });

    const overlapsOther = stageTiles.some((tile, otherIndex) => {
      if (tile.key === key) return false;

      const otherPlacement = tilePlacements[tile.key] ?? getPlacement(tile.key, otherIndex);
      const otherSize = defaultTileSize(tile.key, otherIndex);
      if (!otherPlacement || !otherSize) return false;

      return placementsOverlap(finalPlacement, size, otherPlacement, otherSize, gridLayout.cellSize);
    });

    if (!overlapsOther) {
      tilePlacements = { ...tilePlacements, [key]: finalPlacement };
    }

    dragState = null;
  }
</script>

<div bind:this={gridRoot} class="relative size-full {isManualGrid ? 'touch-none select-none' : ''}">
  {#if canRenderTiles}
    {#each stageTiles as tile, index (tile.key)}
      {#if !fullscreenTileKey || fullscreenTileKey === tile.key}
        {@const position = tileFrame(tile.key, index)}
        {#if position}
          <GridTile
            left={position.left}
            top={position.top}
            width={position.width}
            height={position.height}
            draggable={isManualGrid && !isResizing && fullscreenTileKey !== tile.key}
            fullscreen={fullscreenTileKey === tile.key}
            onMoveStart={isManualGrid ? (event) => handleMoveStart(tile.key, index, event) : undefined}
            onMove={isManualGrid ? (event) => handleMove(tile.key, index, event) : undefined}
            onMoveEnd={isManualGrid ? () => handleMoveEnd(tile.key, index) : undefined}
            onResizeStart={isManualGrid && fullscreenTileKey !== tile.key ? (size) => handleResizeStart(tile.key, size) : undefined}
            onResize={isManualGrid && fullscreenTileKey !== tile.key
              ? (widthPx, heightPx) => handleResize(tile.key, index, widthPx, heightPx)
              : undefined}
            onResizeEnd={isManualGrid && fullscreenTileKey !== tile.key
              ? (widthPx, heightPx) => handleResizeEnd(tile.key, index, widthPx, heightPx)
              : undefined}
          >
            {#snippet actions()}
              <TileActionBar
                videoHidden={tileVideoHidden(tile.key)}
                fullscreen={fullscreenTileKey === tile.key}
                pinned={pinnedTileKey === tile.key}
                showPin={!isManualGrid}
                showAudioMute={tile.participant.identity !== room.localParticipant.identity}
                audioMuted={isTileListenMuted(tileVolumes, tile.key)}
                onMinimize={() => onMinimizeTile?.(tile.key)}
                onTogglePin={() => onTogglePinTile?.(tile.key)}
                onToggleAudioMute={() => onToggleTileListenMute?.(tile.key)}
                onToggleHideVideo={() => onToggleHideVideo?.(tile.key)}
                onToggleFullscreen={() => onToggleTileFullscreen?.(tile.key)}
              />
            {/snippet}

            {#if tile.kind === "listening"}
              <ListeningTile
                snapshot={listeningSnapshot}
                isDj={listeningIsDj}
                busy={listeningBusy}
                audioLevel={audioLevels[tile.participant.identity] ?? audioLevels[tile.key] ?? 0}
                listenVolume={tileVolumeForKey(tileVolumes, tile.key)}
                {speakersEnabled}
                onPlay={onListeningPlay}
                onPause={onListeningPause}
                onSkip={onListeningSkip}
                onPrevious={onListeningPrevious}
                onSeek={onListeningSeek}
                onListenVolumeChange={(volume) => onTileVolumeChange?.(tile.key, volume)}
              />
            {:else if tile.kind === "screen-share"}
              {@const isLocalShare = tile.participant.identity === room.localParticipant.identity}
              {@const localShareParticipant = isLocalShare ? (tile.participant as LocalParticipant) : null}
              <ScreenShareTile
                participant={tile.participant}
                displayName={displayNameForParticipant(tile.participant, room.localParticipant.identity, localDisplayName)}
                isLocal={isLocalShare}
                hidden={tileVideoHidden(tile.key)}
                audioOnly={tile.audioOnly}
                showStats={showTileStats}
                stats={tileStats[tile.key]}
                audioLevel={audioLevels[tile.key] ?? 0}
                listenVolume={tileVolumeForKey(tileVolumes, tile.key)}
                {speakersEnabled}
                onListenVolumeChange={isLocalShare ? undefined : (volume) => onTileVolumeChange?.(tile.key, volume)}
                shareVideoEnabled={localShareParticipant ? isScreenShareActive(localShareParticipant) : !tile.audioOnly}
                shareAudioEnabled={localShareParticipant ? isScreenShareAudioActive(localShareParticipant) : false}
                shareAudioAvailable={localShareParticipant
                  ? isScreenShareAudioAvailable(localShareParticipant) || isScreenShareAudioActive(localShareParticipant)
                  : false}
                onToggleShareVideo={isLocalShare ? onToggleLocalShareVideo : undefined}
                onToggleShareAudio={isLocalShare ? onToggleLocalShareAudio : undefined}
              />
            {:else}
              {@const isLocalTile = tile.participant.identity === room.localParticipant.identity}
              <ParticipantTile
                participant={tile.participant}
                displayName={displayNameFor(tile.participant.identity, tile.participant.name)}
                isActiveSpeaker={activeSpeakerIdentity === tile.participant.identity}
                audioLevel={audioLevels[tile.participant.identity] ?? 0}
                tileColor={tileColorForParticipant(tile.participant.identity, {
                  localIdentity: room.localParticipant.identity,
                  preferredColor: localTileColor,
                })}
                teamOutlineColor={isGameLayout ? (gameTeamColors.get(tile.participant.identity) ?? null) : null}
                isLocal={isLocalTile}
                localMicEnabled={isLocalTile ? localMicEnabled : undefined}
                hideVideos={hideParticipantVideos || tileVideoHidden(tile.key)}
                {disableSpeakingGlows}
                {mediaRevision}
                fitContainer
                trackingOverlayVisible={trackingOverlayVisible && isLocalTile}
                handLandmarks={isLocalTile ? handLandmarks : null}
                handGesture={isLocalTile ? handGesture : "none"}
                handGestureHoldProgress={isLocalTile ? handGestureHoldProgress : 0}
                showStats={showTileStats}
                stats={tileStats[tile.key]}
                listenVolume={tileVolumeForKey(tileVolumes, tile.key)}
                {speakersEnabled}
                onListenVolumeChange={isLocalTile ? undefined : (volume) => onTileVolumeChange?.(tile.key, volume)}
              />
            {/if}
          </GridTile>
        {/if}
      {/if}
    {/each}
  {/if}
</div>
