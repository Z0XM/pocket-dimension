<script lang="ts">
  import { page } from "$app/state";
  import { dev } from "$app/environment";
  import BetaBanner from "$lib/components/beta-banner.svelte";

  const { children } = $props();

  const lockPageScroll = $derived(page.url.pathname.includes("/app/transactions"));
</script>

<div class="forge forge-shell">
  <main class="content" class:content-lock={lockPageScroll}>
    {#if !dev}
      <BetaBanner />
    {/if}
    {@render children()}
  </main>
</div>
