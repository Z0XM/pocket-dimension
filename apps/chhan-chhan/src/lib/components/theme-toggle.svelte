<script lang="ts">
  import { onMount } from "svelte";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import { getResolvedTheme, readAppearance, setAppearance, type ResolvedTheme } from "$lib/appearance";

  let resolved = $state<ResolvedTheme>("light");

  function syncFromDocument() {
    const attr = document.documentElement.getAttribute("data-theme");
    resolved = attr === "dark" || attr === "light" ? attr : getResolvedTheme(readAppearance());
  }

  onMount(() => {
    syncFromDocument();
    const observer = new MutationObserver(syncFromDocument);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  });

  function toggleTheme() {
    const next: ResolvedTheme = resolved === "dark" ? "light" : "dark";
    setAppearance({ theme: next });
    resolved = next;
  }
</script>

<button
  type="button"
  class="settings-icon theme-toggle"
  title={resolved === "dark" ? "Switch to light" : "Switch to dark"}
  aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
  onclick={toggleTheme}
>
  {#if resolved === "dark"}
    <Sun size={17} strokeWidth={2.1} aria-hidden="true" />
  {:else}
    <Moon size={17} strokeWidth={2.1} aria-hidden="true" />
  {/if}
</button>

<style>
  /* Fallback when used outside .forge .settings-icon rules (should rarely apply) */
  .theme-toggle {
    appearance: none;
  }
</style>
