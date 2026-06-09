<script lang="ts">
  import { getThemeMode, toggleThemeMode, type ThemeMode } from "$lib/theme-mode";
  import { Moon, Sun } from "@lucide/svelte";
  import { onMount } from "svelte";

  let mode = $state<ThemeMode>("dark");

  onMount(() => {
    mode = getThemeMode();
  });

  function toggle() {
    mode = toggleThemeMode();
  }
</script>

<button
  type="button"
  class="inline-flex items-center justify-center rounded border border-accent/40 p-2 text-accent transition-colors hover:bg-accent/10"
  aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
  title={mode === "dark" ? "Light mode" : "Dark mode"}
  onclick={toggle}
>
  {#if mode === "dark"}
    <Sun size={16} aria-hidden="true" />
  {:else}
    <Moon size={16} aria-hidden="true" />
  {/if}
</button>
