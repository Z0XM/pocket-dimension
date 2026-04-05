<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";

  import Background from "$components/background.svelte";
  import Overlay from "$components/overlay.svelte";
  import PwaInstallButton from "$components/pwa-install-button.svelte";
  import { Toaster } from "$components/ui/sonner/index.js";
  import icon from "$lib/assets/icon.svg";
  import { authClient } from "$lib/auth-client";

  const { children } = $props();

  onMount(() => {
    const session = authClient.useSession();
    const unsubSession = session.subscribe(() => {});

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration failures to avoid breaking initial render.
      });
    }

    return () => {
      unsubSession();
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={icon} />
</svelte:head>
<Background enableFilter={true} enableAnimation={false} />
<Toaster />
<Overlay />
<PwaInstallButton />
{@render children()}
