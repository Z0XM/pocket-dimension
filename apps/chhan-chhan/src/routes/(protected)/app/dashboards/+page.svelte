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
    return query ? `/app?${query}` : "/app";
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
    isDashboardWidgetEnabled(data.enabledWidgets, "monthly-trend") ||
      isDashboardWidgetEnabled(data.enabledWidgets, "category-trend") ||
      isDashboardWidgetEnabled(data.enabledWidgets, "income-expense")
  );

  const showGoalsRow = $derived(isDashboardWidgetEnabled(data.enabledWidgets, "budgets") || isDashboardWidgetEnabled(data.enabledWidgets, "goals"));

  const showBillingRow = $derived(
    isDashboardWidgetEnabled(data.enabledWidgets, "monthly-bills") || isDashboardWidgetEnabled(data.enabledWidgets, "yearly-bills")
  );
</script>

<svelte:head><title>Dashboards · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1><span>CHHAN</span><span class="acid"> CHHAN</span></h1>
    <AppNav />
  </div>
  <div class="actions">
    <DashboardWidgetPicker enabledWidgets={data.enabledWidgets} onchange={setEnabledWidgets} />
    <AppSettings />
  </div>
</header>

{#if data.currentBalance}
  <section class="balance-card" class:stale={data.currentBalance.isStale}>
    <span class="balance-k">Balance</span>
    <div class="balance-value-wrap">
      <span class="balance-v">{formatMoney(data.currentBalance.balanceMinor, data.account.currencyCode)}</span>
      <span class="balance-txn-count">{data.currentBalance.transactionCount.toLocaleString()} txns</span>
    </div>
    <span class="balance-asof dim">
      {#if data.currentBalance.isStale}
        as of {data.currentBalance.asOf} · latest txn {data.currentBalance.latestTransactionOn} —
        <a href="/app/control">re-import statement</a> to refresh
      {:else}
        as of {data.currentBalance.asOf}
      {/if}
    </span>
  </section>
{/if}

<section class="stats-block">
  <div class="stats-head">
    <div class="stats-label">
      <span>Summary</span>
      {#if data.summaryPeriod === "month"}
        <select class="period-select" aria-label="Select month" value={data.selectedMonth} onchange={(e) => setSummaryMonth(e.currentTarget.value)}>
          {#each data.summaryMonths as monthKey}
            <option value={monthKey}>{formatMonthKeyShort(monthKey)}</option>
          {/each}
        </select>
      {:else if data.summaryPeriod === "year"}
        <select
          class="period-select"
          aria-label="Select year"
          value={String(data.selectedYear)}
          onchange={(e) => setSummaryYear(Number(e.currentTarget.value))}
        >
          {#each data.summaryYears as year (year)}
            <option value={String(year)}>{year}</option>
          {/each}
        </select>
      {:else}
        <span class="period-static">All time</span>
      {/if}
    </div>
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
  <section class="stats">
    <a class="stat net" href={transactionsUrl()}>
      <span class="k">{data.summaryPrefix} NET</span>
      <span class="v">{formatMoney(data.summary.netMinor, data.account.currencyCode)}</span>
    </a>
    <a class="stat" href={transactionsUrl("income")}>
      <span class="k">{data.summaryPrefix} IN</span>
      <span class="v pos">{formatMoney(data.summary.incomeMinor, data.account.currencyCode)}</span>
    </a>
    <a class="stat" href={transactionsUrl("expense")}>
      <span class="k">{data.summaryPrefix} OUT</span>
      <span class="v neg">{formatMoney(-data.summary.expenseMinor, data.account.currencyCode)}</span>
    </a>
    <article class="stat">
      <span class="k">{data.summaryPrefix} SAVED</span>
      <span class="v">{Math.round(data.summary.savingsRate * 100)}%</span>
    </article>
  </section>
</section>

{#if showSummaryRow}
  <section class="dash-grid">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "summary-month") && data.monthly}
      <article class="dash-panel">
        <h2>This month</h2>
        <dl class="dash-kv">
          <div>
            <dt>In</dt>
            <dd class="pos">{formatMoney(data.monthly.incomeMinor, data.account.currencyCode)}</dd>
          </div>
          <div>
            <dt>Out</dt>
            <dd class="neg">{formatMoney(-data.monthly.expenseMinor, data.account.currencyCode)}</dd>
          </div>
          <div>
            <dt>Net</dt>
            <dd>{formatMoney(data.monthly.netMinor, data.account.currencyCode)}</dd>
          </div>
        </dl>
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "summary-all") && data.allTime}
      <article class="dash-panel">
        <h2>All time</h2>
        <dl class="dash-kv">
          <div>
            <dt>In</dt>
            <dd class="pos">{formatMoney(data.allTime.incomeMinor, data.account.currencyCode)}</dd>
          </div>
          <div>
            <dt>Out</dt>
            <dd class="neg">{formatMoney(-data.allTime.expenseMinor, data.account.currencyCode)}</dd>
          </div>
          <div>
            <dt>Net</dt>
            <dd>{formatMoney(data.allTime.netMinor, data.account.currencyCode)}</dd>
          </div>
        </dl>
      </article>
    {/if}
  </section>
{/if}

{#if showTrendsRow}
  <section class="dash-grid">
    {#if isDashboardWidgetEnabled(data.enabledWidgets, "monthly-trend") && data.monthlyTrend.length}
      <article class="dash-panel dash-panel-wide">
        <h2>Monthly trend · last 12 months</h2>
        <MonthlyTrendChart rows={data.monthlyTrend} currencyCode={data.account.currencyCode} />
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "category-trend") && data.categoryTrend?.categories.length}
      <article class="dash-panel dash-panel-wide">
        <h2>Category trend · last 12 months</h2>
        <CategoryTrendChart chart={data.categoryTrend} currencyCode={data.account.currencyCode} />
      </article>
    {:else if isDashboardWidgetEnabled(data.enabledWidgets, "category-trend")}
      <article class="dash-panel dash-panel-wide">
        <h2>Category trend · last 12 months</h2>
        <p class="dim dash-empty">No categorized expenses in this period.</p>
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "income-expense") && data.showIncomeExpense}
      <article class="dash-panel">
        <h2>Income vs expense · {data.summaryLabel.toLowerCase()}</h2>
        <IncomeExpenseBars incomeMinor={data.summary.incomeMinor} expenseMinor={data.summary.expenseMinor} currencyCode={data.account.currencyCode} />
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
          <div class="dash-meters">
            {#each data.categorySpend as row (row.name)}
              <MeterBar name={row.name} valueLabel={formatMoney(row.amountMinor, data.account.currencyCode)} pct={row.pct} color={row.color} />
            {/each}
          </div>
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "tag-spend")}
      <article class="dash-panel">
        <h2>Tag spend · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.tagSpend.length === 0}
          <p class="dim dash-empty">No tagged expenses in this period.</p>
        {:else}
          <div class="dash-meters">
            {#each data.tagSpend as row (row.name)}
              <MeterBar name={row.name} valueLabel={formatMoney(row.amountMinor, data.account.currencyCode)} pct={row.pct} color={row.color} />
            {/each}
          </div>
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "merchant-spend")}
      <article class="dash-panel">
        <h2>Top merchants · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.merchantSpend.length === 0}
          <p class="dim dash-empty">No merchant spend in this period.</p>
        {:else}
          <div class="dash-meters">
            {#each data.merchantSpend as row (row.name)}
              <MeterBar name={row.name} valueLabel={formatMoney(row.amountMinor, data.account.currencyCode)} pct={row.pct} color={row.color} />
            {/each}
          </div>
        {/if}
      </article>
    {/if}

    {#if isDashboardWidgetEnabled(data.enabledWidgets, "group-spend")}
      <article class="dash-panel">
        <h2>Group spend · {data.summaryLabel.toLowerCase()}</h2>
        {#if data.groupSpend.length === 0}
          <p class="dim dash-empty">No grouped expenses in this period.</p>
        {:else}
          <div class="dash-meters">
            {#each data.groupSpend as row (row.name)}
              <MeterBar name={row.name} valueLabel={formatMoney(row.amountMinor, data.account.currencyCode)} pct={row.pct} color={row.color} />
            {/each}
          </div>
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
  .balance-card {
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    flex-wrap: wrap;
    margin-bottom: 0.85rem;
    padding: 0.75rem 0.9rem;
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .balance-k {
    font-size: 0.66rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .balance-v {
    font-family: "Archivo Black", sans-serif;
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
    color: var(--main-text);
  }

  .balance-value-wrap {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
  }

  .balance-txn-count {
    font-size: 0.62rem;
    letter-spacing: 0.05em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .balance-card.stale {
    border-color: color-mix(in srgb, var(--hi-purple) 55%, var(--chrome-line));
  }

  .balance-asof {
    font-size: 0.72rem;
    margin-left: auto;
    text-align: right;
    line-height: 1.4;
  }

  .balance-asof a {
    color: var(--hi-cyan);
  }

  .stats-block {
    margin-bottom: 0.85rem;
  }

  .stats-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.45rem;
    flex-wrap: wrap;
  }

  .stats-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .period-select {
    background: var(--surface2);
    border: 2px solid var(--chrome-line);
    color: var(--main-text);
    padding: 0.35rem 0.45rem;
    font-family: inherit;
    font-size: 0.68rem;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: none;
    min-width: 0;
    width: auto;
    cursor: pointer;
    vertical-align: middle;
  }

  .period-select:focus {
    outline: none;
    border-color: var(--hi-focus);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--hi-focus) 45%, transparent);
  }

  .period-static {
    font-size: 0.68rem;
    line-height: 1;
    color: var(--main-text);
    letter-spacing: 0.04em;
    text-transform: none;
  }

  .period-tabs {
    display: inline-flex;
    border: 2px solid var(--chrome-line);
  }

  .period-tabs button {
    background: var(--surface2);
    border: none;
    border-right: 2px solid var(--chrome-line);
    color: var(--muted);
    padding: 0.35rem 0.65rem;
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .period-tabs button:last-child {
    border-right: none;
  }

  .period-tabs button.active {
    background: var(--hi-purple);
    color: var(--background);
  }

  .period-tabs button:hover:not(.active) {
    color: var(--hi-purple);
  }

  .stats a.stat {
    text-decoration: none;
    color: inherit;
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
    margin-bottom: 1.25rem;
  }

  .dash-grid-spending {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-grid-billing {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-panel-wide {
    grid-column: 1 / -1;
  }

  .dash-panel {
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    padding: 0.9rem 1rem;
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .dash-panel h2 {
    margin: 0 0 0.75rem;
    font-family: "Archivo Black", sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hi-cyan);
  }

  .dash-kv {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  .dash-kv div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .dash-kv dt {
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .dash-kv dd {
    margin: 0;
    font-family: "Archivo Black", sans-serif;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
  }

  .dash-meters {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .dash-empty {
    margin: 0;
    font-size: 0.78rem;
  }

  @media (max-width: 900px) {
    .dash-grid,
    .dash-grid-spending,
    .dash-kv {
      grid-template-columns: 1fr;
    }

    .dash-panel-wide {
      grid-column: auto;
    }
  }
</style>
