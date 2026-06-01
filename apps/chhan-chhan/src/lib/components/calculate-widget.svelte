<script lang="ts">
  import { X } from "@lucide/svelte";
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
      <span class="calc-v mono">{formatMoney(sumMinor, currencyCode)}</span>
    </span>
  </div>
  <div class="calc-widget-actions">
    <button type="button" class="calc-action" disabled={count === 0} onclick={onClear}>Clear</button>
    <button type="button" class="calc-close" aria-label="Exit calculate mode" onclick={onClose}>
      <X size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  </div>
</div>

<style>
  .calc-widget {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    z-index: 30;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.55rem 0.65rem 0.55rem 0.85rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 6px 6px 0 rgba(234, 242, 240, 0.12);
    max-width: calc(100vw - 2rem);
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
    gap: 0.08rem;
    min-width: 0;
  }

  .calc-k {
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .calc-v {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--main-text);
    white-space: nowrap;
  }

  .calc-v.mono {
    font-family: "IBM Plex Mono", monospace;
    color: var(--hi-cyan);
  }

  .calc-divider {
    width: 1px;
    align-self: stretch;
    background: var(--chrome-line);
    flex-shrink: 0;
  }

  .calc-widget-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .calc-action {
    border: 2px solid var(--chrome-line);
    background: var(--surface2);
    color: var(--main-text);
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
  }

  .calc-action:hover:not(:disabled) {
    color: var(--hi-purple);
  }

  .calc-action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .calc-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .calc-close:hover {
    color: var(--brand-accent);
  }
</style>
