<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import {
    buildSettlementGraph,
    connectedIdsForNode,
    layoutSettlementGraph,
    type SettlementGraphEdge,
    type SettlementGraphTxn,
  } from "$lib/finance/settlement-graph";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";

  type Props = {
    transactions: SettlementGraphTxn[];
    edges: SettlementGraphEdge[];
    currencyCode: string;
  };

  const { transactions, edges, currencyCode }: Props = $props();

  const model = $derived(buildSettlementGraph(transactions, edges));
  const layout = $derived(layoutSettlementGraph(model));

  let selectedId = $state<string | null>(null);
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let dragMoved = $state(false);
  let lastPointer = $state<{ x: number; y: number } | null>(null);
  let viewportEl = $state<HTMLDivElement | null>(null);

  const focus = $derived(selectedId ? connectedIdsForNode(model, selectedId) : null);
  const MIN_SCALE = 0.45;
  const MAX_SCALE = 3.2;

  function clampScale(next: number) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  }

  function zoomBy(factor: number, originX?: number, originY?: number) {
    const prev = scale;
    const next = clampScale(prev * factor);
    if (next === prev) return;

    // Zoom toward pointer / viewport center so pan stays intuitive.
    const rect = viewportEl?.getBoundingClientRect();
    const ox = originX ?? (rect ? rect.width / 2 : 0);
    const oy = originY ?? (rect ? rect.height / 2 : 0);
    const worldX = (ox - panX) / prev;
    const worldY = (oy - panY) / prev;
    scale = next;
    panX = ox - worldX * next;
    panY = oy - worldY * next;
  }

  function resetView() {
    scale = 1;
    panX = 0;
    panY = 0;
    selectedId = null;
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const rect = viewportEl?.getBoundingClientRect();
    if (!rect) return;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target as Element | null;
    // Node clicks handled separately; background / edges start a pan.
    if (target?.closest?.("[data-node-id]")) return;
    dragging = true;
    dragMoved = false;
    lastPointer = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging || !lastPointer) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    if (Math.hypot(dx, dy) > 2) dragMoved = true;
    panX += dx;
    panY += dy;
    lastPointer = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp() {
    dragging = false;
    lastPointer = null;
  }

  function selectNode(nodeId: string) {
    if (dragMoved) return;
    selectedId = selectedId === nodeId ? null : nodeId;
  }

  function isNodeActive(nodeId: string) {
    if (!focus) return true;
    return focus.nodeIds.has(nodeId);
  }

  function isLinkActive(linkId: string) {
    if (!focus) return true;
    return focus.linkIds.has(linkId);
  }

  function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const pad = 58;
    const sx = from.x + (dx / dist) * pad;
    const sy = from.y + (dy / dist) * pad;
    const ex = to.x - (dx / dist) * pad;
    const ey = to.y - (dy / dist) * pad;
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    // Slight curve so overlapping edges separate a bit.
    const nx = -dy / dist;
    const ny = dx / dist;
    const bow = Math.min(48, dist * 0.12);
    const cx = mx + nx * bow;
    const cy = my + ny * bow;
    return {
      d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,
      labelX: cx,
      labelY: cy - 8,
    };
  }
</script>

