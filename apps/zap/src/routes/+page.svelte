<script lang="ts">
  import { goto } from "$app/navigation";
  import WaveBars from "$lib/components/WaveBars.svelte";
  import type { LayoutData } from "./$types";
  import { onMount } from "svelte";

  let { data }: { data: LayoutData } = $props();

  onMount(() => {
    if (data.user?.emailVerified) {
      void goto("/home", { replaceState: true });
    }
  });
</script>

<main class="zap-wave-field zap-grid relative min-h-screen overflow-hidden">
  <div class="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
    <p class="font-mono text-xs tracking-[0.35em] text-signal/80 uppercase">Pocket Dimension</p>
    <h1 class="mt-4 text-6xl font-semibold tracking-tight text-foreground md:text-8xl">Zap</h1>
    <p class="mt-4 max-w-md text-lg text-muted-foreground">Catalogue in, sessions out — queue tracks, join devices, optional Discord voice.</p>
    <div class="mt-8">
      <WaveBars />
    </div>
    <div class="mt-10 flex flex-wrap gap-3">
      {#if data.user}
        {#if data.user.emailVerified}
          <a href="/home" class="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">Home</a>
        {:else}
          <a href="/check-email?reason=verify" class="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Verify email</a>
        {/if}
        <a
          href="/session?stay=1"
          class="rounded border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40"
        >
          Go to sessions
        </a>
        <a href="/join" class="rounded border border-border bg-secondary/60 px-5 py-2.5 text-sm text-secondary-foreground hover:bg-secondary">
          Join
        </a>
        <a href="/catalogue" class="rounded border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40"> Catalogue </a>
      {:else}
        <a href="/login?redirect=/home" class="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          Sign in
        </a>
        <a href="/sign-up" class="rounded border border-border bg-secondary/60 px-5 py-2.5 text-sm text-secondary-foreground hover:bg-secondary">
          Create account
        </a>
      {/if}
    </div>
    {#if data.user}
      <p class="mt-6 max-w-lg font-mono text-[11px] leading-relaxed text-muted-foreground">
        Home = hub · Sessions = start/resume/join · Catalogue = find & tag · Playlists = Zap lists.
      </p>
    {/if}
  </div>
</main>
