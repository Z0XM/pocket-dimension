<script lang="ts">
  import type { Room } from "livekit-client";
  import { listRoomParticipants } from "$lib/livekit/room-client";
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

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    gridLayout?: StageGridLayout | null;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
    hideParticipantVideos?: boolean;
    disableSpeakingGlows?: boolean;
  };

  const {
    room,
    activeSpeakerIdentity,
    audioLevels,
    localDisplayName,
    gridLayout = null,
    localMicEnabled,
    localTileColor,
    hideParticipantVideos = false,
    disableSpeakingGlows = false,
  }: Props = $props();

  const participants = $derived(listRoomParticipants(room));

  let gridRoot = $state<HTMLElement | null>(null);
  let tilePlacements = $state<Record<string, GridCellPlacement>>({});
  let customTileSize = $state<{ width: number; height: number } | null>(null);
  let previewSize = $state<{ width: number; height: number } | null>(null);
  let isResizing = $state(false);
  let participantCount = $state(0);
  let dragState = $state<{
    identity: string;
    startPlacement: GridCellPlacement;
    grabOffsetX: number;
    grabOffsetY: number;
    preview: GridCellPlacement;
  } | null>(null);

  const baseParticipantGrid = $derived.by(() => {
    if (!gridLayout) return null;
    return computeParticipantGrid(participants.length, gridLayout);
  });

  $effect(() => {
    const count = participants.length;
    if (count !== participantCount) {
      participantCount = count;
      customTileSize = null;
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
    for (const [index, participant] of participants.entries()) {
      next[participant.identity] = placementFromTilePosition(tilePosition(baseParticipantGrid, index), gridLayout);
    }
    tilePlacements = next;
  }

  function defaultTileSize(index = 0) {
    if (customTileSize) return customTileSize;
    if (!baseParticipantGrid) return null;
    const position = tilePosition(baseParticipantGrid, index);
    return { width: position.width, height: position.height };
  }

  function getPlacement(identity: string, index: number): GridCellPlacement | null {
    if (!gridLayout || !baseParticipantGrid) return null;
    if (dragState?.identity === identity) return dragState.preview;
    if (tilePlacements[identity]) return tilePlacements[identity];

    return placementFromTilePosition(tilePosition(baseParticipantGrid, index), gridLayout);
  }

  function getTileSize(index: number) {
    if (isResizing && previewSize) return previewSize;
    return defaultTileSize(index);
  }

  function tileFrame(identity: string, index: number) {
    const placement = getPlacement(identity, index);
    const size = getTileSize(index);
    if (!placement || !size || !gridLayout) return null;

    return tilePositionFromPlacement(placement, size.width, size.height, gridLayout);
  }

  function displayNameFor(identity: string, name?: string) {
    if (identity === room.localParticipant.identity) return localDisplayName;
    return name || "Participant";
  }

  function resizeLimits(identity: string, index: number) {
    if (!gridLayout) return null;

    const placement = getPlacement(identity, index);
    if (!placement) return null;

    return {
      maxSize: maxTilePixelSizeAtPlacement(gridLayout, placement),
      minSize: gridLayout.cellSize,
    };
  }

  function handleResizeStart(size: { width: number; height: number }) {
    isResizing = true;
    previewSize = customTileSize ?? size;
  }

  function handleResize(widthPx: number, heightPx: number, identity: string, index: number) {
    if (!gridLayout) return;

    const limits = resizeLimits(identity, index);
    if (!limits) return;

    const clamped = clampTilePixelSize(widthPx, heightPx, limits.maxSize.width, limits.maxSize.height, limits.minSize);

    previewSize = applySoftGridSnap(clamped.width, clamped.height, gridLayout.cellSize);
  }

  function handleResizeEnd(widthPx: number, heightPx: number, identity: string, index: number) {
    if (!gridLayout) {
      isResizing = false;
      previewSize = null;
      return;
    }

    const limits = resizeLimits(identity, index);
    if (!limits) {
      isResizing = false;
      previewSize = null;
      return;
    }

    const clamped = clampTilePixelSize(widthPx, heightPx, limits.maxSize.width, limits.maxSize.height, limits.minSize);

    customTileSize = snapSizeToGrid(clamped.width, clamped.height, gridLayout.cellSize);
    isResizing = false;
    previewSize = null;
  }

  function handleMoveStart(identity: string, index: number, event: PointerEvent) {
    if (isResizing || !gridRoot || !gridLayout) return;

    const frame = tileFrame(identity, index);
    const placement = getPlacement(identity, index);
    if (!frame || !placement) return;

    const rect = gridRoot.getBoundingClientRect();
    dragState = {
      identity,
      startPlacement: placement,
      grabOffsetX: event.clientX - rect.left - frame.left,
      grabOffsetY: event.clientY - rect.top - frame.top,
      preview: placement,
    };
  }

  function handleMove(identity: string, index: number, event: PointerEvent) {
    if (!dragState || dragState.identity !== identity || !gridRoot || !gridLayout) return;

    const size = getTileSize(index);
    if (!size) return;

    const rect = gridRoot.getBoundingClientRect();
    const leftPx = event.clientX - rect.left - dragState.grabOffsetX;
    const topPx = event.clientY - rect.top - dragState.grabOffsetY;

    dragState = {
      ...dragState,
      preview: placementFromPixelOffset(leftPx, topPx, size.width, size.height, gridLayout, { softSnap: true }),
    };
  }

  function handleMoveEnd(identity: string, index: number) {
    if (!dragState || dragState.identity !== identity || !gridLayout) {
      dragState = null;
      return;
    }

    const size = getTileSize(index);
    if (!size) {
      dragState = null;
      return;
    }

    const frame = tileFrame(identity, index);
    if (!frame) {
      dragState = null;
      return;
    }

    const finalPlacement = placementFromPixelOffset(frame.left, frame.top, size.width, size.height, gridLayout, { softSnap: false });

    const overlapsOther = participants.some((participant) => {
      if (participant.identity === identity) return false;

      const otherIndex = participants.findIndex((entry) => entry.identity === participant.identity);
      const otherPlacement = tilePlacements[participant.identity] ?? getPlacement(participant.identity, otherIndex);
      const otherSize = defaultTileSize(otherIndex);
      if (!otherPlacement || !otherSize) return false;

      return placementsOverlap(finalPlacement, size, otherPlacement, otherSize, gridLayout.cellSize);
    });

    if (!overlapsOther) {
      tilePlacements = { ...tilePlacements, [identity]: finalPlacement };
    }

    dragState = null;
  }
</script>

<div bind:this={gridRoot} class="relative size-full">
  {#if baseParticipantGrid && gridLayout}
    {#each participants as participant, index (participant.identity)}
      {@const position = tileFrame(participant.identity, index)}
      {#if position}
        <GridTile
          left={position.left}
          top={position.top}
          width={position.width}
          height={position.height}
          draggable={!isResizing}
          onMoveStart={(event) => handleMoveStart(participant.identity, index, event)}
          onMove={(event) => handleMove(participant.identity, index, event)}
          onMoveEnd={() => handleMoveEnd(participant.identity, index)}
          onResizeStart={handleResizeStart}
          onResize={(widthPx, heightPx) => handleResize(widthPx, heightPx, participant.identity, index)}
          onResizeEnd={(widthPx, heightPx) => handleResizeEnd(widthPx, heightPx, participant.identity, index)}
        >
          <ParticipantTile
            {participant}
            displayName={displayNameFor(participant.identity, participant.name)}
            isActiveSpeaker={activeSpeakerIdentity === participant.identity}
            audioLevel={audioLevels[participant.identity] ?? 0}
            tileColor={tileColorForParticipant(participant.identity, {
              localIdentity: room.localParticipant.identity,
              preferredColor: localTileColor,
            })}
            isGuest={participant.identity.startsWith("guest_")}
            isLocal={participant.identity === room.localParticipant.identity}
            localMicEnabled={participant.identity === room.localParticipant.identity ? localMicEnabled : undefined}
            hideVideos={hideParticipantVideos}
            {disableSpeakingGlows}
            fitContainer
          />
        </GridTile>
      {/if}
    {/each}
  {/if}
</div>
