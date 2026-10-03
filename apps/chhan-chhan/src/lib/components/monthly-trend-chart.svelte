<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import { sketchAreaPath, sketchLinePath, type ChartPoint } from "$lib/finance/sketch-chart";
  import { formatMonthKeyShort } from "$lib/finance/summary";

  type TrendRow = {
    monthKey: string;
    incomeMinor: number;
    expenseMinor: number;
    netMinor: number;
  };

  type Props = {
    rows: TrendRow[];
    currencyCode: string;
  };

  type Tip = {
    left: string;
    top: string;
    label: string;
    month: string;
    amount: string;
  };

  const { rows, currencyCode }: Props = $props();

  const VIEW_W = 1000;
  const VIEW_H = 160;
  const PAD = { top: 14, right: 16, bottom: 6, left: 16 };
  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;

  let tip = $state<Tip | null>(null);

  const maxMinor = $derived(rows.reduce((max, row) => Math.max(max, row.incomeMinor, row.expenseMinor), 0));

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

  const incomeValues = $derived(rows.map((row) => row.incomeMinor));
  const expenseValues = $derived(rows.map((row) => row.expenseMinor));
  const incomePoints = $derived(toPoints(incomeValues));
  const expensePoints = $derived(toPoints(expenseValues));
  const incomeLine = $derived(sketchLinePath(incomePoints, 2.4, 3));
  const expenseLine = $derived(sketchLinePath(expensePoints, 2.6, 11));
  const incomeLineGhost = $derived(sketchLinePath(incomePoints, 3.1, 7));
  const expenseLineGhost = $derived(sketchLinePath(expensePoints, 3.2, 19));
  const incomeArea = $derived(sketchAreaPath(incomePoints, PAD.top + plotH, 2.4, 3));
  const expenseArea = $derived(sketchAreaPath(expensePoints, PAD.top + plotH, 2.6, 11));

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

<div class="trend-chart math-notebook" role="img" aria-label="Monthly income and expense trend">
  <div class="trend-legend">
    <span><i class="swatch income"></i> In</span>
    <span><i class="swatch expense"></i> Out</span>
  </div>

  <div class="trend-plot">
    <svg viewBox="0 0 {VIEW_W} {VIEW_H}" aria-hidden="true">
      <defs>
        <filter id="sketch-ink-monthly" x="-4%" y="-8%" width="108%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter="url(#sketch-ink-monthly)">
        <path class="area income" d={incomeArea}></path>
        <path class="area expense" d={expenseArea}></path>
        <path class="line ghost income" d={incomeLineGhost}></path>
        <path class="line ghost expense" d={expenseLineGhost}></path>
        <path class="line income" d={incomeLine}></path>
        <path class="line expense" d={expenseLine}></path>
      </g>

      {#each rows as row, index (row.monthKey)}
        {@const incomePt = { x: xAt(index, rows.length), y: yAt(row.incomeMinor) }}
        {@const expensePt = { x: xAt(index, rows.length), y: yAt(row.expenseMinor) }}
        <circle
          class="point income"
          cx={incomePt.x}
          cy={incomePt.y}
          r="5"
          onpointerenter={() => showTip(incomePt, "In", row.monthKey, row.incomeMinor)}
          onpointerleave={hideTip}
        ></circle>
        <circle
          class="point expense"
          cx={expensePt.x}
          cy={expensePt.y}
          r="5"
          onpointerenter={() => showTip(expensePt, "Out", row.monthKey, row.expenseMinor)}
          onpointerleave={hideTip}
        ></circle>
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

  <div class="trend-labels" style="--cols: {Math.max(rows.length, 1)}">
    {#each rows as row (row.monthKey)}
      <span class="trend-label">{formatMonthKeyShort(row.monthKey)}</span>
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
  }

  .math-notebook {
    padding: 0.3rem 0.3rem 0.2rem;
    background-image:
      linear-gradient(rgba(90, 130, 180, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 130, 180, 0.14) 1px, transparent 1px);
    background-size: 16px 16px;
    background-position: 0 0;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
  }

  .trend-legend {
    display: flex;
    gap: 0.75rem;
    font-family: var(--hand);
    font-size: 0.88rem;
    letter-spacing: 0.01em;
    color: var(--muted);
  }

  .trend-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .swatch {
    width: 0.85rem;
    height: 0.16rem;
    border-radius: 1px;
    display: inline-block;
  }

  .swatch.income,
  .line.income,
  .point.income {
    color: color-mix(in srgb, var(--green) 80%, var(--pos));
  }

  .swatch.expense,
  .line.expense,
  .point.expense {
    color: color-mix(in srgb, var(--pink) 75%, var(--neg));
  }

  .swatch.income {
    background: color-mix(in srgb, var(--green) 80%, var(--pos));
  }

  .swatch.expense {
    background: color-mix(in srgb, var(--pink) 75%, var(--neg));
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

  .area {
    opacity: 0.12;
  }

  .area.income {
    fill: color-mix(in srgb, var(--green) 80%, var(--pos));
  }

  .area.expense {
    fill: color-mix(in srgb, var(--pink) 75%, var(--neg));
  }

  .line {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .line.ghost {
    stroke-width: 3.2;
    opacity: 0.22;
  }

  .point {
    fill: var(--surface-raised, #fff);
    stroke: currentColor;
    stroke-width: 1.7;
    cursor: crosshair;
  }

  .sketch-tip {
    position: absolute;
    z-index: 8;
    transform: translate(-50%, calc(-100% - 0.55rem)) rotate(-0.6deg);
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
    color: var(--ink-muted);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
