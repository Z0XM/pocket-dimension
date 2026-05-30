<script lang="ts">
  import { generateTransactions, MAX_PAGES, formatMoney, sampleSummary, sampleBudgetUsage } from "$lib/demo/mock-data";
  import { infiniteScroll } from "$lib/demo/infinite-scroll";

  let rows = $state(generateTransactions(0));
  let pageIndex = $state(0);
  let loading = $state(false);
  const hasMore = $derived(pageIndex < MAX_PAGES - 1);

  function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    setTimeout(() => {
      pageIndex += 1;
      rows = [...rows, ...generateTransactions(pageIndex)];
      loading = false;
    }, 220);
  }

  const periodLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
</script>

<svelte:head><title>Transactions · Chhan Chhan</title></svelte:head>

<header class="topbar">
  <div>
    <h1><span>TRANS</span><span class="acid">ACTIONS</span></h1>
    <p class="sub">{periodLabel}</p>
  </div>
  <div class="actions">
    <input type="search" placeholder="search…" />
    <button class="cta" type="button">+ NEW</button>
  </div>
</header>

<section class="stats">
  <article class="stat net">
    <span class="k">NET</span>
    <span class="v">{formatMoney(sampleSummary.netMinor)}</span>
  </article>
  <article class="stat">
    <span class="k">IN</span>
    <span class="v pos">{formatMoney(sampleSummary.incomeMinor)}</span>
  </article>
  <article class="stat">
    <span class="k">OUT</span>
    <span class="v neg">{formatMoney(-sampleSummary.expenseMinor)}</span>
  </article>
  <article class="stat">
    <span class="k">SAVED</span>
    <span class="v">{Math.round(sampleSummary.savingsRate * 100)}%</span>
  </article>
</section>

<section class="meters">
  {#each sampleBudgetUsage as b}
    <div class="meter">
      <div class="meter-top"><span>{b.name}</span><span>{b.pct}%</span></div>
      <div class="track"><div class="fill" style="width:{b.pct}%; background:{b.color}"></div></div>
    </div>
  {/each}
</section>

<section class="table-block">
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Merchant</th>
        <th>Category</th>
        <th>Tags</th>
        <th>Account</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as t (t.id)}
        <tr>
          <td class="mono dim">{t.occurredOn}</td>
          <td class="merchant">{t.merchant}</td>
          <td>
            <span class="cat"><span class="sq" style="background:{t.categoryColor}"></span>{t.category}</span>
          </td>
          <td class="tags">
            <div class="tag-list">
              {#each t.tags as tag}<span class="tag"><span class="tag-hash" aria-hidden="true">#</span>{tag}</span>{/each}
            </div>
          </td>
          <td class="dim">{t.account}</td>
          <td class="right mono amt" class:pos={t.amountMinor > 0} class:neg={t.amountMinor < 0}>
            {formatMoney(t.amountMinor)}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="sentinel" use:infiniteScroll={{ onLoad: loadMore, disabled: loading || !hasMore }}>
    {#if loading}■ LOADING ■{:else if !hasMore}— END —{:else}↓ SCROLL ↓{/if}
  </div>
</section>
