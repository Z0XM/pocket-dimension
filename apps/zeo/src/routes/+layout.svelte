<script lang="ts">
  import DevModeNotch from "$lib/components/dev-mode-notch.svelte";
  import "../app.css";
  import "@fontsource-variable/inter";
  import "@fontsource/fira-mono";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";
  import { registerServiceWorker } from "$lib/pwa";
  import { TooltipProvider } from "$lib/components/ui/tooltip";

  const { children, data } = $props();

  onMount(() => {
    registerServiceWorker();
    const session = authClient.useSession();
    const unsubSession = session.subscribe(() => {});
    return () => {
      unsubSession();
    };
  });
</script>

<TooltipProvider delayDuration={300}>
  {#if data?.devMode && data?.authBaseUrl}
    <DevModeNotch authBaseUrl={data.authBaseUrl} currentUsername={data.devModeUser?.username} />
  {/if}
  {@render children()}
</TooltipProvider>
