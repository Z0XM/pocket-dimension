<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import type { CategoryTrendChartData } from "$lib/finance/dashboard-widgets";
  import { formatMonthKeyShort } from "$lib/finance/summary";

  type Props = {
    chart: CategoryTrendChartData;
    currencyCode: string;
  };

  const { chart, currencyCode }: Props = $props();

  const maxMinor = $derived(chart.months.reduce((max, month) => Math.max(max, month.totalMinor), 0));

  function barHeight(totalMinor: number): number {
    if (maxMinor <= 0 || totalMinor <= 0) return 0;
    return Math.max(4, Math.round((totalMinor / maxMinor) * 100));
  }

  function segmentHeight(amountMinor: number, totalMinor: number): number {
    if (totalMinor <= 0 || amountMinor <= 0) return 0;
    return Math.max(2, Math.round((amountMinor / totalMinor) * 100));
  }
</script>

<div class="trend-chart" role="img" aria-label="Category spend trend by month">
  {#if chart.categories.length}
    <div class="trend-legend">
      {#each chart.categories as category (category.name)}
        <span>
          <i class="dot" style="background:{category.color}"></i>
          {category.name}
        </span>
      {/each}
    </div>
  {/if}

  <div class="trend-grid">
    {#each chart.months as month (month.monthKey)}
      <div class="trend-col">
        <div class="trend-bars">
          {#if month.totalMinor > 0}
            <div class="stack" style="height:{barHeight(month.totalMinor)}%">
              {#each month.segments as segment (segment.name)}
                <div
                  class="segment"
                  style="height:{segmentHeight(segment.amountMinor, month.totalMinor)}%; background:{segment.color}"
                  title="{segment.name}: {formatMoney(segment.amountMinor, currencyCode)}"
                ></div>
              {/each}
            </div>
          {/if}
        </div>
        <span class="trend-label">{formatMonthKeyShort(month.monthKey)}</span>
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
    flex-wrap: wrap;
    gap: 0.55rem 0.85rem;
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .trend-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 1px;
    display: inline-block;
    flex-shrink: 0;
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
    width: 100%;
    height: 7.5rem;
  }

  .stack {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    width: 0.85rem;
    min-height: 0;
  }

  .segment {
    width: 100%;
    min-height: 0;
    border-radius: 0;
  }

  .segment:first-child {
    border-radius: 1px 1px 0 0;
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
