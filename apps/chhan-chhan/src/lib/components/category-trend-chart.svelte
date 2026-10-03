<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import type { CategoryTrendChartData } from "$lib/finance/dashboard-widgets";
  import { sketchLinePath, type ChartPoint } from "$lib/finance/sketch-chart";
  import { formatMonthKeyShort } from "$lib/finance/summary";

  type Props = {
    chart: CategoryTrendChartData;
    currencyCode: string;
  };

  type Tip = {
    left: string;
    top: string;
    label: string;
    month: string;
    amount: string;
  };

  const { chart, currencyCode }: Props = $props();

  const VIEW_W = 1000;
  const VIEW_H = 160;
  const PAD = { top: 14, right: 16, bottom: 6, left: 16 };
  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;

  let tip = $state<Tip | null>(null);

  const series = $derived(
    chart.categories.map((category, categoryIndex) => ({
      name: category.name,
      color: category.color,
      seed: categoryIndex * 17 + 5,
      values: chart.months.map((month) => month.segments.find((segment) => segment.name === category.name)?.amountMinor ?? 0),
    }))
  );

  const maxMinor = $derived(series.reduce((max, line) => Math.max(max, ...line.values), 0));

  function xAt(index: number, count: number): number {
    if (count <= 1) return PAD.left + plotW / 2;
    return PAD.left + (index / (count - 1)) * plotW;
  }

  function yAt(minor: number): number {
    if (maxMinor <= 0) return PAD.top + plotH;
    const ratio = Math.max(0, Math.min(1, minor / maxMinor));
    return PAD.top + plotH - ratio * plotH;
  }

  function toPoints(values: number[]): ChartPoint[] {
    return values.map((value, index) => ({ x: xAt(index, values.length), y: yAt(value) }));
  }

  function showTip(point: ChartPoint, label: string, monthKey: string, amountMinor: number) {
    tip = {
      left: `${(point.x / VIEW_W) * 100}%`,
      top: `${(point.y / VIEW_H) * 100}%`,
      label,
      month: formatMonthKeyShort(monthKey),
      amount: formatMoney(amountMinor, currencyCode),
    };
  }

  function hideTip() {
    tip = null;
  }
</script>

<div class="trend-chart math-notebook" role="img" aria-label="Category spend trend by month">
  {#if chart.categories.length}
    <div class="trend-legend">
      {#each chart.categories as category (category.name)}
        <span>
          <i class="swatch" style="background:{category.color}"></i>
          {category.name}
        </span>
      {/each}
    </div>
  {/if}

  <div class="trend-plot">
    <svg viewBox="0 0 {VIEW_W} {VIEW_H}" aria-hidden="true">
      <defs>
        <filter id="sketch-ink-category" x="-4%" y="-8%" width="108%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter="url(#sketch-ink-category)">
        {#each series as line (line.name)}
          {@const points = toPoints(line.values)}
          <path class="line ghost" d={sketchLinePath(points, 3.1, line.seed + 3)} style="color:{line.color}"></path>
          <path class="line" d={sketchLinePath(points, 2.3, line.seed)} style="color:{line.color}"></path>
        {/each}
      </g>

      {#each series as line (line.name)}
        {#each line.values as value, index (index)}
          {@const point = { x: xAt(index, line.values.length), y: yAt(value) }}
          <circle
            class="point"
            cx={point.x}
            cy={point.y}
            r="4.5"
            style="color:{line.color}"
            onpointerenter={() => showTip(point, line.name, chart.months[index]?.monthKey ?? "", value)}
            onpointerleave={hideTip}
          ></circle>
        {/each}
      {/each}
    </svg>

    {#if tip}
      <div class="sketch-tip" style="left:{tip.left}; top:{tip.top}" role="tooltip">
        <span class="tip-k">{tip.label}</span>
        <span class="tip-m">{tip.month}</span>
        <span class="tip-v">{tip.amount}</span>
      </div>
    {/if}
  </div>

  <div class="trend-labels" style="--cols: {Math.max(chart.months.length, 1)}">
    {#each chart.months as month (month.monthKey)}
      <span class="trend-label">{formatMonthKeyShort(month.monthKey)}</span>
    {/each}
  </div>
</div>

<style>
  .trend-chart {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-width: none;
    width: 100%;
    padding: 0.3rem 0.3rem 0.2rem;
    background-image:
      linear-gradient(rgba(90, 130, 180, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 130, 180, 0.14) 1px, transparent 1px);
    background-size: 16px 16px;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
  }

  .trend-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.75rem;
    font-family: var(--hand);
    font-size: 0.85rem;
    letter-spacing: 0.01em;
    color: var(--muted);
  }

  .trend-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    max-width: 100%;
  }

  .swatch {
    width: 0.85rem;
    height: 0.16rem;
    border-radius: 1px;
    display: inline-block;
    flex-shrink: 0;
  }

  .trend-plot {
    position: relative;
    width: 100%;
    height: 6.25rem;
    border-left: 1.5px solid color-mix(in srgb, var(--ink) 35%, transparent);
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 35%, transparent);
  }

  .trend-plot svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .line {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.92;
  }

  .line.ghost {
    stroke-width: 3.1;
    opacity: 0.2;
  }

  .point {
    fill: var(--surface-raised, #fff);
    stroke: currentColor;
    stroke-width: 1.6;
    cursor: crosshair;
  }

  .sketch-tip {
    position: absolute;
    z-index: 8;
    transform: translate(-50%, calc(-100% - 0.55rem)) rotate(0.5deg);
    width: max-content;
    max-width: 11rem;
    padding: 0.35rem 0.5rem;
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
    gap: 0.05rem;
  }

  .tip-k {
    font-size: 0.78rem;
    color: var(--ink-muted);
  }

  .tip-m {
    font-size: 0.82rem;
  }

  .tip-v {
    font-size: 0.95rem;
  }

  .trend-labels {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 0;
    padding: 0 0.25rem;
  }

  .trend-label {
    font-family: var(--hand);
    font-size: 0.72rem;
    letter-spacing: 0.01em;
    color: var(--ink-muted);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
