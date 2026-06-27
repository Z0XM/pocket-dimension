<script lang="ts">
  import type { LayoutData } from "../$types";

  const { data }: { data: LayoutData } = $props();
</script>

<svelte:head>
  <title>zeo — video calls</title>
  <meta name="description" content="Self-hosted group video calls for Pocket Dimension." />
</svelte:head>

<header class="mb-12 space-y-4">
  <div class="flex items-center gap-3">
    <div
      class="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10"
    >
      <span class="text-lg font-bold text-primary">z</span>
    </div>
    <p class="font-mono text-xs uppercase tracking-[0.35em] text-accent">Pocket Dimension</p>
  </div>

  <div class="space-y-2">
    <h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">zeo</h1>
    <p class="max-w-xl text-base text-muted-foreground">
      Self-hosted group video calls with screen sharing.
    </p>
  </div>
</header>

<main class="flex-1 space-y-6">
  {#if data.user}
    <div class="rounded-xl border border-border bg-card/60 px-6 py-6">
      <p class="text-sm text-muted-foreground">Signed in as</p>
      <p class="font-medium text-foreground">{data.user.email}</p>
      <p class="mt-1 text-xs text-muted-foreground">Role: {data.user.role}</p>
    </div>
  {/if}

  <div class="rounded-xl border border-border bg-card/60 px-6 py-10">
    <p class="text-sm text-muted-foreground">
      Room create/join and LiveKit integration arrive in upcoming stories.
    </p>
  </div>
</main>
