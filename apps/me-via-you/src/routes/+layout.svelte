<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import icon from "$lib/assets/icon.svg";
  import { authClient } from "$lib/auth-client";

  const { children } = $props();

  onMount(() => {
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

{@render children()}
