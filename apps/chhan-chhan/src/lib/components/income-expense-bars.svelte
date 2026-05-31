<script lang="ts">
  import { formatMoney } from "$lib/finance/money";

  type Props = {
    incomeMinor: number;
    expenseMinor: number;
    currencyCode: string;
  };

  const { incomeMinor, expenseMinor, currencyCode }: Props = $props();

  const maxMinor = $derived(Math.max(incomeMinor, expenseMinor, 1));
  const incomePct = $derived(Math.round((incomeMinor / maxMinor) * 100));
  const expensePct = $derived(Math.round((expenseMinor / maxMinor) * 100));
</script>

<div class="compare-chart" role="img" aria-label="Income versus expense comparison">
  <div class="compare-row">
    <span class="compare-k">In</span>
    <div class="compare-track">
      <div class="compare-fill income" style="width:{incomePct}%"></div>
    </div>
    <span class="compare-v pos">{formatMoney(incomeMinor, currencyCode)}</span>
  </div>
  <div class="compare-row">
    <span class="compare-k">Out</span>
    <div class="compare-track">
      <div class="compare-fill expense" style="width:{expensePct}%"></div>
    </div>
    <span class="compare-v neg">{formatMoney(-expenseMinor, currencyCode)}</span>
  </div>
</div>

<style>
  .compare-chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .compare-row {
    display: grid;
    grid-template-columns: 2rem 1fr auto;
    gap: 0.55rem;
    align-items: center;
  }

  .compare-k {
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .compare-track {
    height: 0.85rem;
    background: var(--surface2);
    border: 1px solid var(--chrome-line);
    overflow: hidden;
  }

  .compare-fill {
    height: 100%;
    min-width: 2px;
  }

  .compare-fill.income {
    background: var(--pos);
  }

  .compare-fill.expense {
    background: var(--neg);
  }

  .compare-v {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
