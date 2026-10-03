<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { formatMoney } from "$lib/finance/money";
  import { formatMonthKeyShort, type SummaryPeriod } from "$lib/finance/summary";
  import {
    DASHBOARD_WIDGETS_STORAGE_KEY,
    isDashboardWidgetEnabled,
    parseDashboardWidgets,
    serializeDashboardWidgets,
    type DashboardWidgetId,
  } from "$lib/finance/dashboard-widgets";
  import AppNav from "$lib/components/app-nav.svelte";
  import AppSettings from "$lib/components/app-settings.svelte";
  import CategoryTrendChart from "$lib/components/category-trend-chart.svelte";
  import BillingPanel from "$lib/components/billing-panel.svelte";
  import DashboardWidgetPicker from "$lib/components/dashboard-widget-picker.svelte";
  import IncomeExpenseBars from "$lib/components/income-expense-bars.svelte";
  import MeterBar from "$lib/components/meter-bar.svelte";
  import MonthlyTrendChart from "$lib/components/monthly-trend-chart.svelte";
  import SketchSelect from "$lib/components/sketch-select.svelte";
  import SpendPieChart from "$lib/components/spend-pie-chart.svelte";
  import BrandMark from "$lib/components/brand-mark.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  function dashboardUrl(
    updates: {
      summary?: SummaryPeriod;
      month?: string;
      year?: number;
      widgets?: DashboardWidgetId[];
    } = {}
  ) {
    const params = new URLSearchParams();
    const summary = updates.summary ?? data.summaryPeriod;
    const month = updates.month ?? data.selectedMonth;
    const year = updates.year ?? data.selectedYear;
    const widgets = updates.widgets ?? data.enabledWidgets;

    if (summary === "year") {
      params.set("summary", "year");
      params.set("year", String(year));
    } else if (summary === "all") {
      params.set("summary", "all");
    } else {
      params.set("summary", "month");
      params.set("month", month);
    }

    params.set("widgets", serializeDashboardWidgets(widgets));

    return `/app/dashboards?${params.toString()}`;
  }

  function setSummaryPeriod(period: SummaryPeriod) {
    const updates: {
      summary: SummaryPeriod;
      month?: string;
      year?: number;
    } = { summary: period };

    if (period === "year") {
      updates.year = data.summaryYears.includes(data.selectedYear) ? data.selectedYear : (data.summaryYears[0] ?? new Date().getFullYear());
    } else if (period === "month") {
      updates.month = data.selectedMonth;
    }

    goto(dashboardUrl(updates), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setSummaryMonth(month: string) {
    goto(dashboardUrl({ summary: "month", month }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setSummaryYear(year: number) {
    goto(dashboardUrl({ summary: "year", year }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function setEnabledWidgets(widgets: DashboardWidgetId[]) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DASHBOARD_WIDGETS_STORAGE_KEY, serializeDashboardWidgets(widgets));
    }
    goto(dashboardUrl({ widgets }), { keepFocus: true, noScroll: true, invalidateAll: true });
  }

  function transactionsUrl(type?: "income" | "expense") {
    const params = new URLSearchParams();
    if (data.summaryPeriod === "year") {
      params.set("summary", "year");
      params.set("year", String(data.selectedYear));
    } else if (data.summaryPeriod === "all") {
      params.set("summary", "all");
    } else {
      params.set("summary", "month");
      params.set("month", data.selectedMonth);
    }
    if (type) params.set("type", type);
    const query = params.toString();
    return query ? `/app/transactions?${query}` : "/app/transactions";
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("widgets") || typeof localStorage === "undefined") return;

    const stored = localStorage.getItem(DASHBOARD_WIDGETS_STORAGE_KEY);
    if (!stored) return;

    const storedWidgets = parseDashboardWidgets(stored);
    const currentWidgets = data.enabledWidgets;
    if (serializeDashboardWidgets(storedWidgets) === serializeDashboardWidgets(currentWidgets)) return;

    goto(dashboardUrl({ widgets: storedWidgets }), { replaceState: true, noScroll: true, invalidateAll: true });
  });

  const showSummaryRow = $derived(
    isDashboardWidgetEnabled(data.enabledWidgets, "summary-month") || isDashboardWidgetEnabled(data.enabledWidgets, "summary-all")
  );

  const showSpendingRow = $derived(
    isDashboardWidgetEnabled(data.enabledWidgets, "category-spend") ||
      isDashboardWidgetEnabled(data.enabledWidgets, "tag-spend") ||
      isDashboardWidgetEnabled(data.enabledWidgets, "merchant-spend") ||
      isDashboardWidgetEnabled(data.enabledWidgets, "group-spend")
  );

  const showTrendsRow = $derived(
    isDashboardWidgetEnabled(data.enabledWidgets, "monthly-trend") || isDashboardWidgetEnabled(data.enabledWidgets, "category-trend")
  );

  const showGoalsRow = $derived(isDashboardWidgetEnabled(data.enabledWidgets, "budgets") || isDashboardWidgetEnabled(data.enabledWidgets, "goals"));

  const showBillingRow = $derived(
    isDashboardWidgetEnabled(data.enabledWidgets, "monthly-bills") || isDashboardWidgetEnabled(data.enabledWidgets, "yearly-bills")
  );

  const PILL_TONES = ["blue", "purple", "yellow", "green", "pink", "orange"] as const;
</script>

<svelte:head><title>Dashboards · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1 class="brand-lockup">
      <BrandMark />
      <span class="brand-word"><span>CHHAN</span><span class="acid"> CHHAN</span></span>
    </h1>
    <AppNav />
  </div>
  <div class="actions">
    <AppSettings />
  </div>
</header>

{#if data.currentBalance}
  <div class="hero-row">
    <div class="hero-main">
      <section class="balance-open" class:stale={data.currentBalance.isStale}>
        <span class="k">balance</span>
        <div class="balance-value-wrap">
          <span class="v">
            <span class="rough-mark is-balance">
              <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                <rect x="1" y="3" width="118" height="20" rx="2" fill="color-mix(in srgb, var(--yellow) 78%, transparent)" />
              </svg>
              <span class="txt">{formatMoney(data.currentBalance.balanceMinor, data.account.currencyCode)}</span>
            </span>
          </span>
          <span class="balance-txn-count">{data.currentBalance.transactionCount.toLocaleString()} txns</span>
        </div>
        <span class="meta">
          {#if data.currentBalance.isStale}
            as of {data.currentBalance.asOf} · latest txn {data.currentBalance.latestTransactionOn} —
            <a href="/app/control">re-import statement</a> to refresh
          {:else}
            as of {data.currentBalance.asOf}
          {/if}
        </span>
      </section>
    </div>
    <aside class="sticky-stack" aria-label="Tips">
      <div class="taped-sticky">
        Tip: tap In / Out to jump into filtered transactions.
        <span class="tiny">marker paper</span>
      </div>
      <div class="taped-sticky blue">
        Customise fonts & paper in Control.
        <span class="tiny">your notebook</span>
      </div>
    </aside>
  </div>
{/if}

<section class="stats-block">
  <div class="stats-head">
    <div class="stats-label">
      <span>Summary</span>
      {#if data.summaryPeriod === "month"}
        {#if data.summaryMonths.length}
          <SketchSelect
            name="summary-month"
            compact
            aria-label="Select month"
            value={data.selectedMonth}
            options={data.summaryMonths.map((monthKey) => ({ value: monthKey, label: formatMonthKeyShort(monthKey) }))}
            onChange={setSummaryMonth}
          />
        {/if}
      {:else if data.summaryPeriod === "year"}
        {#if data.summaryYears.length}
          <SketchSelect
            name="summary-year"
            compact
            aria-label="Select year"
            value={String(data.selectedYear)}
            options={data.summaryYears.map((year) => ({ value: String(year), label: String(year) }))}
            onChange={(next) => setSummaryYear(Number(next))}
          />
        {/if}
      {:else}
        <span class="period-static">All time</span>
      {/if}
    </div>
    <div class="head-filters">
      <DashboardWidgetPicker enabledWidgets={data.enabledWidgets} onchange={setEnabledWidgets} />
      <div class="period-tabs" role="tablist" aria-label="Summary period">
        <button
          type="button"
          role="tab"
          class:active={data.summaryPeriod === "month"}
          aria-selected={data.summaryPeriod === "month"}
          onclick={() => setSummaryPeriod("month")}
        >
          Month
        </button>
        <button
          type="button"
          role="tab"
          class:active={data.summaryPeriod === "year"}
          aria-selected={data.summaryPeriod === "year"}
          onclick={() => setSummaryPeriod("year")}
        >
          Year
        </button>
        <button
          type="button"
          role="tab"
          class:active={data.summaryPeriod === "all"}
          aria-selected={data.summaryPeriod === "all"}
          onclick={() => setSummaryPeriod("all")}
        >
          All
        </button>
      </div>
    </div>
  </div>

  <div class="flow" aria-label="Period flow">
    <a class="node" href={transactionsUrl("income")}>
      <span class="node-k">in</span>
      <span class="node-v pos">
        <span class="rough-mark is-in">
          <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <rect x="1" y="4" width="118" height="18" rx="2" fill="color-mix(in srgb, var(--green) 72%, transparent)" />
          </svg>
          <span class="txt">{formatMoney(data.summary.incomeMinor, data.account.currencyCode)}</span>
        </span>
      </span>
    </a>
    <span class="arrow" aria-hidden="true">→</span>
    <span class="node period-node">{data.summaryLabel.toLowerCase()}</span>
    <span class="arrow" aria-hidden="true">→</span>
    <a class="node" href={transactionsUrl("expense")}>
      <span class="node-k">out</span>
      <span class="node-v neg">
        <span class="rough-mark is-out">
          <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <rect x="1" y="5" width="118" height="17" rx="2" fill="color-mix(in srgb, var(--pink) 70%, transparent)" />
          </svg>
          <span class="txt">{formatMoney(-data.summary.expenseMinor, data.account.currencyCode)}</span>
        </span>
      </span>
    </a>
    <span class="arrow" aria-hidden="true">=</span>
    <a class="node net-node" href={transactionsUrl()}>
      <span class="node-k">net</span>
      <span class="node-v">
        <span class="rough-mark is-net">
          <svg class="stroke" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <rect x="1" y="3" width="118" height="20" rx="2" fill="color-mix(in srgb, var(--purple) 75%, transparent)" />
          </svg>
          <span class="txt">{formatMoney(data.summary.netMinor, data.account.currencyCode)}</span>
        </span>
      </span>
    </a>
    <span class="saved-chip" title="Savings rate">{Math.round(data.summary.savingsRate * 100)}% saved</span>
  </div>

  {#if data.categorySpend.length}
    <div class="pills" aria-label="Top categories">
      {#each data.categorySpend.slice(0, 6) as row, i (row.name)}
        <span class="pill pill-{PILL_TONES[i % PILL_TONES.length]}">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 12.5 L8 3.5 L13 12.5 Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          </svg>
          {row.name}
        </span>
      {/each}
    </div>
  {/if}
</section>

{#if showSummaryRow}
  <section class="dash-grid">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "summary-month") && data.monthly}
      <article class="dash-panel">
        <h2>This month</h2>
        <IncomeExpenseBars
          compact
          incomeMinor={data.monthly.incomeMinor}
          expenseMinor={data.monthly.expenseMinor}
          netMinor={data.monthly.netMinor}
          currencyCode={data.account.currencyCode}
          ariaLabel="This month income, expense, and net"
        />
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "summary-all") && data.allTime}
      <article class="dash-panel">
        <h2>All time</h2>
        <IncomeExpenseBars
          compact
          incomeMinor={data.allTime.incomeMinor}
          expenseMinor={data.allTime.expenseMinor}
          netMinor={data.allTime.netMinor}
          currencyCode={data.account.currencyCode}
          ariaLabel="All time income, expense, and net"
        />
      </article>
    {/if}
  </section>
{/if}

{#if showTrendsRow}
  <section class="dash-grid dash-grid-trends">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "monthly-trend") && data.monthlyTrend.length}
      <article class="dash-panel">
        <h2>Monthly trend · last 12 months</h2>
        <MonthlyTrendChart rows={data.monthlyTrend} currencyCode={data.account.currencyCode} />
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "category-trend") && data.categoryTrend?.categories.length}
      <article class="dash-panel">
        <h2>Category trend · last 12 months</h2>
        <CategoryTrendChart chart={data.categoryTrend} currencyCode={data.account.currencyCode} />
      </article>
    {:else if isDashboardWidgetEnabled(data.enabledWidgets, "category-trend")}
      <article class="dash-panel">
        <h2>Category trend · last 12 months</h2>
        <p class="dim dash-empty">No categorized expenses in this period.</p>
      </article>
    {/if}
  </section>
{/if}

{#if showSpendingRow}
  <section class="dash-grid dash-grid-spending">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "category-spend")}
      <article class="dash-panel">
        <h2>Category spend · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.categorySpend.length === 0}
          <p class="dim dash-empty">No expenses in this period.</p>
        {:else}
          <SpendPieChart rows={data.categorySpend} currencyCode={data.account.currencyCode} ariaLabel="Category spend breakdown" />
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "tag-spend")}
      <article class="dash-panel">
        <h2>Tag spend · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.tagSpend.length === 0}
          <p class="dim dash-empty">No tagged expenses in this period.</p>
        {:else}
          <SpendPieChart rows={data.tagSpend} currencyCode={data.account.currencyCode} ariaLabel="Tag spend breakdown" />
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "merchant-spend")}
      <article class="dash-panel">
        <h2>Top merchants · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.merchantSpend.length === 0}
          <p class="dim dash-empty">No merchant spend in this period.</p>
        {:else}
          <SpendPieChart rows={data.merchantSpend} currencyCode={data.account.currencyCode} ariaLabel="Top merchants spend breakdown" />
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "group-spend")}
      <article class="dash-panel">
        <h2>Group spend · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.groupSpend.length === 0}
          <p class="dim dash-empty">No grouped expenses in this period.</p>
        {:else}
          <SpendPieChart rows={data.groupSpend} currencyCode={data.account.currencyCode} ariaLabel="Group spend breakdown" />
        {/if}
      </article>
    {/if}
  </section>
{/if}

