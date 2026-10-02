<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { formatMoney } from "$lib/finance/money";

  type Props = {
    count: number;
    sumMinor: number;
    currencyCode: string;
    onClear: () => void;
    onClose: () => void;
  };

  const { count, sumMinor, currencyCode, onClear, onClose }: Props = $props();
</script>

<div class="calc-widget" role="status" aria-live="polite" aria-label="Live calculation">
  <div class="calc-widget-main">
    <span class="calc-stat">
      <span class="calc-k">Count</span>
      <span class="calc-v">{count.toLocaleString()}</span>
    </span>
    <span class="calc-divider" aria-hidden="true"></span>
    <span class="calc-stat">
      <span class="calc-k">Sum</span>
      <span class="calc-v mark">{formatMoney(sumMinor, currencyCode)}</span>
    </span>
  </div>
  <div class="calc-widget-actions">
    <button type="button" class="calc-action" disabled={count === 0} onclick={onClear}>Clear</button>
    <button type="button" class="calc-close" aria-label="Exit calculate mode" onclick={onClose}>
      <X size={15} strokeWidth={2.25} aria-hidden="true" />
    </button>
  </div>
</div>

<style>
  .calc-widget {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    z-index: 30;
    transform: translateX(-50%) rotate(-0.4deg);
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.55rem 0.65rem 0.55rem 0.9rem;
    background: var(--surface-raised);
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-radius: 3px 12px 5px 10px / 10px 4px 12px 5px;
    box-shadow:
      2px 3px 0 0 color-mix(in srgb, var(--yellow) 55%, var(--shadow-paper)),
      2px 3px 0 1.5px color-mix(in srgb, var(--ink) 16%, transparent);
    max-width: calc(100vw - 2rem);
    font-family: var(--hand);
    color: var(--ink);
  }

  .calc-widget-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .calc-stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .calc-k {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-muted);
    line-height: 1;
  }

  .calc-v {
    font-size: 1.05rem;
    font-weight: 400;
    color: var(--ink);
    white-space: nowrap;
    line-height: 1.15;
  }

  .calc-v.mark {
    display: inline-block;
    width: fit-content;
    padding: 0.05rem 0.28rem;
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    border-radius: 2px 8px 3px 7px / 7px 2px 8px 2px;
    transform: rotate(-0.5deg);
  }

  .calc-divider {
    width: 1.5px;
    align-self: stretch;
    background: color-mix(in srgb, var(--ink) 18%, transparent);
    flex-shrink: 0;
    transform: rotate(2deg);
  }

  .calc-widget-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .calc-action {
    appearance: none;
    border: 1.5px solid color-mix(in srgb, var(--ink) 28%, transparent);
    background: color-mix(in srgb, var(--paper) 70%, var(--mix-wash));
    color: var(--ink);
    font-family: var(--hand);
    font-size: 0.88rem;
    letter-spacing: 0.01em;
    text-transform: none;
    padding: 0.28rem 0.6rem;
    border-radius: 255px 10px 225px 8px / 10px 225px 8px 255px;
    cursor: pointer;
  }

  .calc-action:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
    background: var(--brand-soft);
  }

  .calc-action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .calc-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.28rem;
    border: none;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    border-radius: 4px;
  }

  .calc-close:hover {
    color: var(--brand);
  }
</style>
