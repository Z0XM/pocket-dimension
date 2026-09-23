<script lang="ts">
  import DevModeNotch from "$lib/components/dev-mode-notch.svelte";
  import "../app.css";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";

  const { children, data } = $props();

  onMount(() => {
    const session = authClient.useSession();
    const unsubSession = session.subscribe(() => {});
    return () => {
      unsubSession();
    };
  });
</script>

{#if data?.devMode && data?.authBaseUrl}
  <DevModeNotch authBaseUrl={data.authBaseUrl} currentUsername={data.devModeUser?.username} />
{/if}
{@render children()}
