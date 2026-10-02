<script lang="ts">
  import { formatMoney } from "$lib/finance/money";

  type Slice = {
    name: string;
    amountMinor: number;
    color: string;
  };

  type Props = {
    rows: Slice[];
    currencyCode: string;
    ariaLabel?: string;
  };

  const { rows, currencyCode, ariaLabel = "Spend breakdown" }: Props = $props();

  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_OUTER = 92;
  const R_INNER = 48;

  type ArcSlice = Slice & {
    share: number;
    path: string;
  };

  function polar(cx: number, cy: number, r: number, angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function donutPath(startAngle: number, endAngle: number): string {
    const sweep = Math.min(359.999, Math.max(0, endAngle - startAngle));
    if (sweep <= 0) return "";

    const large = sweep > 180 ? 1 : 0;
    const outerStart = polar(CX, CY, R_OUTER, startAngle);
    const outerEnd = polar(CX, CY, R_OUTER, startAngle + sweep);
    const innerEnd = polar(CX, CY, R_INNER, startAngle + sweep);
    const innerStart = polar(CX, CY, R_INNER, startAngle);

    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");
  }

  const slices = $derived.by((): ArcSlice[] => {
    const total = rows.reduce((sum, row) => sum + Math.max(0, row.amountMinor), 0);
    if (total <= 0) return [];

    let angle = 0;
    return rows
      .filter((row) => row.amountMinor > 0)
      .map((row) => {
        const share = row.amountMinor / total;
        const sweep = share * 360;
        const path = donutPath(angle, angle + sweep);
        angle += sweep;
        return { ...row, share, path };
      })
      .filter((row) => row.path);
  });

  const totalMinor = $derived(rows.reduce((sum, row) => sum + Math.max(0, row.amountMinor), 0));
</script>

{#if slices.length === 0}
  <p class="dim empty">No spend to chart.</p>
{:else}
  <div class="pie-chart math-notebook" role="img" aria-label={ariaLabel}>
    <div class="pie-stage">
      <svg viewBox="0 0 {SIZE} {SIZE}" class="pie-svg" aria-hidden="true">
        {#each slices as slice (slice.name)}
          <path class="slice" d={slice.path} fill={slice.color}>
            <title>{slice.name}: {formatMoney(slice.amountMinor, currencyCode)}</title>
          </path>
        {/each}
        <circle class="hub-ring" cx={CX} cy={CY} r={R_INNER - 1.5} fill="none" />
      </svg>
      <div class="hub">
        <span class="hub-k">total</span>
        <span class="hub-v">{formatMoney(totalMinor, currencyCode)}</span>
      </div>
    </div>

    <ul class="pie-legend">
      {#each slices as slice (slice.name)}
        <li>
          <span class="swatch" style="background:{slice.color}" aria-hidden="true"></span>
          <span class="name" title={slice.name}>{slice.name}</span>
          <span class="pct">{Math.round(slice.share * 100)}%</span>
          <span class="amt">{formatMoney(slice.amountMinor, currencyCode)}</span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .empty {
    margin: 0;
  }

  .pie-chart {
    display: grid;
    grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr);
    gap: 1rem 1.25rem;
    align-items: center;
  }

  .math-notebook {
    padding: 0.65rem 0.7rem;
    background-image:
      linear-gradient(rgba(90, 130, 180, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 130, 180, 0.12) 1px, transparent 1px);
    background-size: 16px 16px;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
  }

  .pie-stage {
    position: relative;
    width: 100%;
    max-width: 14rem;
    margin: 0 auto;
    aspect-ratio: 1;
  }

  .pie-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .slice {
    stroke: color-mix(in srgb, var(--ink) 22%, transparent);
    stroke-width: 1.25;
    paint-order: stroke fill;
    transition: opacity 120ms ease;
  }

  .slice:hover {
    opacity: 0.88;
  }

  .hub-ring {
    stroke: color-mix(in srgb, var(--ink) 28%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
  }

  .hub {
    position: absolute;
    inset: 32%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    text-align: center;
    pointer-events: none;
  }

  .hub-k {
    font-family: var(--hand);
    font-size: 0.85rem;
    color: var(--ink-muted);
    letter-spacing: 0.02em;
  }

  .hub-v {
    font-family: var(--hand);
    font-size: 0.95rem;
    color: var(--ink);
    line-height: 1.15;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pie-legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .pie-legend li {
    display: grid;
    grid-template-columns: 0.7rem minmax(0, 1fr) auto auto;
    gap: 0.4rem 0.45rem;
    align-items: baseline;
    font-family: var(--hand);
    font-size: 0.92rem;
    color: var(--ink);
  }

  .swatch {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 2px 6px 3px 5px / 5px 2px 6px 2px;
    box-shadow: 0.5px 0.5px 0 color-mix(in srgb, var(--ink) 18%, transparent);
    align-self: center;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pct {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .amt {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .pie-chart {
      grid-template-columns: 1fr;
    }

    .pie-stage {
      max-width: 12.5rem;
    }
  }
</style>
