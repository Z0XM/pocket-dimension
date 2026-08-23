<script lang="ts">
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();
</script>

<svelte:head>
  <title>dashboard</title>
  <meta name="description" content="BMAD Showcase dashboard for the Pocket Dimension monorepo." />
</svelte:head>

<div class="space-y-4">
  <header class="space-y-2">
    <h1 class="text-display text-foreground">dashboard</h1>
    {#if data.tree}
      <p class="max-w-prose text-muted-foreground">
        Selected tree: <span class="text-foreground">{data.tree}</span>. Overview and section routes arrive in Story 1.4.
      </p>
    {:else if !data.bmadRootError}
      <p class="max-w-prose text-muted-foreground">No Current BMAD Tree is selected.</p>
    {/if}
  </header>

  {#if data.tree}
    <section class="space-y-2 border-t border-border pt-4">
      <p class="text-label text-foreground">{data.tree}</p>
      <p class="text-muted-foreground">Tree context is wired. Content catalog and Overview counts come in later stories.</p>
    </section>
  {/if}
</div>
