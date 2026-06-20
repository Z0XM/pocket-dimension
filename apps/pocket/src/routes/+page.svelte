<script lang="ts">
  import AppCard from "$lib/components/app-card.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Pocket — Pocket Dimension</title>
  <meta name="description" content="Your gateway to all apps in the Pocket Dimension monorepo." />
</svelte:head>

<header class="mb-12 space-y-4">
  <div class="flex items-center gap-3">
    <div class="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
      <span class="text-lg font-bold text-primary">P</span>
    </div>
    <p class="text-xs font-mono uppercase tracking-[0.35em] text-accent">Pocket Dimension</p>
  </div>

  <div class="space-y-2">
    <h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Pocket</h1>
    <p class="max-w-xl text-base text-muted-foreground">Your home base for every app in this project. Pick an app below to get started.</p>
  </div>
</header>

<main class="flex-1">
  {#if data.apps.length === 0}
    <div class="rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p class="text-sm font-medium text-foreground">No apps configured yet</p>
      <p class="mt-2 text-sm text-muted-foreground">
        Add app URLs to your <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env</code>
        file to populate this hub.
      </p>
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2">
      {#each data.apps as app (app.id)}
        <AppCard {app} />
      {/each}
    </div>
  {/if}
</main>

<footer class="mt-16 border-t border-border pt-6">
  <p class="text-xs text-muted-foreground">
    Pocket Dimension &middot; {data.apps.length}
    {data.apps.length === 1 ? "app" : "apps"} available
  </p>
</footer>
