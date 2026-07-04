<script lang="ts">
  import type { Room } from "livekit-client";
  import { buildStageTiles, type StageTileEntry } from "$lib/call/stage-tiles";
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
  } from "$lib/stage-grid";
  import GridTile from "./GridTile.svelte";
  import ParticipantTile from "./ParticipantTile.svelte";
  import ScreenShareTile from "./ScreenShareTile.svelte";
  import TileActionBar from "./TileActionBar.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    mediaRevision?: number;
    gridLayout?: StageGridLayout | null;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    hideParticipantVideos?: boolean;
    disableSpeakingGlows?: boolean;
    minimizedTileKeys?: string[];
    pinnedTileKeys?: string[];
    hiddenVideoTileKeys?: string[];
    fullscreenTileKey?: string | null;
    onMinimizeTile?: (key: string) => void;
    onToggleHideVideo?: (key: string) => void;
    onTogglePin?: (key: string) => void;
    onToggleTileFullscreen?: (key: string) => void;
  };

  const {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    mediaRevision = 0,
    gridLayout = null,
    localMicEnabled,
    localTileColor,
    hideParticipantVideos = false,
    disableSpeakingGlows = false,
    minimizedTileKeys = [],
    pinnedTileKeys = [],
    hiddenVideoTileKeys = [],
    fullscreenTileKey = null,
    onMinimizeTile,
    onToggleHideVideo,
    onTogglePin,
    onToggleTileFullscreen,
  }: Props = $props();

  const gridTiles = $derived.by((): StageTileEntry[] => {
    mediaRevision;
    return buildStageTiles(room);
  });

  const stageTiles = $derived.by(() => {
    const minimized = new Set(minimizedTileKeys);
    const pinned = new Set(pinnedTileKeys);

    return gridTiles
      .filter((tile) => !minimized.has(tile.key))
      .sort((a, b) => {
        const aPinned = pinned.has(a.key);
        const bPinned = pinned.has(b.key);
        if (aPinned === bPinned) return 0;
        return aPinned ? 1 : -1;
      });
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
    if (!gridLayout) return null;
    return computeParticipantGrid(stageTiles.length, gridLayout);
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

  function resetPlacements() {
    if (!baseParticipantGrid || !gridLayout) {
      tilePlacements = {};
      return;
    }

    const next: Record<string, GridCellPlacement> = {};
    for (const [index, tile] of stageTiles.entries()) {
      next[tile.key] = placementFromTilePosition(tilePosition(baseParticipantGrid, index), gridLayout);
    }
    tilePlacements = next;
  }

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

    const placement = getPlacement(key, index);
    const size = defaultTileSize(key, index);
    if (!placement || !size || !gridLayout) return null;

    return tilePositionFromPlacement(placement, size.width, size.height, gridLayout);
  }

  function displayNameFor(identity: string, name?: string) {
    if (identity === room.localParticipant.identity) return localDisplayName;
    return name || "Participant";
  }

  function tileVideoHidden(key: string) {
    return hiddenVideoTileKeys.includes(key);
  }

  function tilePinned(key: string) {
    return pinnedTileKeys.includes(key);
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

<div bind:this={gridRoot} class="relative size-full">
  {#if baseParticipantGrid && gridLayout}
    {#each stageTiles as tile, index (tile.key)}
      {#if !fullscreenTileKey || fullscreenTileKey === tile.key}
        {@const position = tileFrame(tile.key, index)}
        {#if position}
          <GridTile
            left={position.left}
            top={position.top}
            width={position.width}
            height={position.height}
            draggable={!isResizing && fullscreenTileKey !== tile.key}
            elevated={tilePinned(tile.key)}
            fullscreen={fullscreenTileKey === tile.key}
            onMoveStart={(event) => handleMoveStart(tile.key, index, event)}
            onMove={(event) => handleMove(tile.key, index, event)}
            onMoveEnd={() => handleMoveEnd(tile.key, index)}
            onResizeStart={fullscreenTileKey === tile.key ? undefined : (size) => handleResizeStart(tile.key, size)}
            onResize={fullscreenTileKey === tile.key ? undefined : (widthPx, heightPx) => handleResize(tile.key, index, widthPx, heightPx)}
            onResizeEnd={fullscreenTileKey === tile.key ? undefined : (widthPx, heightPx) => handleResizeEnd(tile.key, index, widthPx, heightPx)}
          >
            {#snippet actions()}
              <TileActionBar
                videoHidden={tileVideoHidden(tile.key)}
                pinned={tilePinned(tile.key)}
                fullscreen={fullscreenTileKey === tile.key}
                onMinimize={() => onMinimizeTile?.(tile.key)}
                onToggleHideVideo={() => onToggleHideVideo?.(tile.key)}
                onTogglePin={() => onTogglePin?.(tile.key)}
                onToggleFullscreen={() => onToggleTileFullscreen?.(tile.key)}
              />
            {/snippet}

            {#if tile.kind === "screen-share"}
              <ScreenShareTile
                participant={tile.participant}
                displayName={displayNameForParticipant(tile.participant, room.localParticipant.identity, localDisplayName)}
                isLocal={tile.participant.identity === room.localParticipant.identity}
                hidden={tileVideoHidden(tile.key)}
              />
            {:else}
              <ParticipantTile
                participant={tile.participant}
                displayName={displayNameFor(tile.participant.identity, tile.participant.name)}
                isActiveSpeaker={activeSpeakerIdentity === tile.participant.identity}
                audioLevel={audioLevels[tile.participant.identity] ?? 0}
                tileColor={tileColorForParticipant(tile.participant.identity, {
                  localIdentity: room.localParticipant.identity,
                  preferredColor: localTileColor,
                })}
                isGuest={tile.participant.identity.startsWith("guest_")}
                isLocal={tile.participant.identity === room.localParticipant.identity}
                localMicEnabled={tile.participant.identity === room.localParticipant.identity ? localMicEnabled : undefined}
                hideVideos={hideParticipantVideos || tileVideoHidden(tile.key)}
                {disableSpeakingGlows}
                fitContainer
              />
            {/if}
          </GridTile>
        {/if}
      {/if}
    {/each}
  {/if}
</div>
