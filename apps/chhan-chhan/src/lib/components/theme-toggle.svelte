<script lang="ts">
  import { onMount } from "svelte";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import { getResolvedTheme, readAppearance, setAppearance, type ResolvedTheme } from "$lib/appearance";

  type Props = {
    /** `icon` matches the topbar control; `menu` is a labeled row for the mobile kebab. */
    mode?: "icon" | "menu";
  };

  const { mode = "icon" }: Props = $props();

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

  const label = $derived(resolved === "dark" ? "Switch to light" : "Switch to dark");
  const ariaLabel = $derived(resolved === "dark" ? "Switch to light theme" : "Switch to dark theme");
</script>

<button
  type="button"
  class="settings-icon theme-toggle"
  class:menu-mode={mode === "menu"}
  title={label}
  aria-label={ariaLabel}
  role={mode === "menu" ? "menuitem" : undefined}
  onclick={toggleTheme}
>
  {#if resolved === "dark"}
    <Sun size={mode === "menu" ? 16 : 17} strokeWidth={2.1} aria-hidden="true" />
  {:else}
    <Moon size={mode === "menu" ? 16 : 17} strokeWidth={2.1} aria-hidden="true" />
  {/if}
  {#if mode === "menu"}
    <span class="theme-label">{label}</span>
  {/if}
</button>

<style>
  /* Fallback when used outside .forge .settings-icon rules (should rarely apply) */
  .theme-toggle {
    appearance: none;
  }

  .theme-label {
    font-family: var(--hand);
    font-size: 1.05rem;
    line-height: 1.1;
  }
</style>
