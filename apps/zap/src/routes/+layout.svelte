<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/icon.svg";
  import { onMount } from "svelte";
  import { applyThemePrefs, readThemePrefs } from "$lib/theme-prefs";

  let { children } = $props();

  onMount(() => {
    applyThemePrefs(readThemePrefs());
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Zap</title>
</svelte:head>

{@render children()}
