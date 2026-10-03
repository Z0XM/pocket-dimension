<script lang="ts">
  import { formatMoney } from "$lib/finance/money";

  type Props = {
    incomeMinor: number;
    expenseMinor: number;
    netMinor?: number;
    currencyCode: string;
    compact?: boolean;
    ariaLabel?: string;
  };

  const {
    incomeMinor,
    expenseMinor,
    netMinor = undefined,
    currencyCode,
    compact = false,
    ariaLabel = "Income versus expense comparison",
  }: Props = $props();

  const showNet = $derived(netMinor !== undefined);
  const maxMinor = $derived(Math.max(incomeMinor, expenseMinor, Math.abs(netMinor ?? 0), 1));
  const incomePct = $derived(Math.round((incomeMinor / maxMinor) * 100));
  const expensePct = $derived(Math.round((expenseMinor / maxMinor) * 100));
  const netPct = $derived(Math.round((Math.abs(netMinor ?? 0) / maxMinor) * 100));
  const netTone = $derived((netMinor ?? 0) >= 0 ? "pos" : "neg");
</script>

<div class="compare-chart math-notebook" class:compact role="img" aria-label={ariaLabel}>
  <div class="compare-row">
    <span class="compare-k">In</span>
    <div class="compare-track">
      <div class="compare-fill income" style="width:{Math.max(incomePct, incomeMinor > 0 ? 2 : 0)}%"></div>
    </div>
    <span class="compare-v pos">{formatMoney(incomeMinor, currencyCode)}</span>
  </div>
  <div class="compare-row">
    <span class="compare-k">Out</span>
    <div class="compare-track">
      <div class="compare-fill expense" style="width:{Math.max(expensePct, expenseMinor > 0 ? 2 : 0)}%"></div>
    </div>
    <span class="compare-v neg">{formatMoney(-expenseMinor, currencyCode)}</span>
  </div>
  {#if showNet}
    <div class="compare-row">
      <span class="compare-k">Net</span>
      <div class="compare-track">
        <div
          class="compare-fill net"
          class:pos={netTone === "pos"}
          class:neg={netTone === "neg"}
          style="width:{Math.max(netPct, (netMinor ?? 0) !== 0 ? 2 : 0)}%"
        ></div>
      </div>
      <span class="compare-v" class:pos={netTone === "pos"} class:neg={netTone === "neg"}>
        {formatMoney(netMinor ?? 0, currencyCode)}
      </span>
    </div>
  {/if}
</div>

<style>
  .compare-chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .compare-chart.compact {
    gap: 0.42rem;
  }

  .math-notebook {
    padding: 0.55rem 0.45rem;
    background-image:
      linear-gradient(rgba(90, 130, 180, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 130, 180, 0.12) 1px, transparent 1px);
    background-size: 16px 16px;
    border-radius: 4px 12px 6px 10px / 10px 4px 12px 6px;
  }

  .compare-chart.compact.math-notebook {
    padding: 0.35rem 0.4rem;
    background-size: 14px 14px;
  }

  .compare-row {
    display: grid;
    grid-template-columns: 2.2rem 1fr auto;
    gap: 0.55rem;
    align-items: center;
  }

  .compare-chart.compact .compare-row {
    grid-template-columns: 1.9rem 1fr auto;
    gap: 0.4rem;
  }

  .compare-k {
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--muted);
  }

  .compare-chart.compact .compare-k {
    font-size: 0.88rem;
  }

  .compare-track {
    height: 0.85rem;
    background: color-mix(in srgb, var(--paper) 80%, var(--mix-wash));
    border: 1.25px solid color-mix(in srgb, var(--ink) 28%, transparent);
    overflow: hidden;
    border-radius: 2px 7px 3px 6px;
  }

  .compare-chart.compact .compare-track {
    height: 0.55rem;
    border-radius: 2px 6px 3px 5px;
  }

  .compare-fill {
    height: 100%;
    min-width: 0;
    border-radius: inherit;
  }

  .compare-fill.income,
  .compare-fill.net.pos {
    background: color-mix(in srgb, var(--green) 80%, var(--pos));
  }

  .compare-fill.expense,
  .compare-fill.net.neg {
    background: color-mix(in srgb, var(--pink) 75%, var(--neg));
  }

  .compare-v {
    font-family: var(--hand);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .compare-chart.compact .compare-v {
    font-size: 0.88rem;
  }
</style>
