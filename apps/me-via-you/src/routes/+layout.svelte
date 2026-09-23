<script lang="ts">
  import DevModeNotch from "$lib/components/dev-mode-notch.svelte";
  import "../app.css";
  import { onMount } from "svelte";
  import icon from "$lib/assets/icon.svg";
  import { authClient } from "$lib/auth-client";
  import { applyThemeMode, getThemeMode } from "$lib/theme-mode";

  const { children, data } = $props();

  onMount(() => {
    applyThemeMode(getThemeMode());

    const session = authClient.useSession();
    const unsubSession = session.subscribe(() => {});

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      unsubSession();
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={icon} type="image/svg+xml" />
  <link rel="apple-touch-icon" href={icon} />
</svelte:head>

{#if data?.devMode && data?.authBaseUrl}
  <DevModeNotch authBaseUrl={data.authBaseUrl} currentUsername={data.devModeUser?.username} />
{/if}
{@render children()}
