<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "$lib/auth-client";

  const { children } = $props();

  const nav = [
    { label: "Transactions", href: "/app" },
    { label: "Insights", href: "/app" },
    { label: "Budgets", href: "/app" },
    { label: "Imports", href: "/app" },
    { label: "Rules", href: "/app" },
  ];

  const isControl = $derived(page.url.pathname.startsWith("/app/control"));

  async function signOut() {
    await authClient.signOut();
    await goto("/login");
  }
</script>

<div class="forge forge-shell">
  <aside class="rail">
    <div class="brand"><span class="logo">◆</span> Chhan Chhan</div>
    <nav>
      {#each nav as item, i}
        <a href={item.href} class:active={i === 0 && page.url.pathname === "/app"}>{item.label}</a>
      {/each}
    </nav>
    <a class="control-link" class:active={isControl} href="/app/control">⚙ Control</a>
    <button type="button" class="sign-out" onclick={signOut}>Sign out</button>
  </aside>
  <main class="content">
    {@render children()}
  </main>
</div>
