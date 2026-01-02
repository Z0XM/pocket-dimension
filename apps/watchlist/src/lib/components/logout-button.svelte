<script lang="ts">
import { LoaderCircle, LogOutIcon } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import { authClient } from "$lib/auth-client.js";
import { cn } from "$lib/utils.js";

let loading = $state(false);

async function handleLogout() {
  loading = true;
  try {
    await authClient.signOut();
    await goto("/login");
  } catch (err) {
    console.error("Logout error:", err);
    loading = false;
  }
}

const { class: className } = $props();
</script>

<Button variant='outline' onclick={handleLogout} disabled={loading} class={cn("flex items-center gap-2 px-4 py-2", className)}>
  {#if loading}
    <LoaderCircle class="animate-spin" />
  {:else}
  Logout <LogOutIcon  />
  {/if}
</Button>