{#if showGoalsRow}
  <section class="dash-grid">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "budgets")}
      <article class="dash-panel">
        <h2>Budgets</h2>
        {#if data.budgetUsage.length === 0}
          <p class="dim dash-empty">No active budgets.</p>
        {:else}
          <div class="dash-meters">
            {#each data.budgetUsage as budget (budget.id)}
              <MeterBar
                name={budget.name}
                valueLabel="{budget.pct}%"
                pct={budget.pct}
                color={budget.color}
                meta="{formatMoney(budget.spentMinor, data.account.currencyCode)} of {formatMoney(budget.limitMinor, data.account.currencyCode)}"
              />
            {/each}
          </div>
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "goals")}
      <article class="dash-panel">
        <h2>Goals</h2>
        {#if data.goals.length === 0}
          <p class="dim dash-empty">No goals yet.</p>
        {:else}
          <div class="dash-meters">
            {#each data.goals as goal (goal.id)}
              <MeterBar
                name={goal.name}
                valueLabel="{goal.pct}%"
                pct={goal.pct}
                color={goal.color}
                meta="{formatMoney(goal.currentMinor, data.account.currencyCode)} of {formatMoney(
                  goal.targetMinor,
                  data.account.currencyCode
                )} · {goal.status}"
              />
            {/each}
          </div>
        {/if}
      </article>
    {/if}
  </section>
{/if}