{#if model.links.length === 0}
  <p class="dim empty">No settlement links yet — add settlements to see the graph.</p>
{:else}
  <div class="graph-wrap">
    <div class="graph-toolbar">
      <button type="button" class="zoom-btn" aria-label="Zoom out" title="Zoom out" onclick={() => zoomBy(1 / 1.2)}>
        <Minus size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" class="zoom-btn" aria-label="Zoom in" title="Zoom in" onclick={() => zoomBy(1.2)}>
        <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" class="zoom-btn" aria-label="Reset view" title="Reset view" onclick={resetView}>
        <Maximize2 size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span class="zoom-readout mono dim">{Math.round(scale * 100)}%</span>
      {#if selectedId}
        <button type="button" class="clear-focus" onclick={() => (selectedId = null)}>Clear focus</button>
      {/if}
    </div>

    <div
      class="graph-viewport"
      class:panning={dragging}
      bind:this={viewportEl}
      onwheel={onWheel}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      role="presentation"
    >
      <svg
        class="settle-graph"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        style={`transform: translate(${panX}px, ${panY}px) scale(${scale});`}
        role="img"
        aria-label="Settlement graph showing how payments settled other payments"
      >
        {#each model.links as link (link.id)}
          {@const from = layout.positions.get(link.fromId)}
          {@const to = layout.positions.get(link.toId)}
          {#if from && to}
            {@const path = edgePath(from, to)}
            <path
              class="edge"
              class:active={isLinkActive(link.id)}
              class:dimmed={Boolean(focus) && !isLinkActive(link.id)}
              d={path.d}
              marker-end={isLinkActive(link.id) ? "url(#arrow-active)" : "url(#arrow)"}
            />
            <text
              x={path.labelX}
              y={path.labelY}
              text-anchor="middle"
              class="edge-label"
              class:dimmed={Boolean(focus) && !isLinkActive(link.id)}
            >
              {formatMoney(link.amountMinor, currencyCode)}
            </text>
          {/if}
        {/each}

        {#each model.nodes as node (node.id)}
          {@const pos = layout.positions.get(node.id)}
          {#if pos}
            <g
              class="node"
              class:selected={selectedId === node.id}
              class:active={isNodeActive(node.id)}
              class:dimmed={Boolean(focus) && !isNodeActive(node.id)}
              transform={`translate(${pos.x}, ${pos.y})`}
              data-node-id={node.id}
              role="button"
              tabindex="0"
              aria-pressed={selectedId === node.id}
              aria-label={`Focus ${node.label}`}
              onclick={(e) => {
                e.stopPropagation();
                selectNode(node.id);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectNode(node.id);
                }
              }}
            >
              <rect class="node-card" x="-58" y="-30" width="116" height="60" rx="4" />
              <text y="-6" text-anchor="middle" class="node-title">
                {node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}
              </text>
              <text y="14" text-anchor="middle" class="node-meta">
                {formatMoney(node.amountMinor, currencyCode)}
              </text>
              {#if node.leftoverMinor > 0}
                <text y="42" text-anchor="middle" class="node-left">
                  left {formatMoney(node.leftoverMinor, currencyCode)}
                </text>
              {/if}
            </g>
          {/if}
        {/each}

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="arrow-head" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="arrow-head active" />
          </marker>
        </defs>
      </svg>
    </div>

    <p class="graph-hint dim">
      Scroll or use +/- to zoom, drag to pan, click a payment to highlight its links. Leftover amounts sit under partly used
      nodes.
    </p>
  </div>
{/if}

<style>
  .graph-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-height: 0;
    flex: 1 1 auto;
  }

  .graph-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.45rem;
    flex: 0 0 auto;
  }

  .zoom-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    background: color-mix(in srgb, var(--page) 90%, #fff);
    border-radius: 2px 4px 3px 2px;
    cursor: pointer;
    color: var(--ink);
  }

  .zoom-btn:hover {
    background: color-mix(in srgb, var(--yellow) 35%, var(--page));
  }

  .zoom-readout {
    font-size: 0.85rem;
    min-width: 2.6rem;
  }

  .clear-focus {
    margin-left: 0.25rem;
    border: none;
    background: transparent;
    font-family: var(--hand);
    font-size: 0.95rem;
    color: var(--brand);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .graph-viewport {
    position: relative;
    flex: 1 1 auto;
    min-height: 22rem;
    max-height: min(72vh, 40rem);
    overflow: hidden;
    touch-action: none;
    cursor: grab;
    background: color-mix(in srgb, var(--page) 92%, #efe8d8);
    border: 1.5px dashed color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 2px 5px 3px 2px;
  }

  .graph-viewport.panning {
    cursor: grabbing;
  }

  .settle-graph {
    display: block;
    transform-origin: 0 0;
    overflow: visible;
  }

  .edge {
    fill: none;
    stroke: color-mix(in srgb, var(--ink) 42%, transparent);
    stroke-width: 1.7;
    transition:
      stroke 120ms ease,
      opacity 120ms ease,
      stroke-width 120ms ease;
  }

  .edge.active {
    stroke: color-mix(in srgb, var(--ink) 78%, transparent);
    stroke-width: 2.4;
  }

  .edge.dimmed,
  .edge-label.dimmed,
  .node.dimmed {
    opacity: 0.18;
  }

  .edge-label {
    fill: var(--ink);
    font-family: var(--mono, ui-monospace, monospace);
    font-size: 12px;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .arrow-head {
    fill: color-mix(in srgb, var(--ink) 50%, transparent);
  }

  .arrow-head.active {
    fill: color-mix(in srgb, var(--ink) 80%, transparent);
  }

  .node {
    cursor: pointer;
    outline: none;
    transition: opacity 120ms ease;
  }

  .node-card {
    fill: color-mix(in srgb, var(--page) 88%, #fff);
    stroke: color-mix(in srgb, var(--ink) 30%, transparent);
    stroke-width: 1.5;
    transition:
      stroke 120ms ease,
      fill 120ms ease,
      stroke-width 120ms ease;
  }

  .node:hover .node-card,
  .node.selected .node-card,
  .node.active:not(.dimmed) .node-card {
    stroke: color-mix(in srgb, var(--ink) 55%, transparent);
  }

  .node.selected .node-card {
    fill: color-mix(in srgb, var(--yellow) 28%, var(--page));
    stroke-width: 2.2;
  }

  .node-title {
    fill: var(--ink);
    font-family: var(--hand);
    font-size: 13px;
    pointer-events: none;
  }

  .node-meta {
    fill: var(--ink);
    font-family: var(--mono, ui-monospace, monospace);
    font-size: 12px;
    pointer-events: none;
  }

  .node-left {
    fill: var(--brand);
    font-family: var(--hand);
    font-size: 11px;
    pointer-events: none;
  }

  .graph-hint {
    margin: 0;
    font-family: var(--hand);
    font-size: 0.95rem;
  }

  .dim.empty {
    margin: 0;
    font-family: var(--hand);
  }
</style>
