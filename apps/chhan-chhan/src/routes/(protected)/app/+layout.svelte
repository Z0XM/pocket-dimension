<script lang="ts">
  import { page } from "$app/state";

  const { children } = $props();

  const lockPageScroll = $derived(page.url.pathname.includes("/app/transactions"));
</script>

<div class="forge forge-shell">
  <main class="content" class:content-lock={lockPageScroll}>
    {@render children()}
  </main>
</div>
