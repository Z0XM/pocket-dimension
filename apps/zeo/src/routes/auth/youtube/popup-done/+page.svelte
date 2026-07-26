<script lang="ts">
  import { onMount } from "svelte";

  onMount(() => {
    const payload = { type: "zeo-youtube-oauth", status: "linked" as const };
    try {
      window.opener?.postMessage(payload, window.location.origin);
    } catch {
      // opener may be inaccessible; opener also polls link status on close
    }
    window.close();
  });
</script>

<main class="flex min-h-dvh items-center justify-center bg-background px-6 text-center text-foreground">
  <div>
    <p class="text-base font-medium">YouTube connected</p>
    <p class="mt-2 text-sm text-muted-foreground">You can close this window and return to the call.</p>
  </div>
</main>
