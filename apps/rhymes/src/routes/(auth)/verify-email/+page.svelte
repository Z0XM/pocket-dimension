<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";

  let message = $state("Verifying your email...");

  onMount(async () => {
    const session = await authClient.getSession();
    if (session.data?.user?.emailVerified) {
      message = "Email verified. Redirecting...";
      await goto("/");
      return;
    }

    message = "If verification succeeded, sign in to continue.";
  });
</script>

<div class="space-y-3 text-center">
  <h1 class="font-heading text-2xl text-theme-peach-1">Email verification</h1>
  <p class="text-sm text-theme-peach-3">{message}</p>
  <a href="/login" class="inline-block text-sm text-theme-peach-1 underline">Go to sign in</a>
</div>
