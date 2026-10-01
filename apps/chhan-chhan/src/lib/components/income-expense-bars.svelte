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

<div class="compare-chart math-notebook" role="img" aria-label="Income versus expense comparison">
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

  .math-notebook {
    padding: 0.55rem 0.45rem;
    background-image:
      linear-gradient(rgba(90, 130, 180, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 130, 180, 0.12) 1px, transparent 1px);
    background-size: 16px 16px;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
  }

  .compare-row {
    display: grid;
    grid-template-columns: 2.2rem 1fr auto;
    gap: 0.55rem;
    align-items: center;
  }

  .compare-k {
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--muted);
  }

  .compare-track {
    height: 0.85rem;
    background: color-mix(in srgb, var(--paper) 80%, white);
    border: 1.25px solid color-mix(in srgb, var(--ink) 28%, transparent);
    overflow: hidden;
    border-radius: 2px 7px 3px 6px;
  }

  .compare-fill {
    height: 100%;
    min-width: 2px;
  }

  .compare-fill.income {
    background: color-mix(in srgb, var(--green) 80%, var(--pos));
  }

  .compare-fill.expense {
    background: color-mix(in srgb, var(--pink) 75%, var(--neg));
  }

  .compare-v {
    font-family: var(--hand);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
