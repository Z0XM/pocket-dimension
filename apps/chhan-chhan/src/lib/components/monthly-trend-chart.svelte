<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
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

  const { rows, currencyCode }: Props = $props();

  const maxMinor = $derived(rows.reduce((max, row) => Math.max(max, row.incomeMinor, row.expenseMinor), 0));

  function barHeight(minor: number): number {
    if (maxMinor <= 0 || minor <= 0) return 0;
    return Math.max(4, Math.round((minor / maxMinor) * 100));
  }
</script>

<div class="trend-chart" role="img" aria-label="Monthly income and expense trend">
  <div class="trend-legend">
    <span><i class="dot income"></i> In</span>
    <span><i class="dot expense"></i> Out</span>
  </div>
  <div class="trend-grid">
    {#each rows as row (row.monthKey)}
      <div class="trend-col">
        <div class="trend-bars">
          <div class="trend-bar income" style="height:{barHeight(row.incomeMinor)}%" title="In {formatMoney(row.incomeMinor, currencyCode)}"></div>
          <div
            class="trend-bar expense"
            style="height:{barHeight(row.expenseMinor)}%"
            title="Out {formatMoney(row.expenseMinor, currencyCode)}"
          ></div>
        </div>
        <span class="trend-label">{formatMonthKeyShort(row.monthKey)}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .trend-chart {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .trend-legend {
    display: flex;
    gap: 0.85rem;
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .trend-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 1px;
    display: inline-block;
  }

  .dot.income,
  .trend-bar.income {
    background: var(--pos);
  }

  .dot.expense,
  .trend-bar.expense {
    background: var(--neg);
  }

  .trend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(2.4rem, 1fr));
    gap: 0.45rem;
    align-items: end;
    min-height: 9rem;
  }

  .trend-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .trend-bars {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.2rem;
    width: 100%;
    height: 7.5rem;
  }

  .trend-bar {
    width: 0.55rem;
    min-height: 0;
    border-radius: 1px 1px 0 0;
    transition: height 0.15s ease;
  }

  .trend-label {
    font-size: 0.58rem;
    letter-spacing: 0.04em;
    color: var(--muted);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
