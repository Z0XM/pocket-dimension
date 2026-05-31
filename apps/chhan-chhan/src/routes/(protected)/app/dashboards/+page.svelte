<script lang="ts">
  import { goto } from "$app/navigation";
  import { formatMoney } from "$lib/finance/money";
  import { formatMonthKeyShort, type SummaryPeriod } from "$lib/finance/summary";
  import AppNav from "$lib/components/app-nav.svelte";
  import AppSettings from "$lib/components/app-settings.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  function dashboardUrl(
    updates: {
      summary?: SummaryPeriod;
      month?: string;
      year?: number;
    } = {}
  ) {
    const params = new URLSearchParams();
    const summary = updates.summary ?? data.summaryPeriod;
    const month = updates.month ?? data.selectedMonth;
    const year = updates.year ?? data.selectedYear;

    if (summary === "year") {
      params.set("summary", "year");
      params.set("year", String(year));
    } else if (summary === "all") {
      params.set("summary", "all");
    } else {
      params.set("summary", "month");
      params.set("month", month);
    }

    const query = params.toString();
    return query ? `/app/dashboards?${query}` : "/app/dashboards";
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
</script>

<svelte:head><title>Dashboards · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1><span>CHHAN</span><span class="acid"> CHHAN</span></h1>
    <AppNav />
  </div>
  <div class="actions">
    <AppSettings />
  </div>
</header>

{#if data.currentBalance}
  <section class="balance-card" class:stale={data.currentBalance.isStale}>
    <span class="balance-k">Balance</span>
    <span class="balance-v">{formatMoney(data.currentBalance.balanceMinor, data.account.currencyCode)}</span>
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

<section class="dash-grid">
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
</section>

{#if data.categorySpend.length}
  <section class="dash-section">
    <h2 class="dash-heading">Spending by category · {data.summaryLabel.toLowerCase()}</h2>
    <div class="meters">
      {#each data.categorySpend as row (row.name)}
        <div class="meter">
          <div class="meter-top">
            <span>{row.name}</span>
            <span>{formatMoney(row.amountMinor, data.account.currencyCode)}</span>
          </div>
          <div class="track">
            <div class="fill" style="width:{row.pct}%; background:{row.color}"></div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<section class="dash-grid">
  <article class="dash-panel">
    <h2>Budgets</h2>
    {#if data.budgetUsage.length === 0}
      <p class="dim dash-empty">No active budgets.</p>
    {:else}
      <div class="dash-meters">
        {#each data.budgetUsage as budget (budget.id)}
          <div class="meter">
            <div class="meter-top">
              <span>{budget.name}</span>
              <span>{budget.pct}%</span>
            </div>
            <div class="track">
              <div class="fill" style="width:{budget.pct}%; background:{budget.color}"></div>
            </div>
            <p class="meter-meta dim">
              {formatMoney(budget.spentMinor, data.account.currencyCode)} of
              {formatMoney(budget.limitMinor, data.account.currencyCode)}
            </p>
          </div>
        {/each}
      </div>
    {/if}
  </article>

  <article class="dash-panel">
    <h2>Goals</h2>
    {#if data.goals.length === 0}
      <p class="dim dash-empty">No goals yet.</p>
    {:else}
      <div class="dash-meters">
        {#each data.goals as goal (goal.id)}
          <div class="meter">
            <div class="meter-top">
              <span>{goal.name}</span>
              <span>{goal.pct}%</span>
            </div>
            <div class="track">
              <div class="fill" style="width:{goal.pct}%; background:#00a553"></div>
            </div>
            <p class="meter-meta dim">
              {formatMoney(goal.currentMinor, data.account.currencyCode)} of
              {formatMoney(goal.targetMinor, data.account.currencyCode)} · {goal.status}
            </p>
          </div>
        {/each}
      </div>
    {/if}
  </article>
</section>

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

  .balance-card.stale {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--chrome-line));
  }

  .balance-asof {
    font-size: 0.72rem;
    margin-left: auto;
    text-align: right;
    line-height: 1.4;
  }

  .balance-asof a {
    color: var(--accent);
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
    border-color: var(--accent);
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
    background: var(--accent);
    color: var(--background);
  }

  .period-tabs button:hover:not(.active) {
    color: var(--main-text);
  }

  .stats a.stat {
    text-decoration: none;
    color: inherit;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
    margin-bottom: 1.25rem;
  }

  .dash-panel {
    background: var(--surface);
    border: 2px solid var(--chrome-line);
    padding: 0.9rem 1rem;
    box-shadow: 4px 4px 0 rgba(234, 242, 240, 0.12);
  }

  .dash-panel h2,
  .dash-heading {
    margin: 0 0 0.75rem;
    font-family: "Archivo Black", sans-serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--acid);
  }

  .dash-section {
    margin-bottom: 1.25rem;
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

  .meter-meta {
    margin: 0.35rem 0 0;
    font-size: 0.68rem;
    line-height: 1.35;
  }

  .dash-empty {
    margin: 0;
    font-size: 0.78rem;
  }

  @media (max-width: 900px) {
    .dash-grid,
    .dash-kv {
      grid-template-columns: 1fr;
    }
  }
</style>