{#if showBillingRow}
  <section class="dash-grid dash-grid-billing">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "monthly-bills")}
      <article class="dash-panel">
        <h2>Monthly bills · {data.monthlyBillsLabel.toLowerCase()}</h2>
        <BillingPanel categories={data.monthlyBills} currencyCode={data.account.currencyCode} mode="monthly" periodLabel={data.monthlyBillsLabel} />
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "yearly-bills")}
      <article class="dash-panel dash-panel-wide">
        <h2>Yearly bills · {data.billingYear}</h2>
        <BillingPanel categories={data.yearlyBills} currencyCode={data.account.currencyCode} mode="yearly" periodLabel={String(data.billingYear)} />
      </article>
    {/if}
  </section>
{/if}

<style>
  .hero-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem 1.5rem;
    margin-bottom: 0.35rem;
  }

  .hero-main {
    min-width: min(100%, 18rem);
    flex: 1 1 18rem;
  }

  .balance-open {
    margin: 0.15rem 0 1rem;
  }

  .balance-open .k {
    display: block;
    font-family: var(--hand);
    color: var(--ink-muted);
    font-size: 1.05rem;
  }

  .balance-open .v {
    display: inline-block;
    font-family: var(--hand);
    font-size: clamp(2.4rem, 7vw, 3.8rem);
    line-height: 0.95;
    font-variant-numeric: tabular-nums;
  }

  .balance-value-wrap {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .balance-txn-count {
    font-size: 0.85rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .balance-open.stale .meta a,
  .balance-open .meta a {
    color: var(--brand);
  }

  .balance-open .meta {
    display: block;
    margin-top: 0.35rem;
    color: var(--ink-soft);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .rough-mark {
    position: relative;
    display: inline-block;
    padding: 0.02em 0.08em;
    isolation: isolate;
  }

  .rough-mark > .txt {
    position: relative;
    z-index: 1;
  }

  .rough-mark > .stroke {
    position: absolute;
    z-index: 0;
    pointer-events: none;
    overflow: visible;
  }

  .rough-mark > .stroke rect {
    mix-blend-mode: multiply;
  }

  .rough-mark.is-balance > .stroke {
    left: -6%;
    top: 18%;
    width: 114%;
    height: 62%;
    transform: rotate(-0.9deg);
  }

  .rough-mark.is-in > .stroke {
    left: -10%;
    top: 12%;
    width: 118%;
    height: 72%;
    transform: rotate(-1.4deg);
  }

  .rough-mark.is-out > .stroke {
    left: -8%;
    top: 18%;
    width: 122%;
    height: 68%;
    transform: rotate(1.8deg);
  }

  .rough-mark.is-net > .stroke {
    left: -14%;
    top: 8%;
    width: 128%;
    height: 78%;
    transform: rotate(-2.6deg);
  }

  .sticky-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: flex-start;
  }

  .taped-sticky {
    position: relative;
    width: 9.5rem;
    padding: 0.85rem 0.7rem 0.75rem;
    margin: 0.2rem 0;
    background: color-mix(in srgb, var(--yellow) 72%, var(--mix-wash));
    background-image: linear-gradient(135deg, transparent 62%, rgba(0, 0, 0, 0.04) 62%, rgba(0, 0, 0, 0.04) 100%);
    border: 1.25px solid color-mix(in srgb, var(--ink) 22%, transparent);
    box-shadow:
      1px 2px 0 rgba(27, 27, 31, 0.05),
      3px 5px 10px rgba(27, 27, 31, 0.06);
    transform: rotate(3.2deg);
    font-family: var(--hand);
    font-size: 0.95rem;
    line-height: 1.3;
    color: var(--ink);
    flex: none;
  }

  .taped-sticky::before {
    content: "";
    position: absolute;
    top: -0.45rem;
    left: 50%;
    width: 3.1rem;
    height: 0.85rem;
    transform: translateX(-50%) rotate(-2deg);
    background: color-mix(in srgb, #f5e6b8 70%, rgba(255, 255, 255, 0.55));
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    opacity: 0.92;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }

  .taped-sticky::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 0.85rem 0.85rem;
    border-color: transparent transparent #e6d56a transparent;
    filter: drop-shadow(-0.5px -0.5px 0 rgba(27, 27, 31, 0.12));
  }

  .taped-sticky .tiny {
    display: block;
    margin-top: 0.25rem;
    color: var(--ink-muted);
    font-size: 0.82rem;
  }

  .taped-sticky.blue {
    background: color-mix(in srgb, var(--blue) 55%, var(--mix-wash));
    transform: rotate(-2.4deg);
  }

  .taped-sticky.blue::after {
    border-color: transparent transparent color-mix(in srgb, var(--blue) 70%, #8a9bb0) transparent;
  }

  .stats-block {
    margin-bottom: 0.85rem;
  }

  .stats-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.55rem;
    flex-wrap: wrap;
  }

  .stats-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
    font-family: var(--hand);
  }

  .period-static {
    font-size: 0.9rem;
    line-height: 1;
    color: var(--main-text);
    letter-spacing: 0.01em;
    text-transform: none;
  }

  .head-filters {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .period-tabs {
    display: inline-flex;
    gap: 0.25rem;
    border: none;
    border-radius: 0;
    overflow: visible;
  }

  .period-tabs button {
    background: transparent;
    border: none;
    border-right: none;
    color: var(--muted);
    padding: 0.15rem 0.45rem;
    font-family: var(--hand);
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    cursor: pointer;
    border-radius: 2px 8px 3px 7px / 7px 3px 8px 2px;
  }

  .period-tabs button:last-child {
    border-right: none;
  }

  .period-tabs button.active {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
    color: var(--ink);
  }

  .period-tabs button:hover:not(.active) {
    color: var(--ink);
  }

  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.55rem;
    margin: 0 0 1rem;
    font-family: var(--hand);
    font-size: 1.1rem;
  }

  .flow .arrow {
    color: var(--brand);
    font-size: 1.25rem;
  }

  .flow .node {
    display: inline-flex;
    flex-direction: row;
    align-items: baseline;
    gap: 0.4rem;
    border: none;
    padding: 0.05rem 0.15rem;
    border-radius: 0;
    background: transparent;
    text-decoration: none;
    color: inherit;
  }

  .flow .node:nth-child(3) {
    transform: rotate(0.5deg);
  }

  .flow .node:nth-child(5) {
    transform: rotate(-0.5deg);
  }

  .flow a.node:hover {
    color: var(--brand);
  }

  .node-k {
    font-size: 0.95rem;
    color: var(--ink-muted);
    line-height: 1;
  }

  .node-v {
    font-size: 1.15rem;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .period-node {
    color: var(--ink-muted);
  }

  .saved-chip {
    margin-left: 0.35rem;
    padding: 0.2rem 0.55rem;
    background: color-mix(in srgb, var(--green) 55%, transparent);
    border-radius: 3px 9px 4px 8px / 8px 3px 9px 2px;
    font-size: 0.95rem;
    color: var(--ink);
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.6rem;
    margin: 0 0 1.15rem;
    font-family: var(--hand);
    font-size: 1.05rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.18rem 0.55rem;
    border-radius: 3px 9px 4px 8px / 8px 3px 9px 2px;
  }

  .pill svg {
    width: 1rem;
    height: 1rem;
    flex: none;
  }

  .pill-blue {
    background: color-mix(in srgb, var(--blue) 72%, transparent);
  }
  .pill-purple {
    background: color-mix(in srgb, var(--purple) 72%, transparent);
  }
  .pill-yellow {
    background: color-mix(in srgb, var(--yellow) 72%, transparent);
  }
  .pill-green {
    background: color-mix(in srgb, var(--green) 72%, transparent);
  }
  .pill-pink {
    background: color-mix(in srgb, var(--pink) 70%, transparent);
  }
  .pill-orange {
    background: color-mix(in srgb, var(--orange) 72%, transparent);
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem 2rem;
    margin-bottom: 1.75rem;
  }

  .dash-grid-spending {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-grid-trends {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .dash-grid-billing {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-panel-wide {
    grid-column: 1 / -1;
  }

  .dash-panel {
    background: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
  }

  .dash-panel h2 {
    margin: 0 0 0.65rem;
    font-family: var(--hand);
    font-size: 1.15rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--ink-muted);
    font-weight: 400;
  }

  .dash-kv {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem 1.25rem;
    margin: 0;
  }

  .dash-kv div {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .dash-kv dt {
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    text-transform: none;
    color: var(--muted);
  }

  .dash-kv dd {
    margin: 0;
    font-family: var(--hand);
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
  }

  .dash-meters {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .dash-empty {
    margin: 0;
    font-size: 0.95rem;
  }

  /* Soft notebook lines instead of meter card tracks */
  .dash-panel :global(.track) {
    background: transparent;
    border: none;
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink) 18%, transparent);
    border-radius: 0;
    height: 8px;
  }

  .dash-panel :global(.fill) {
    border-radius: 0;
  }

  .dash-panel :global(.math-notebook) {
    background-image: none;
    border-radius: 0;
    padding: 0.15rem 0;
  }

  .dash-panel :global(.trend-grid) {
    border-left: 1.25px solid color-mix(in srgb, var(--ink) 28%, transparent);
    border-bottom: 1.25px solid color-mix(in srgb, var(--ink) 28%, transparent);
  }

  @media (max-width: 900px) {
    .dash-grid,
    .dash-grid-spending,
    .dash-grid-trends,
    .dash-grid-billing,
    .dash-kv {
      grid-template-columns: 1fr;
    }

    .dash-panel-wide {
      grid-column: auto;
    }
  }
</style>
