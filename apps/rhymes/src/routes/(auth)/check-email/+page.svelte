<script lang="ts">
  import { page } from "$app/stores";

  const email = $derived($page.url.searchParams.get("email") ?? "");
</script>

<div class="space-y-3 text-center">
  <h1 class="font-heading text-2xl text-theme-peach-1">Check your email</h1>
  <p class="text-sm text-theme-peach-3">
    {#if email}
      We sent a verification link to <span class="text-theme-peach-1">{email}</span>.
    {:else}
      We sent a verification link to your inbox.
    {/if}
  </p>
  <p class="text-xs text-theme-peach-3">After verifying, return to <a href="/login" class="underline">sign in</a>.</p>
</div>
