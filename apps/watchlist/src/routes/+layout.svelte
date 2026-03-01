<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";

  import Background from "$components/background.svelte";
  import Overlay from "$components/overlay.svelte";
  import { Toaster } from "$components/ui/sonner/index.js";
  import icon from "$lib/assets/icon.svg";

  const { children } = $props();

  onMount(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures to avoid breaking initial render.
    });
  });
</script>

<svelte:head>
  <link rel="icon" href={icon} />
</svelte:head>
<Background enableFilter={true} enableAnimation={false} />
<Toaster />
<Overlay />
{@render children()}
