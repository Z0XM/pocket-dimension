<script lang="ts">
  import type { Room } from "livekit-client";
  import { appendDemoStageTiles, buildStageTiles, filterStageTiles, type StageTileEntry } from "$lib/call/stage-tiles";
  import { computeAutoLayoutFrames, type AutoLayoutPreset } from "$lib/call/auto-layout";
  import { computeGameLayoutFrames, teamColorByUserId } from "$lib/call/game-layout";
  import type { GameSnapshotTeam } from "$lib/server/game/types";
  import type { ListeningSnapshot } from "$lib/server/listening/types";
  import { gridPlacementsKey, readStored, writeStored } from "$lib/browser-storage";
  import { displayNameForParticipant } from "$lib/livekit/screen-share";
  import { initialsForName } from "$lib/livekit/types";
  import { PARTICIPANT_COLORS, tileColorForParticipant, type ParticipantColor } from "$lib/participant-colors";
  import {
    applySoftGridSnap,
    clampTilePixelSize,
    computeParticipantGrid,
    findCenteredPlacement,
    maxTilePixelSizeAtPlacement,
    placementFromPixelOffset,
    placementFromTilePosition,
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
    sidebarSplitRatio?: number;
    speakerMainRatio?: number;
    pinnedTileKeys?: string[];
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
    onListeningSnapshot?: (snapshot: ListeningSnapshot | null) => void;
    /** Dev-only placeholder tiles for layout testing. */
    demoTileCount?: number;
  };

  const {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    gridLayout = null,
    layoutMode = "grid",
    autoLayoutPreset = "gallery",
    localMicEnabled,
    localTileColor,
    hideParticipantVideos = false,
    hideNonVideoTiles = false,
    disableSpeakingGlows = false,
    slug = "",
    sidebarSplitRatio = 0.72,
    speakerMainRatio = 0.72,
    pinnedTileKeys = [],
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
    onListeningSnapshot,
    demoTileCount = 0,
  }: Props = $props();

  const isManualGrid = $derived(layoutMode === "grid");
  const isGameLayout = $derived(layoutMode === "game");
  const listeningActive = $derived(Boolean(listeningSnapshot?.session && !listeningSnapshot.session.endedAt));

  const gridTiles = $derived.by((): StageTileEntry[] => {
    mediaRevision;
    demoTileCount;
    const realTiles = filterStageTiles(
      buildStageTiles(room, {
        listeningActive,
        listeningBotIdentity: listeningSnapshot?.session?.botIdentity ?? null,
      }),
      { hideNonVideo: hideNonVideoTiles }
    );
    return appendDemoStageTiles(realTiles, room, demoTileCount);
  });

  const stageTiles = $derived.by(() => {
    const minimized = new Set(minimizedTileKeys);
    return gridTiles.filter((tile) => !minimized.has(tile.key));
  });

  let gridRoot = $state<HTMLElement | null>(null);
  let tilePlacements = $state<Record<string, GridCellPlacement>>({});
  let customTileSizes = $state<Record<string, { width: number; height: number }>>({});
  let previewSize = $state<{ key: string; width: number; height: number } | null>(null);
  let isResizing = $state(false);
  /** Sorted stage-tile key set last synced for manual grid (join/leave incremental). */
  let layoutKeysSignature = $state("");
  let dragState = $state<{
    key: string;
    startPlacement: GridCellPlacement;
    grabOffsetX: number;
    grabOffsetY: number;
    preview: GridCellPlacement;
  } | null>(null);

  const baseParticipantGrid = $derived.by(() => {
    if (!gridLayout || !isManualGrid) return null;
    // Packing for the *current* count — only used for cold-start layout / default size hints.
    return computeParticipantGrid(stageTiles.length, gridLayout);
  });

  const singleTileGrid = $derived.by(() => {
    if (!gridLayout || !isManualGrid) return null;
    return computeParticipantGrid(1, gridLayout);
  });

  const autoLayoutFrames = $derived.by(() => {
    if (isManualGrid || !gridLayout || stageTiles.length === 0) return null;
    mediaRevision;
    return computeAutoLayoutFrames(stageTiles, gridLayout, autoLayoutPreset, activeSpeakerIdentity, {
      sidebarSplitRatio,
      speakerMainRatio,
      pinnedTileKeys,
    });
  });

  const gameLayoutFrames = $derived.by(() => {
    if (!isGameLayout || !gridLayout || stageTiles.length === 0) return null;
    mediaRevision;
    return computeGameLayoutFrames(stageTiles, gridLayout, gameTeams, autoLayoutPreset, activeSpeakerIdentity, {
      sidebarSplitRatio,
      speakerMainRatio,
      pinnedTileKeys,
    });
  });

  const pinControlsEnabled = $derived(layoutMode === "auto" && (autoLayoutPreset === "speaker" || autoLayoutPreset === "sidebar"));

  const gameTeamColors = $derived(teamColorByUserId(gameTeams));

  const canRenderTiles = $derived(Boolean(gridLayout && (isGameLayout ? gameLayoutFrames : isManualGrid ? baseParticipantGrid : autoLayoutFrames)));

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

  function packingSizeAt(index: number) {
    if (!baseParticipantGrid) return null;
    const position = tilePosition(baseParticipantGrid, index);
    return { width: position.width, height: position.height };
  }

  function defaultNewTileSize(sizes: Record<string, { width: number; height: number }>) {
    const existing = Object.values(sizes);
    if (existing.length > 0) {
      return { ...existing[existing.length - 1] };
    }
    if (singleTileGrid) {
      const position = tilePosition(singleTileGrid, 0);
      return { width: position.width, height: position.height };
    }
    if (!gridLayout) return { width: 160, height: 90 };
    return { width: gridLayout.cellSize * 4, height: gridLayout.cellSize * 3 };
  }

  function initializeManualGridPlacements() {
    if (!baseParticipantGrid || !gridLayout) {
      tilePlacements = {};
      customTileSizes = {};
      return;
    }

    const saved = readSavedPlacements();
    const nextPlacements: Record<string, GridCellPlacement> = {};
    const nextSizes: Record<string, { width: number; height: number }> = {};

    for (const [index, tile] of stageTiles.entries()) {
      const packedSize = packingSizeAt(index) ?? defaultNewTileSize(nextSizes);
      nextSizes[tile.key] = packedSize;

      if (saved?.[tile.key]) {
        nextPlacements[tile.key] = saved[tile.key];
      } else {
        nextPlacements[tile.key] = placementFromTilePosition(tilePosition(baseParticipantGrid, index), gridLayout);
      }
    }

    tilePlacements = nextPlacements;
    customTileSizes = nextSizes;
  }

  function syncManualGridPlacements() {
    if (!baseParticipantGrid || !gridLayout) return;

    // Membership follows grid tiles (including minimized) so minimize/restore
    // keeps the previous placement instead of treating restore as a newcomer.
    const memberKeys = gridTiles.map((tile) => tile.key);
    const memberKeySet = new Set(memberKeys);
    const existingKeys = Object.keys(tilePlacements);

    // Cold start / returning to grid mode with empty state.
    if (existingKeys.length === 0) {
      initializeManualGridPlacements();
      return;
    }

    let nextPlacements = { ...tilePlacements };
    let nextSizes = { ...customTileSizes };
    let changed = false;

    for (const key of existingKeys) {
      if (!memberKeySet.has(key)) {
        delete nextPlacements[key];
        delete nextSizes[key];
        changed = true;
      }
    }

    for (const key of Object.keys(nextSizes)) {
      if (!memberKeySet.has(key)) {
        delete nextSizes[key];
        changed = true;
      }
    }

    // Snapshot sizes for existing tiles that somehow lack a stored size.
    for (const [index, tile] of stageTiles.entries()) {
      if (nextPlacements[tile.key] && !nextSizes[tile.key]) {
        nextSizes[tile.key] = packingSizeAt(index) ?? defaultNewTileSize(nextSizes);
        changed = true;
      }
    }

    // Only place visible tiles that don't already have a spot.
    const newcomers = stageTiles.filter((tile) => !nextPlacements[tile.key]);
    if (newcomers.length > 0) {
      for (const tile of newcomers) {
        const size = defaultNewTileSize(nextSizes);
        // Avoid overlapping other visible tiles (minimized placements can be reused).
        const occupied = stageTiles
          .filter((other) => other.key !== tile.key && nextPlacements[other.key])
          .map((other) => ({
            placement: nextPlacements[other.key],
            size: nextSizes[other.key] ?? size,
          }));
        nextPlacements[tile.key] = findCenteredPlacement(gridLayout, size, occupied);
        nextSizes[tile.key] = size;
        changed = true;
      }
    }

    if (changed) {
      tilePlacements = nextPlacements;
      customTileSizes = nextSizes;
    }
  }

  $effect(() => {
    if (!isManualGrid) {
      layoutKeysSignature = "";
      isResizing = false;
      previewSize = null;
      dragState = null;
      customTileSizes = {};
      tilePlacements = {};
      return;
    }

    if (!gridLayout) return;
    if (stageTiles.length === 0) {
      layoutKeysSignature = "";
      tilePlacements = {};
      customTileSizes = {};
      return;
    }
    if (!baseParticipantGrid) return;

    const memberKeys = gridTiles.map((tile) => tile.key);
    const signature = [...memberKeys].sort().join("|");
    const visibleMissing = stageTiles.some((tile) => !tilePlacements[tile.key]);
    const extras = Object.keys(tilePlacements).some((key) => !memberKeys.includes(key));

    if (signature === layoutKeysSignature && !visibleMissing && !extras) return;

    layoutKeysSignature = signature;
    previewSize = null;
    isResizing = false;
    dragState = null;
    syncManualGridPlacements();
  });

  $effect(() => {
    if (!isManualGrid || !slug || Object.keys(tilePlacements).length === 0) return;
    writeStored(gridPlacementsKey(slug), JSON.stringify(tilePlacements));
  });

  function defaultTileSize(key: string, index: number) {
    if (isResizing && previewSize?.key === key) {
      return { width: previewSize.width, height: previewSize.height };
    }

    if (customTileSizes[key]) return customTileSizes[key];

    const packed = packingSizeAt(index);
    if (packed) return packed;

    if (singleTileGrid) {
      const position = tilePosition(singleTileGrid, 0);
      return { width: position.width, height: position.height };
    }

    return null;
  }

  function getPlacement(key: string, _index: number): GridCellPlacement | null {
    if (!gridLayout) return null;
    if (dragState?.key === key) return dragState.preview;
    if (tilePlacements[key]) return tilePlacements[key];
    return null;
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

  function demoTileColor(index: number) {
    return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
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
    tilePlacements = { ...tilePlacements, [key]: finalPlacement };
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
                pinned={pinnedTileKeys.includes(tile.key)}
                showPin={pinControlsEnabled}
                showAudioMute={tile.participant.identity !== room.localParticipant.identity}
                audioMuted={isTileListenMuted(tileVolumes, tile.key)}
                onMinimize={() => onMinimizeTile?.(tile.key)}
                onTogglePin={() => onTogglePinTile?.(tile.key)}
                onToggleAudioMute={() => onToggleTileListenMute?.(tile.key)}
                onToggleHideVideo={() => onToggleHideVideo?.(tile.key)}
                onToggleFullscreen={() => onToggleTileFullscreen?.(tile.key)}
              />
            {/snippet}

            {#if tile.kind === "demo"}
              {@const color = demoTileColor(index)}
              {@const name = tile.label ?? `Demo ${index + 1}`}
              <div class="relative flex size-full items-center justify-center overflow-hidden rounded-[inherit]" style="background: {color}22;">
                <div
                  class="flex size-[min(42%,5.5rem)] items-center justify-center rounded-full text-lg font-semibold text-white shadow-sm sm:text-xl"
                  style="background: {color};"
                >
                  {initialsForName(name)}
                </div>
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
                  <p class="truncate text-xs font-medium text-white sm:text-sm">{name}</p>
                  <p class="text-[10px] text-white/70">Temporary tile</p>
                </div>
              </div>
            {:else if tile.kind === "listening"}
              <ListeningTile
                snapshot={listeningSnapshot}
                {slug}
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
                onSnapshot={onListeningSnapshot}
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
