<script lang="ts">
  import { UserIndex } from "$lib/legacy-recap";

  const { data } = $props();
</script>

<svelte:head>
  <title>2025 Year Recap · How Was Your Day</title>
</svelte:head>

<div class="legacy-recap-root">
  {#if !data.signedIn}
    <p class="signin-nudge">
      Already claimed a dashboard?
      <a href="/login?redirectTo=%2Frecap%2F2025">Sign in</a>
      to Pocket Dimension to open linked recaps without OTP.
    </p>
  {/if}
  <UserIndex users={data.users} />
</div>

<style>
  .legacy-recap-root {
    --display: "Fraunces", Georgia, serif;
    --sans: "Outfit", system-ui, sans-serif;
    --paper: #f3f6f4;
    --ink: #142326;
    --ink-soft: #3d5256;
    --ink-mute: #6a7f83;
    position: relative;
  }

  .signin-nudge {
    position: relative;
    z-index: 1;
    margin: 0;
    padding: 0.85rem clamp(1.5rem, 4vw, 3.5rem);
    font-size: 0.92rem;
    color: var(--ink-soft);
    background: color-mix(in srgb, #214247 8%, #f3f6f4);
    border-bottom: 1px solid color-mix(in srgb, #142326 10%, transparent);
  }

  .signin-nudge a {
    color: #214247;
    text-underline-offset: 2px;
  }
</style>
