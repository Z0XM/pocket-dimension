<script lang="ts">
  import StartSessionButton from "$lib/components/StartSessionButton.svelte";
  import WaveBars from "$lib/components/WaveBars.svelte";
  import type { LayoutData } from "./$types";

  let { data }: { data: LayoutData } = $props();
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
        <StartSessionButton class="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40" />
        <a href="/join" class="rounded border border-border bg-secondary/60 px-5 py-2.5 text-sm text-secondary-foreground hover:bg-secondary">
          Join
        </a>
        <a href="/library" class="rounded border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40"> Library </a>
        <a href="/library?tab=upload" class="rounded border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40">
          Add music
        </a>
      {:else}
        <a href="/login?redirect=/" class="rounded bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"> Sign in </a>
        <a href="/sign-up" class="rounded border border-border bg-secondary/60 px-5 py-2.5 text-sm text-secondary-foreground hover:bg-secondary">
          Create account
        </a>
      {/if}
    </div>
    {#if data.user}
      <p class="mt-6 max-w-lg font-mono text-[11px] leading-relaxed text-muted-foreground">
        Session = play with guests · Library → Add = upload / public URL / Connect YouTube · Discord sink = attach inside a live session.
      </p>
    {/if}
  </div>
</main>
