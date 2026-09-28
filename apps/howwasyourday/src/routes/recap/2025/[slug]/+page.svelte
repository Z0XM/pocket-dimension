<script lang="ts">
  import { UserDashboard } from "$lib/legacy-recap";

  const { data } = $props();
</script>

<svelte:head>
  <title>{data.recap.user.display_name} · 2025 recap · How Was Your Day</title>
</svelte:head>

<div class="legacy-recap-root">
  <UserDashboard recap={data.recap} aiAnalysis={data.aiAnalysis} />
</div>

<style>
  .legacy-recap-root {
    --display: "Fraunces", Georgia, serif;
    --sans: "Outfit", system-ui, sans-serif;
    --paper: #f3f6f4;
    --ink: #142326;
    --ink-soft: #3d5256;
    --ink-mute: #6a7f83;
  }

  /* Escape the main app shell padding if any */
  :global(.hwyd-shell:has(.legacy-recap-root)) {
    padding: 0;
  }
</style>
