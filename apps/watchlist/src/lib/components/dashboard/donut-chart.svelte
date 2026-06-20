<script lang="ts">
  type Slice = {
    label: string;
    count: number;
    color: string;
  };

  type Props = {
    title: string;
    data: Slice[];
    emptyLabel?: string;
  };

  const { title, data, emptyLabel = "No data yet" }: Props = $props();

  const total = $derived(data.reduce((sum, item) => sum + item.count, 0));

  const gradient = $derived.by(() => {
    if (total <= 0) return "conic-gradient(var(--muted) 0deg 360deg)";

    let current = 0;
    const stops = data.map((item) => {
      const start = (current / total) * 360;
      current += item.count;
      const end = (current / total) * 360;
      return `${item.color} ${start}deg ${end}deg`;
    });

    return `conic-gradient(${stops.join(", ")})`;
  });
</script>

<div class="chart-card">
  <h3 class="chart-title">{title}</h3>
  {#if total > 0}
    <div class="donut-layout">
      <div class="donut" style={`background: ${gradient}`} role="img" aria-label={title}>
        <div class="donut-hole">
          <span class="donut-total">{total}</span>
          <span class="donut-label">total</span>
        </div>
      </div>
      <ul class="legend">
        {#each data as item (item.label)}
          <li>
            <span class="swatch" style={`background: ${item.color}`}></span>
            <span class="legend-label">{item.label}</span>
            <span class="legend-value">{item.count}</span>
          </li>
        {/each}
      </ul>
    </div>
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

  .donut-layout {
    display: grid;
    grid-template-columns: minmax(7rem, 9rem) 1fr;
    gap: 1rem;
    align-items: center;
  }

  .donut {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 999px;
    display: grid;
    place-items: center;
  }

  .donut-hole {
    width: 58%;
    aspect-ratio: 1;
    border-radius: 999px;
    background: color-mix(in oklch, var(--background) 88%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
  }

  .donut-total {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }

  .donut-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
  }

  .legend {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .legend li {
    display: grid;
    grid-template-columns: 0.65rem 1fr auto;
    gap: 0.45rem;
    align-items: center;
    font-size: 0.72rem;
  }

  .swatch {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 2px;
  }

  .legend-label {
    color: var(--foreground);
  }

  .legend-value {
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }

  .empty {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    padding: 2rem 0;
    text-align: center;
  }

  @media (max-width: 480px) {
    .donut-layout {
      grid-template-columns: 1fr;
      justify-items: center;
    }
  }
</style>
