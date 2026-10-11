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
  class="theme-toggle"
  class:settings-icon={mode === "icon"}
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

  .theme-toggle.menu-mode {
    display: inline-flex;
    align-items: center;
    width: 100%;
    height: auto;
    min-height: 2.5rem;
    justify-content: flex-start;
    gap: 0.55rem;
    padding: 0.55rem 0.65rem;
    border: none;
    border-radius: 2px 8px 3px 7px / 7px 3px 8px 2px;
    background: transparent;
    box-shadow: none;
    transform: none;
    color: var(--ink, #1b1b1f);
    cursor: pointer;
  }

  .theme-toggle.menu-mode:hover {
    background: color-mix(in srgb, var(--yellow) 55%, transparent);
    color: var(--brand);
  }

  .theme-label {
    font-family: var(--hand);
    font-size: 1.05rem;
    line-height: 1.1;
  }
</style>
