<script lang="ts">
  import { formatMoney } from "$lib/finance/money";
  import { formatMonthKeyShort } from "$lib/finance/summary";
  import type { BillingCategoryGroup } from "$lib/finance/billing";

  type Props = {
    categories: BillingCategoryGroup[];
    currencyCode: string;
    mode: "monthly" | "yearly";
    periodLabel: string;
  };

  const { categories, currencyCode, mode, periodLabel }: Props = $props();
</script>

{#if categories.length === 0}
  <p class="dim billing-empty">No bill-category payments in {periodLabel.toLowerCase()}.</p>
{:else}
  <div class="billing-groups">
    {#each categories as category (category.categoryId ?? category.categoryName)}
      <section class="billing-category">
        <header class="billing-category-head">
          <span class="cat-bar" style="background:{category.categoryColor}" aria-hidden="true"></span>
          <div class="billing-category-copy">
            <h3>{category.categoryName}</h3>
            <span class="billing-category-total">{formatMoney(category.totalMinor, currencyCode)}</span>
          </div>
        </header>

        <ul class="billing-merchant-list">
          {#each category.merchants as merchant (merchant.merchant)}
            <li class="billing-merchant">
              <div class="billing-merchant-top">
                <span class="billing-merchant-name">{merchant.merchant}</span>
                <span class="billing-merchant-total mono">
                  {formatMoney(merchant.totalMinor, currencyCode)}
                </span>
              </div>

              {#if mode === "yearly" && merchant.months.length > 0}
                <div class="billing-month-grid">
                  {#each merchant.months as month (month.monthKey)}
                    <span class="billing-month-chip">
                      <span class="billing-month-k">{formatMonthKeyShort(month.monthKey)}</span>
                      <span class="billing-month-v">{formatMoney(month.amountMinor, currencyCode)}</span>
                    </span>
                  {/each}
                </div>
              {:else if mode === "monthly" && merchant.txnCount > 1}
                <p class="billing-meta dim">{merchant.txnCount} payments</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style>
  .billing-empty {
    margin: 0;
    font-size: 0.78rem;
  }

  .billing-groups {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .billing-category {
    border-top: 1px solid var(--chrome-line);
    padding-top: 0.85rem;
  }

  .billing-category:first-child {
    border-top: none;
    padding-top: 0;
  }

  .billing-category-head {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    margin-bottom: 0.65rem;
  }

  .cat-bar {
    width: 0.28rem;
    align-self: stretch;
    flex-shrink: 0;
  }

  .billing-category-copy {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
  }

  .billing-category-copy h3 {
    margin: 0;
    font-size: 0.74rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--main-text);
  }

  .billing-category-total {
    font-family: "Archivo Black", sans-serif;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    color: var(--hi-cyan);
    white-space: nowrap;
  }

  .billing-merchant-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .billing-merchant-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .billing-merchant-name {
    font-size: 0.76rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .billing-merchant-total {
    font-size: 0.76rem;
    color: var(--main-text);
    white-space: nowrap;
  }

  .billing-meta {
    margin: 0.15rem 0 0;
    font-size: 0.66rem;
  }

  .billing-month-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.35rem;
  }

  .billing-month-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.18rem 0.35rem;
    background: var(--surface2);
    border: 1px solid var(--chrome-line);
    font-size: 0.62rem;
  }

  .billing-month-k {
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .billing-month-v {
    font-variant-numeric: tabular-nums;
    color: var(--main-text);
  }
</style>
