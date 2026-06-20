<script lang="ts">
  type BarItem = {
    label: string;
    value: number;
    color?: string;
    displayValue?: string;
  };

  type Props = {
    title: string;
    data: BarItem[];
    emptyLabel?: string;
    valueSuffix?: string;
  };

  const { title, data, emptyLabel = "No data yet", valueSuffix = "" }: Props = $props();

  const maxValue = $derived(data.reduce((max, item) => Math.max(max, item.value), 0));
</script>

<div class="chart-card">
  <h3 class="chart-title">{title}</h3>
  {#if data.length > 0}
    <ul class="bars" role="list">
      {#each data as item (item.label)}
        <li>
          <div class="bar-meta">
            <span class="bar-label">{item.label}</span>
            <span class="bar-value">{item.displayValue ?? `${item.value}${valueSuffix}`}</span>
          </div>
          <div class="bar-track">
            <div
              class="bar-fill"
              style={`width: ${maxValue > 0 ? Math.max(4, (item.value / maxValue) * 100) : 0}%; background: ${item.color ?? "var(--accent)"}`}
            ></div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">{emptyLabel}</p>
  {/if}
</div>

<style>
  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    height: 100%;
  }

  .chart-title {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .bar-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
    font-size: 0.72rem;
  }

  .bar-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-value {
    font-family: var(--font-mono);
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .bar-track {
    height: 0.45rem;
    border-radius: 999px;
    background: color-mix(in oklch, var(--muted) 55%, transparent);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.2s ease;
  }

  .empty {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    padding: 2rem 0;
    text-align: center;
  }
</style>
