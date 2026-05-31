<script lang="ts">
  import { dev } from "$app/environment";
  import BetaBanner from "$lib/components/beta-banner.svelte";

  const { children } = $props();
</script>

<div class="forge forge-shell">
  <main class="content">
    {#if !dev}
      <BetaBanner />
    {/if}
    {@render children()}
  </main>
</div>
