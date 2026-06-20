<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import DonutChart from "$lib/components/dashboard/donut-chart.svelte";
  import HistogramChart from "$lib/components/dashboard/histogram-chart.svelte";
  import HorizontalBarChart from "$lib/components/dashboard/horizontal-bar-chart.svelte";
  import StackedBarChart from "$lib/components/dashboard/stacked-bar-chart.svelte";
  import StatCard from "$lib/components/dashboard/stat-card.svelte";
  import * as Card from "$lib/components/ui/card";
  import type { DashboardData } from "$lib/server/dashboard";

  const { data } = $props();

  const dashboard = $derived(data.dashboard as DashboardData | null);
  const scope = $derived(dashboard?.scope ?? "catalog");
  const isPersonal = $derived(scope === "personal");

  const TYPE_COLORS: Record<string, string> = {
    Movie: "#913ec9",
    Series: "#771fb0",
    Shorts: "#c084fc",
  };

  const PROGRESS_COLORS: Record<string, string> = {
    "Watch Later": "#94a3b8",
    Watching: "#60a5fa",
    Watched: "#4ade80",
    Dropped: "#f87171",
    Unmarked: "#64748b",
  };

  function formatRating(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—";
    return value.toFixed(1);
  }

  function setScope(nextScope: "catalog" | "personal") {
    const url = new URL(page.url);
    if (nextScope === "catalog") {
      url.searchParams.delete("scope");
    } else {
      url.searchParams.set("scope", "personal");
    }
    goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
  }
</script>

<div class="h-screen overflow-y-scroll pb-28">
  <div class="max-w-6xl mx-auto px-4 py-8 space-y-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="space-y-2">
        <h1 class="text-3xl font-medium">Dashboard</h1>
        <p class="text-muted-foreground text-sm max-w-2xl">
          Charts and stats for the shared catalog{isPersonal ? " and your personal watch progress" : ""}.
        </p>
      </div>

      {#if data.isLoggedIn}
        <div class="scope-toggle" role="tablist" aria-label="Dashboard scope">
          <button
            type="button"
            role="tab"
            aria-selected={!isPersonal}
            class:active={!isPersonal}
            onclick={() => setScope("catalog")}
          >
            Catalog
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isPersonal}
            class:active={isPersonal}
            onclick={() => setScope("personal")}
          >
            My Stats
          </button>
        </div>
      {/if}
    </div>

    {#if dashboard}
      <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Titles" value={dashboard.kpis.totalTitles} />
        <StatCard label="Movies" value={dashboard.kpis.movies} />
        <StatCard label="Series" value={dashboard.kpis.series} />
        <StatCard label="Shorts" value={dashboard.kpis.shorts} />
        <StatCard label="Languages" value={dashboard.kpis.languages} />
        <StatCard label="Tags" value={dashboard.kpis.tags} />
        <StatCard label={isPersonal ? "My Avg Rating" : "Catalog Avg Rating"} value={formatRating(isPersonal ? dashboard.kpis.myAvgRating : dashboard.kpis.avgRating)} />
        <StatCard label={isPersonal ? "My Ratings" : "Total Ratings"} value={isPersonal ? (dashboard.kpis.watched ?? 0) + (dashboard.kpis.watchLater ?? 0) + (dashboard.kpis.watching ?? 0) + (dashboard.kpis.dropped ?? 0) : dashboard.kpis.totalRatings} />
      </section>

      {#if isPersonal}
        <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Watched" value={dashboard.kpis.watched ?? 0} />
          <StatCard label="Watch Later" value={dashboard.kpis.watchLater ?? 0} />
          <StatCard label="Watching" value={dashboard.kpis.watching ?? 0} />
          <StatCard label="Dropped" value={dashboard.kpis.dropped ?? 0} />
          <StatCard label="Unmarked" value={dashboard.kpis.unmarked ?? 0} />
          <StatCard label="Infinity Marks" value={dashboard.kpis.myInfinity ?? 0} hint="♾️ ratings" />
          <StatCard label="Shitty Marks" value={dashboard.kpis.myShitty ?? 0} hint="💩 ratings" />
        </section>
      {/if}

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card.Root class="py-4">
          <Card.Content class="px-4">
            <DonutChart
              title="Media Type Mix"
              data={dashboard.typeBreakdown.map((item) => ({
                label: item.label,
                count: item.count,
                color: TYPE_COLORS[item.label] ?? "var(--accent)",
              }))}
            />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4">
          <Card.Content class="px-4">
            <DonutChart
              title={isPersonal ? "My Progress" : "Community Progress"}
              data={dashboard.progressBreakdown.map((item) => ({
                label: item.label,
                count: item.count,
                color: PROGRESS_COLORS[item.label] ?? "var(--accent)",
              }))}
            />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4">
          <Card.Content class="px-4">
            <HorizontalBarChart title="Titles by Language" data={dashboard.languageBreakdown.map((item) => ({ label: item.label, value: item.count }))} />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4">
          <Card.Content class="px-4">
            <HorizontalBarChart title="Top Tags" data={dashboard.topTags.map((item) => ({ label: item.label, value: item.count }))} />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4 lg:col-span-2">
          <Card.Content class="px-4">
            <StackedBarChart
              title={isPersonal ? "My Progress by Type" : "Community Progress by Type"}
              data={dashboard.progressByType}
              statusColors={PROGRESS_COLORS}
            />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4 lg:col-span-2">
          <Card.Content class="px-4">
            <HistogramChart title={isPersonal ? "My Rating Distribution" : "Rating Distribution"} data={dashboard.ratingHistogram} />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4">
          <Card.Content class="px-4">
            <HorizontalBarChart
              title={isPersonal ? "My Avg Rating by Type" : "Avg Rating by Type"}
              data={dashboard.avgRatingByType.map((item) => ({
                label: item.label,
                value: item.avgRating ?? 0,
                displayValue: formatRating(item.avgRating),
              }))}
              emptyLabel="No numeric ratings yet"
            />
          </Card.Content>
        </Card.Root>

        <Card.Root class="py-4">
          <Card.Content class="px-4">
            <HorizontalBarChart
              title={isPersonal ? "My Avg Rating by Language" : "Avg Rating by Language"}
              data={dashboard.avgRatingByLanguage.map((item) => ({
                label: item.label,
                value: item.avgRating ?? 0,
                displayValue: formatRating(item.avgRating),
              }))}
              emptyLabel="No numeric ratings yet"
            />
          </Card.Content>
        </Card.Root>
      </section>
    {:else}
      <Card.Root>
        <Card.Content class="px-4 py-8 text-center text-muted-foreground">
          Unable to load dashboard data. Make sure the database is running and try again.
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>

<style>
  .scope-toggle {
    display: inline-flex;
    padding: 0.2rem;
    border-radius: 999px;
    background: color-mix(in oklch, var(--muted) 70%, transparent);
    border: 1px solid color-mix(in oklch, var(--border) 80%, transparent);
  }

  .scope-toggle button {
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    cursor: pointer;
  }

  .scope-toggle button.active {
    background: var(--accent);
    color: var(--accent-foreground);
  }
</style>
