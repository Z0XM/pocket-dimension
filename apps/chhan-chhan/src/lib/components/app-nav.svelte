<script lang="ts">
  import { page } from "$app/state";
  import AccountSwitcher from "$lib/components/account-switcher.svelte";

  const tabs = [
    { label: "Dashboard", href: "/app/dashboards" },
    { label: "Transactions", href: "/app/transactions" },
  ] as const;

  function isActive(href: string) {
    if (href === "/app/dashboards") {
      return page.url.pathname === "/app" || page.url.pathname.startsWith("/app/dashboards");
    }
    return page.url.pathname.startsWith(href);
  }

  const accounts = $derived(
    (page.data.accounts as Array<{ id: string; name: string; currencyCode: string; colorHex?: string | null }> | undefined) ?? []
  );
  const activeAccountId = $derived((page.data.account as { id: string } | undefined)?.id ?? "");
</script>

<nav class="app-nav" aria-label="App sections">
  <div class="tabs">
    {#each tabs as tab (tab.href)}
      <a href={tab.href} class:active={isActive(tab.href)} aria-current={isActive(tab.href) ? "page" : undefined}>
        {tab.label}
      </a>
    {/each}
  </div>
  {#if activeAccountId}
    <AccountSwitcher {accounts} {activeAccountId} />
  {/if}
</nav>

<style>
  .app-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: inherit;
  }

  @media (max-width: 640px) {
    .app-nav {
      gap: 0.45rem 0.75rem;
      width: 100%;
    }

    .tabs {
      gap: 0.1rem;
    }

    .app-nav :global(.account-switcher) {
      flex: 1 1 100%;
      max-width: 100%;
    }
  }
</style>
