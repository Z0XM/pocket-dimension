<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import PwaInstallButton from "$lib/components/PwaInstallButton.svelte";
  import { authClient } from "$lib/auth-client";

  const { children } = $props();

  // Set timezone offset cookie so the server can compute dates in the client's timezone
  onMount(() => {
    const session = authClient.useSession();
    const unsubSession = session.subscribe(() => {});

    const offset = new Date().getTimezoneOffset();
    document.cookie = `tz_offset=${offset};path=/;max-age=${7 * 86400};SameSite=Lax`;

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

<PwaInstallButton />
{@render children()}
