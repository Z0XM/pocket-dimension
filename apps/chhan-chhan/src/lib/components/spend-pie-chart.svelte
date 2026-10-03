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

  type Tip = {
    left: string;
    top: string;
    name: string;
    pct: string;
    amount: string;
    color: string;
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
    tipX: number;
    tipY: number;
  };

  let tip = $state<Tip | null>(null);
  let activeName = $state<string | null>(null);

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
        const mid = polar(CX, CY, (R_OUTER + R_INNER) / 2, angle + sweep / 2);
        angle += sweep;
        return { ...row, share, path, tipX: mid.x, tipY: mid.y };
      })
      .filter((row) => row.path);
  });

  const totalMinor = $derived(rows.reduce((sum, row) => sum + Math.max(0, row.amountMinor), 0));

  function showTip(slice: ArcSlice) {
    activeName = slice.name;
    tip = {
      left: `${(slice.tipX / SIZE) * 100}%`,
      top: `${(slice.tipY / SIZE) * 100}%`,
      name: slice.name,
      pct: `${Math.round(slice.share * 100)}%`,
      amount: formatMoney(slice.amountMinor, currencyCode),
      color: slice.color,
    };
  }

  function hideTip() {
    tip = null;
    activeName = null;
  }
</script>

{#if slices.length === 0}
  <p class="dim empty">No spend to chart.</p>
{:else}
  <div class="pie-chart math-notebook" role="img" aria-label={ariaLabel}>
    <div class="pie-stage">
      <svg viewBox="0 0 {SIZE} {SIZE}" class="pie-svg" aria-hidden="true">
        {#each slices as slice (slice.name)}
          <path
            class="slice"
            class:active={activeName === slice.name}
            class:dimmed={activeName !== null && activeName !== slice.name}
            d={slice.path}
            fill={slice.color}
            onpointerenter={() => showTip(slice)}
            onpointerleave={hideTip}
          ></path>
        {/each}
        <circle class="hub-ring" cx={CX} cy={CY} r={R_INNER - 1.5} fill="none" />
      </svg>
      <div class="hub">
        <span class="hub-k">total</span>
        <span class="hub-v">{formatMoney(totalMinor, currencyCode)}</span>
      </div>

      {#if tip}
        <div class="sketch-tip" style="left:{tip.left}; top:{tip.top}" role="tooltip">
          <span class="tip-swatch" style="background:{tip.color}" aria-hidden="true"></span>
          <span class="tip-name">{tip.name}</span>
          <span class="tip-pct">{tip.pct}</span>
          <span class="tip-amt">{tip.amount}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .empty {
    margin: 0;
  }

  .pie-chart {
    display: flex;
    justify-content: center;
  }

  .math-notebook {
    padding: 0.55rem 0.6rem;
    background-image:
      linear-gradient(rgba(90, 130, 180, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 130, 180, 0.12) 1px, transparent 1px);
    background-size: 16px 16px;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
  }

  .pie-stage {
    position: relative;
    width: 100%;
    max-width: 16.5rem;
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
    cursor: crosshair;
  }

  .slice.dimmed {
    opacity: 0.45;
  }

  .slice.active {
    opacity: 1;
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

  .sketch-tip {
    position: absolute;
    z-index: 8;
    transform: translate(-50%, calc(-100% - 0.45rem)) rotate(-0.5deg);
    width: max-content;
    max-width: 12rem;
    padding: 0.35rem 0.5rem 0.35rem 0.4rem;
    pointer-events: none;
    background:
      linear-gradient(transparent 0, transparent calc(100% - 1px), color-mix(in srgb, var(--ink) 10%, transparent) calc(100% - 1px)) 0 0 / 100% 1.1rem,
      color-mix(in srgb, var(--yellow) 28%, var(--surface-raised));
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 2px 10px 3px 8px / 8px 2px 10px 3px;
    box-shadow:
      2px 2px 0 0 var(--shadow-paper),
      2px 2px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    font-family: var(--hand);
    color: var(--ink);
    line-height: 1.2;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      "swatch name"
      "swatch pct"
      "swatch amt";
    column-gap: 0.35rem;
    row-gap: 0.02rem;
    align-items: start;
  }

  .tip-swatch {
    grid-area: swatch;
    width: 0.55rem;
    height: 0.55rem;
    margin-top: 0.2rem;
    border-radius: 2px 5px 3px 4px / 4px 2px 5px 2px;
    box-shadow: 0.5px 0.5px 0 color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .tip-name {
    grid-area: name;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 10rem;
  }

  .tip-pct {
    grid-area: pct;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  .tip-amt {
    grid-area: amt;
    font-size: 0.95rem;
  }
</style>
