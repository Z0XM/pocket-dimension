<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import { buildSettlementGraph, layoutSettlementGraph, type SettlementGraphEdge, type SettlementGraphTxn } from "$lib/finance/settlement-graph";

  type Props = {
    transactions: SettlementGraphTxn[];
    edges: SettlementGraphEdge[];
    currencyCode: string;
  };

  const { transactions, edges, currencyCode }: Props = $props();

  const model = $derived(buildSettlementGraph(transactions, edges));
  const layout = $derived(layoutSettlementGraph(model));
</script>

{#if model.links.length === 0}
  <p class="dim empty">No settlement links yet — add settlements to see the graph.</p>
{:else}
  <div class="graph-wrap">
    <svg
      class="settle-graph"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label="Settlement graph showing how income settled expenses"
    >
      <text x="110" y="22" text-anchor="middle" class="col-label">Incoming</text>
      <text x={layout.width - 110} y="22" text-anchor="middle" class="col-label">Outgoing</text>

      {#each model.links as link (link.id)}
        {@const from = layout.positions.get(link.fromId)}
        {@const to = layout.positions.get(link.toId)}
        {#if from && to}
          {@const midX = (from.x + to.x) / 2}
          {@const midY = (from.y + to.y) / 2}
          <path
            class="edge"
            d={`M ${from.x + 54} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 54} ${to.y}`}
            marker-end="url(#arrow)"
          />
          <text x={midX} y={midY - 6} text-anchor="middle" class="edge-label">
            {formatMoney(link.amountMinor, currencyCode)}
          </text>
        {/if}
      {/each}

      {#each model.nodes as node (node.id)}
        {@const pos = layout.positions.get(node.id)}
        {#if pos}
          <g transform={`translate(${pos.x}, ${pos.y})`}>
            <rect
              class="node-card"
              class:income={node.column === 0}
              class:expense={node.column === 1}
              x="-52"
              y="-26"
              width="104"
              height="52"
              rx="3"
            />
            <text y="-6" text-anchor="middle" class="node-title">
              {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
            </text>
            <text y="12" text-anchor="middle" class="node-meta">
              {formatMoney(node.amountMinor, currencyCode)}
            </text>
            {#if node.leftoverMinor > 0}
              <text y="38" text-anchor="middle" class="node-left">
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
      </defs>
    </svg>
    <p class="graph-hint dim">
      Edges show how much of each payment settled another. Leftover amounts sit under nodes that were only partly used.
    </p>
  </div>
{/if}

<style>
  .graph-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-height: 0;
    flex: 1 1 auto;
  }

  .settle-graph {
    width: 100%;
    max-height: min(70vh, 36rem);
    background: color-mix(in srgb, var(--page) 92%, #efe8d8);
    border: 1.5px dashed color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 2px 5px 3px 2px;
  }

  .col-label {
    fill: var(--ink-muted);
    font-family: var(--hand);
    font-size: 13px;
  }

  .edge {
    fill: none;
    stroke: color-mix(in srgb, var(--ink) 45%, transparent);
    stroke-width: 1.6;
  }

  .edge-label {
    fill: var(--ink);
    font-family: var(--mono, ui-monospace, monospace);
    font-size: 11px;
  }

  .arrow-head {
    fill: color-mix(in srgb, var(--ink) 55%, transparent);
  }

  .node-card {
    fill: color-mix(in srgb, var(--page) 88%, #fff);
    stroke: color-mix(in srgb, var(--ink) 28%, transparent);
    stroke-width: 1.4;
  }

  .node-card.income {
    fill: color-mix(in srgb, var(--green) 22%, var(--page));
  }

  .node-card.expense {
    fill: color-mix(in srgb, var(--pink) 18%, var(--page));
  }

  .node-title {
    fill: var(--ink);
    font-family: var(--hand);
    font-size: 12px;
  }

  .node-meta {
    fill: var(--ink);
    font-family: var(--mono, ui-monospace, monospace);
    font-size: 11px;
  }

  .node-left {
    fill: var(--brand);
    font-family: var(--hand);
    font-size: 11px;
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
