<script lang="ts">
  import AppShell from "$lib/components/app-shell.svelte";
  import "../app.css";

  const { children } = $props();
</script>

<AppShell>
  {@render children()}
</AppShell>
