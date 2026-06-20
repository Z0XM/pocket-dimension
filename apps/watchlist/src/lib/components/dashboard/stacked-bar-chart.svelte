<script lang="ts">
  type Row = {
    type: string;
    status: string;
    count: number;
  };

  type Props = {
    title: string;
    data: Row[];
    statusColors: Record<string, string>;
    emptyLabel?: string;
  };

  const { title, data, statusColors, emptyLabel = "No data yet" }: Props = $props();

  const types = $derived([...new Set(data.map((row) => row.type))]);
  const statuses = $derived([...new Set(data.map((row) => row.status))]);

  const rows = $derived(
    types.map((type) => {
      const segments = statuses
        .map((status) => {
          const match = data.find((row) => row.type === type && row.status === status);
          return { status, count: match?.count ?? 0 };
        })
        .filter((segment) => segment.count > 0);

      const total = segments.reduce((sum, segment) => sum + segment.count, 0);
      return { type, segments, total };
    })
  );

  const hasData = $derived(rows.some((row) => row.total > 0));
</script>

<div class="chart-card">
  <h3 class="chart-title">{title}</h3>
  {#if hasData}
    <ul class="stacked-bars" role="list">
      {#each rows as row (row.type)}
        {#if row.total > 0}
          <li>
            <div class="row-meta">
              <span>{row.type}</span>
              <span class="row-total">{row.total}</span>
            </div>
            <div class="row-track">
              {#each row.segments as segment (segment.status)}
                <div
                  class="row-segment"
                  style={`flex: ${segment.count} 1 0; background: ${statusColors[segment.status] ?? "var(--accent)"}`}
                  title="{segment.status}: {segment.count}"
                ></div>
              {/each}
            </div>
          </li>
        {/if}
      {/each}
    </ul>
    <div class="legend">
      {#each statuses as status (status)}
        <span><i style={`background: ${statusColors[status] ?? "var(--accent)"}`}></i>{status}</span>
      {/each}
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

  .stacked-bars {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    margin-bottom: 0.25rem;
  }

  .row-total {
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }

  .row-track {
    display: flex;
    height: 0.55rem;
    width: 100%;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in oklch, var(--muted) 55%, transparent);
  }

  .row-segment {
    height: 100%;
    min-width: 2px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem 0.85rem;
    font-size: 0.64rem;
    color: var(--muted-foreground);
  }

  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .legend i {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 2px;
    display: inline-block;
  }

  .empty {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    padding: 2rem 0;
    text-align: center;
  }
</style>
