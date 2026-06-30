<script lang="ts">
  import type { Room } from "livekit-client";
  import "gridstack/dist/gridstack.min.css";
  import { listRoomParticipants } from "$lib/livekit/room-client";
  import { participantColorForIdentity } from "$lib/participant-colors";
  import { computeGridMetrics } from "$lib/call/grid/metrics";
  import { mergeParticipantLayout, layoutFromGridNodes } from "$lib/call/grid/default-layout";
  import {
    createTileGridEngine,
    registerGridWidgets,
    setGridEditMode,
    updateGridMetrics,
    widgetsFromLayout,
    type TileGridEngine,
  } from "$lib/call/grid/layout-engine";
  import type { CallTileLayout } from "$lib/call/grid/types";
  import ParticipantTile from "./ParticipantTile.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    editMode: boolean;
    tileLayout: CallTileLayout | null;
    onLayoutChange: (layout: CallTileLayout) => void;
  };

  const { room, activeSpeakerIdentity, audioLevels, localDisplayName, editMode, tileLayout, onLayoutChange }: Props = $props();

  let hostEl = $state<HTMLElement | null>(null);
  let gridEl = $state<HTMLElement | null>(null);
  let engine = $state<TileGridEngine | null>(null);
  let hostSize = $state({ width: 0, height: 0 });
  let applyingLayout = false;

  const participants = $derived(listRoomParticipants(room));
  const identities = $derived(participants.map((participant) => participant.identity));
  const participantKey = $derived(identities.join("|"));
  const metrics = $derived(computeGridMetrics(hostSize.width, hostSize.height));
  const mergedLayout = $derived(mergeParticipantLayout(identities, tileLayout, metrics));

  const gridLineStyle = $derived(metrics.cellSize > 0 ? `background-size: ${metrics.cellSize}px ${metrics.cellSize}px;` : undefined);

  const displayNameFor = (identity: string, name?: string) => {
    if (identity === room.localParticipant.identity) return localDisplayName;
    return name || "Participant";
  };

  function persistLayout() {
    const grid = engine?.grid;
    if (!grid || applyingLayout) return;
    onLayoutChange(layoutFromGridNodes(grid.engine.nodes, metrics));
  }

  function applyLayout(layout: CallTileLayout) {
    const grid = engine?.grid;
    const container = gridEl;
    if (!grid || !container || applyingLayout) return;

    applyingLayout = true;
    try {
      registerGridWidgets(grid, container, layout);
      grid.load(widgetsFromLayout(layout), false);
    } finally {
      applyingLayout = false;
    }
  }

  $effect(() => {
    const host = hostEl;
    if (!host) return;

    const observer = new ResizeObserver(([entry]) => {
      hostSize = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
    });

    observer.observe(host);
    hostSize = { width: host.clientWidth, height: host.clientHeight };

    return () => observer.disconnect();
  });

  $effect(() => {
    const el = gridEl;
    const cols = metrics.cols;
    if (!el || cols <= 0 || hostSize.width <= 0) return;

    const instance = createTileGridEngine(el, metrics, persistLayout);
    engine = instance;

    return () => {
      instance.destroy();
      engine = null;
    };
  });

  $effect(() => {
    const grid = engine?.grid;
    if (!grid || metrics.canvasWidth <= 0) return;
    updateGridMetrics(grid, metrics);
  });

  $effect(() => {
    const grid = engine?.grid;
    if (!grid) return;
    setGridEditMode(grid, editMode);
  });

  $effect(() => {
    participantKey;
    metrics.cols;
    tileLayout;
    mergedLayout;
    if (!engine?.grid || metrics.canvasWidth <= 0) return;
    applyLayout(mergedLayout);
  });
</script>

<div bind:this={hostEl} class="flex size-full items-start justify-center overflow-hidden p-2 sm:p-4">
  <div
    class="relative shrink-0 {editMode ? 'zeo-grid-lines zeo-grid-lines-visible' : 'zeo-grid-lines'}"
    style:width="{metrics.canvasWidth}px"
    style:height="{metrics.canvasHeight}px"
    style={gridLineStyle}
  >
    <div bind:this={gridEl} class="grid-stack zeo-tile-grid size-full">
      {#each participants as participant (participant.identity)}
        {@const rect = mergedLayout.tiles[participant.identity]}
        {#if rect}
          <div class="grid-stack-item" data-tile-id={participant.identity}>
            <div class="grid-stack-item-content overflow-hidden rounded-lg">
              <ParticipantTile
                {participant}
                displayName={displayNameFor(participant.identity, participant.name)}
                isActiveSpeaker={activeSpeakerIdentity === participant.identity}
                audioLevel={audioLevels[participant.identity] ?? 0}
                tileColor={participantColorForIdentity(participant.identity)}
                isGuest={participant.identity.startsWith("guest_")}
                isLocal={participant.identity === room.localParticipant.identity}
                fillContainer
                layoutEditable={editMode}
              />
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>
