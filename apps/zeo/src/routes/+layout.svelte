<script lang="ts">
  import "../app.css";
  import "@fontsource-variable/inter";
  import "@fontsource/fira-mono";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";
  import { TooltipProvider } from "$lib/components/ui/tooltip";

  const { children } = $props();

  onMount(() => {
    const session = authClient.useSession();
    const unsubSession = session.subscribe(() => {});
    return () => {
      unsubSession();
    };
  });
</script>

<TooltipProvider delayDuration={300}>
  {@render children()}
</TooltipProvider>
