<script lang="ts">
  import { page } from "$app/state";

  const tabs = [
    { label: "Transactions", href: "/app" },
    { label: "Dashboards", href: "/app/dashboards" },
  ] as const;

  function isActive(href: string) {
    if (href === "/app") return page.url.pathname === "/app";
    return page.url.pathname.startsWith(href);
  }
</script>

<nav class="app-nav" aria-label="App sections">
  {#each tabs as tab (tab.href)}
    <a href={tab.href} class:active={isActive(tab.href)} aria-current={isActive(tab.href) ? "page" : undefined}>
      {tab.label}
    </a>
  {/each}
</nav>
