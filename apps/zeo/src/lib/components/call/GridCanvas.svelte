<script lang="ts">
  import type { Room } from "livekit-client";
  import "gridstack/dist/gridstack.min.css";
  import { listRoomParticipants } from "$lib/livekit/room-client";
  import { participantColorForIdentity } from "$lib/participant-colors";
  import { computeGridMetrics } from "$lib/call/grid/metrics";
  import { clampParticipantLayout, mergeParticipantLayout, layoutFromGridNodes } from "$lib/call/grid/default-layout";
  import {
    createTileGridEngine,
    registerGridWidgets,
    setGridEditMode,
    updateGridMetrics,
    updateGridTile,
    widgetsFromLayout,
    type TileGridEngine,
  } from "$lib/call/grid/layout-engine";
  import type { CallTileLayout, TileRect } from "$lib/call/grid/types";
  import { stepPreset, tileFits } from "$lib/call/grid/tile-sizes";
  import ParticipantTile from "./ParticipantTile.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    editMode: boolean;
    tileLayout: CallTileLayout | null;
    layoutResetToken?: number;
    onLayoutChange: (layout: CallTileLayout) => void;
  };

  const { room, activeSpeakerIdentity, audioLevels, localDisplayName, editMode, tileLayout, layoutResetToken = 0, onLayoutChange }: Props = $props();

  let hostEl = $state<HTMLElement | null>(null);
  let gridEl = $state<HTMLElement | null>(null);
  let engine = $state<TileGridEngine | null>(null);
  let hostSize = $state({ width: 0, height: 0 });
  let selectedIdentity = $state<string | null>(null);
  let applyingLayout = false;
  let lastMetricsKey = "";

  const participants = $derived(listRoomParticipants(room));
  const identities = $derived(participants.map((participant) => participant.identity));
  const participantKey = $derived(identities.join("|"));
  const metrics = $derived(computeGridMetrics(hostSize.width, hostSize.height));
  const mergedLayout = $derived(mergeParticipantLayout(identities, tileLayout, metrics));
  const metricsKey = $derived(`${metrics.cols}:${metrics.rows}`);

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

  function selectTile(identity: string) {
    if (!editMode) return;
    selectedIdentity = identity;
  }

  function tileElement(identity: string) {
    return gridEl?.querySelector<HTMLElement>(`[data-tile-id="${identity}"]`) ?? null;
  }

  function updateSelectedTile(next: TileRect) {
    const grid = engine?.grid;
    const container = gridEl;
    const identity = selectedIdentity;
    if (!grid || !container || !identity || !tileFits(next, metrics.cols, metrics.rows)) return;

    updateGridTile(grid, container, identity, next);
    persistLayout();
  }

  function moveSelectedTile(dx: number, dy: number) {
    const identity = selectedIdentity;
    if (!identity) return;

    const current = mergedLayout.tiles[identity];
    if (!current) return;

    updateSelectedTile({
      ...current,
      x: current.x + dx,
      y: current.y + dy,
    });
  }

  function resizeSelectedTile(direction: "up" | "down") {
    const identity = selectedIdentity;
    if (!identity) return;

    const current = mergedLayout.tiles[identity];
    if (!current) return;

    updateSelectedTile(stepPreset(current, metrics, direction));
  }

  function handleGridKeydown(event: KeyboardEvent) {
    if (!editMode) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (!selectedIdentity) return;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveSelectedTile(-1, 0);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveSelectedTile(1, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveSelectedTile(0, -1);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveSelectedTile(0, 1);
        break;
      case "+":
      case "=":
        event.preventDefault();
        resizeSelectedTile("up");
        break;
      case "-":
      case "_":
        event.preventDefault();
        resizeSelectedTile("down");
        break;
      default:
        break;
    }
  }

  $effect(() => {
    if (!editMode) {
      selectedIdentity = null;
    }
  });

  $effect(() => {
    participantKey;
    if (selectedIdentity && !identities.includes(selectedIdentity)) {
      selectedIdentity = identities[0] ?? null;
    }
  });

  $effect(() => {
    layoutResetToken;
    selectedIdentity = identities[0] ?? null;
  });

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

    const instance = createTileGridEngine(el, metrics, () => metrics, persistLayout);
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
    layoutResetToken;
    tileLayout;
    mergedLayout;
    if (!engine?.grid || metrics.canvasWidth <= 0) return;
    applyLayout(mergedLayout);
  });

  $effect(() => {
    const key = metricsKey;
    if (!tileLayout) {
      lastMetricsKey = key;
      return;
    }
    if (key === lastMetricsKey) return;

    const clamped = clampParticipantLayout(tileLayout, identities, metrics);
    lastMetricsKey = key;

    const unchanged =
      clamped.cols === tileLayout.cols &&
      identities.every((identity) => {
        const before = tileLayout.tiles[identity];
        const after = clamped.tiles[identity];
        if (!before || !after) return before === after;
        return before.x === after.x && before.y === after.y && before.w === after.w && before.h === after.h;
      });

    if (!unchanged) {
      onLayoutChange(clamped);
    }
  });
</script>

<svelte:window onkeydown={handleGridKeydown} />

<div bind:this={hostEl} class="relative flex size-full items-start justify-center overflow-hidden p-2 sm:p-4">
  {#if editMode}
    <p
      class="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm"
    >
      Arrow keys move · +/- resize · click a tile to select
    </p>
  {/if}

  <div
    class="relative shrink-0 {editMode ? 'zeo-grid-lines zeo-grid-lines-visible' : 'zeo-grid-lines'}"
    style:width="{metrics.canvasWidth}px"
    style:height="{metrics.canvasHeight}px"
    style={gridLineStyle}
    role={editMode ? "listbox" : undefined}
    aria-label={editMode ? "Participant video tiles" : undefined}
  >
    <div bind:this={gridEl} class="grid-stack zeo-tile-grid size-full">
      {#each participants as participant (participant.identity)}
        {@const rect = mergedLayout.tiles[participant.identity]}
        {#if rect}
          <div
            class="grid-stack-item {editMode ? 'zeo-grid-item-editable' : ''} {selectedIdentity === participant.identity
              ? 'zeo-grid-item-selected'
              : ''}"
            data-tile-id={participant.identity}
            role={editMode ? "option" : undefined}
            aria-selected={editMode ? selectedIdentity === participant.identity : undefined}
            tabindex={editMode ? 0 : -1}
            onclick={() => selectTile(participant.identity)}
            onfocus={() => selectTile(participant.identity)}
          >
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
