<script lang="ts">
  type Bucket = {
    bucket: number;
    count: number;
  };

  type Props = {
    title: string;
    data: Bucket[];
    emptyLabel?: string;
  };

  const { title, data, emptyLabel = "No ratings yet" }: Props = $props();

  const maxCount = $derived(data.reduce((max, item) => Math.max(max, item.count), 0));

  function barHeight(count: number): string {
    if (maxCount <= 0 || count <= 0) return "0%";
    return `${Math.max(6, (count / maxCount) * 100)}%`;
  }

  function formatBucket(bucket: number): string {
    return Number.isInteger(bucket) ? String(bucket) : bucket.toFixed(1);
  }
</script>

<div class="chart-card">
  <h3 class="chart-title">{title}</h3>
  {#if data.length > 0}
    <div class="histogram" role="img" aria-label={title}>
      {#each data as item (`${item.bucket}`)}
        <div class="hist-col">
          <div class="hist-bar-wrap">
            <div class="hist-bar" style={`height: ${barHeight(item.count)}`} title="{item.count} ratings at {formatBucket(item.bucket)}"></div>
          </div>
          <span class="hist-label">{formatBucket(item.bucket)}</span>
        </div>
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

  .histogram {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(1.4rem, 1fr));
    gap: 0.35rem;
    align-items: end;
    min-height: 9rem;
    padding-top: 0.5rem;
  }

  .hist-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .hist-bar-wrap {
    width: 100%;
    height: 7rem;
    display: flex;
    align-items: flex-end;
  }

  .hist-bar {
    width: 100%;
    border-radius: 3px 3px 1px 1px;
    background: linear-gradient(180deg, #b794f6 0%, var(--accent) 100%);
    min-height: 0;
  }

  .hist-label {
    font-size: 0.58rem;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }

  .empty {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    padding: 2rem 0;
    text-align: center;
  }
</style>
