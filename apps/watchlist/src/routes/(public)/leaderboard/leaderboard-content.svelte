<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import FilterDropdown from "$routes/(public)/data-table-helpers/filter-dropdown.svelte";
  import * as Card from "$lib/components/ui/card";
  import { METRIC_LABELS, type LeaderboardData, type LeaderboardMetric } from "$lib/server/leaderboard";

  type Props = {
    leaderboard: LeaderboardData;
  };

  const { leaderboard }: Props = $props();

  const METRICS: LeaderboardMetric[] = ["watched", "watching", "watch_later", "dropped", "all_rated"];

  const RANK_COLORS: Record<number, string> = {
    1: "#fbbf24",
    2: "#94a3b8",
    3: "#d97706",
  };

  const maxCount = $derived(leaderboard.entries.reduce((max, entry) => Math.max(max, entry.count), 0));

  function displayName(entry: LeaderboardData["entries"][number]): string {
    return entry.displayUsername ?? entry.username;
  }

  function updateUrl(updates: {
    metric?: LeaderboardMetric;
    filterLanguage?: string[];
    filterType?: string[];
    filterTags?: string[];
  }) {
    const url = new URL(page.url);

    if (updates.metric !== undefined) {
      if (updates.metric === "watched") {
        url.searchParams.delete("metric");
      } else {
        url.searchParams.set("metric", updates.metric);
      }
    }

    if (updates.filterLanguage !== undefined) {
      if (updates.filterLanguage.length === 0) {
        url.searchParams.delete("filterLanguage");
      } else {
        url.searchParams.set("filterLanguage", updates.filterLanguage.join(","));
      }
    }

    if (updates.filterType !== undefined) {
      if (updates.filterType.length === 0) {
        url.searchParams.delete("filterType");
      } else {
        url.searchParams.set("filterType", updates.filterType.join(","));
      }
    }

    if (updates.filterTags !== undefined) {
      if (updates.filterTags.length === 0) {
        url.searchParams.delete("filterTags");
      } else {
        url.searchParams.set("filterTags", updates.filterTags.join(","));
      }
    }

    goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
  }

  const activeFilterCount = $derived(
    leaderboard.filters.languages.length + leaderboard.filters.types.length + leaderboard.filters.tags.length
  );

  const filterSummary = $derived.by(() => {
    const parts: string[] = [];
    if (leaderboard.filters.types.length > 0) {
      parts.push(leaderboard.filters.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", "));
    }
    if (leaderboard.filters.languages.length > 0) {
      parts.push(leaderboard.filters.languages.join(", "));
    }
    if (leaderboard.filters.tags.length > 0) {
      parts.push(leaderboard.filters.tags.join(", "));
    }
    return parts.join(" · ");
  });
</script>

<div class="h-screen overflow-y-scroll pb-28">
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
    <div class="space-y-2">
      <h1 class="text-3xl font-medium">Leaderboard</h1>
      <p class="text-muted-foreground text-sm max-w-2xl">
        See who has marked the most titles. Filter by type, language, or tags to compare rankings in specific categories.
      </p>
    </div>

    <div class="metric-toggle" role="tablist" aria-label="Leaderboard metric">
      {#each METRICS as metric}
        <button
          type="button"
          role="tab"
          aria-selected={leaderboard.metric === metric}
          class:active={leaderboard.metric === metric}
          onclick={() => updateUrl({ metric })}
        >
          {METRIC_LABELS[metric]}
        </button>
      {/each}
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">Type</span>
        <FilterDropdown
          options={leaderboard.filterOptions.types}
          selectedValues={leaderboard.filters.types}
          onApply={(values) => updateUrl({ filterType: values })}
          placeholder="Search types..."
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">Language</span>
        <FilterDropdown
          options={leaderboard.filterOptions.languages}
          selectedValues={leaderboard.filters.languages}
          onApply={(values) => updateUrl({ filterLanguage: values })}
          placeholder="Search languages..."
        />
      </div>
      <div class="filter-group">
        <span class="filter-label">Tags</span>
        <FilterDropdown
          options={leaderboard.filterOptions.tags}
          selectedValues={leaderboard.filters.tags}
          onApply={(values) => updateUrl({ filterTags: values })}
          placeholder="Search tags..."
        />
      </div>
      {#if activeFilterCount > 0}
        <button
          type="button"
          class="clear-filters"
          onclick={() =>
            updateUrl({
              filterLanguage: [],
              filterType: [],
              filterTags: [],
            })}
        >
          Clear filters
        </button>
      {/if}
    </div>

    {#if filterSummary}
      <p class="filter-summary">
        Showing <strong>{METRIC_LABELS[leaderboard.metric]}</strong> for: {filterSummary}
      </p>
    {/if}

    <Card.Root class="py-4">
      <Card.Content class="px-4">
        {#if leaderboard.entries.length > 0}
          <ul class="rankings" role="list">
            {#each leaderboard.entries as entry (entry.userId)}
              <li class="ranking-row">
                <span class="rank" style={RANK_COLORS[entry.rank] ? `color: ${RANK_COLORS[entry.rank]}` : undefined}>
                  #{entry.rank}
                </span>
                <div class="user-info">
                  <span class="username">{displayName(entry)}</span>
                  {#if entry.displayUsername && entry.displayUsername !== entry.username}
                    <span class="handle">@{entry.username}</span>
                  {/if}
                </div>
                <div class="count-bar">
                  <div class="count-meta">
                    <span class="count-label">{METRIC_LABELS[leaderboard.metric]}</span>
                    <span class="count-value">{entry.count}</span>
                  </div>
                  <div class="bar-track">
                    <div
                      class="bar-fill"
                      style={`width: ${maxCount > 0 ? Math.max(4, (entry.count / maxCount) * 100) : 0}%; background: ${RANK_COLORS[entry.rank] ?? "var(--accent)"}`}
                    ></div>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">No rankings yet for this filter combination.</p>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>

<style>
  .metric-toggle {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.2rem;
    border-radius: 999px;
    background: color-mix(in oklch, var(--muted) 70%, transparent);
    border: 1px solid color-mix(in oklch, var(--border) 80%, transparent);
    width: fit-content;
    max-width: 100%;
  }

  .metric-toggle button {
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.45rem 0.75rem;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
  }

  .metric-toggle button.active {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .filter-label {
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .clear-filters {
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0.25rem 0;
  }

  .clear-filters:hover {
    color: var(--foreground);
  }

  .filter-summary {
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }

  .rankings {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ranking-row {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    grid-template-rows: auto auto;
    gap: 0.15rem 0.75rem;
    align-items: center;
  }

  .rank {
    grid-row: 1 / 3;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted-foreground);
    text-align: center;
  }

  .user-info {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-width: 0;
  }

  .username {
    font-size: 0.9rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .handle {
    font-size: 0.72rem;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .count-bar {
    grid-column: 2;
  }

  .count-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
    font-size: 0.68rem;
  }

  .count-label {
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .count-value {
    font-family: var(--font-mono);
    color: var(--muted-foreground);
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
    font-size: 0.85rem;
    padding: 2rem 0;
    text-align: center;
  }

  @media (min-width: 640px) {
    .ranking-row {
      grid-template-columns: 3rem 10rem 1fr;
      grid-template-rows: auto;
      gap: 0 1rem;
    }

    .rank {
      grid-row: auto;
    }

    .count-bar {
      grid-column: 3;
    }
  }
</style>
