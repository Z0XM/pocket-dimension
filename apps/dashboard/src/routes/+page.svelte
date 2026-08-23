<script lang="ts">
  import { navigating } from "$app/stores";
  import { overviewSectionLinks } from "$lib/nav";
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();

  const sectionLinks = $derived(overviewSectionLinks(data.tree));
</script>

<svelte:head>
  <title>dashboard</title>
  <meta name="description" content="BMAD Showcase dashboard for the Pocket Dimension monorepo." />
</svelte:head>

{#if $navigating}
  <p class="mb-4 text-muted-foreground">Reading BMAD…</p>
{/if}

<div class="space-y-6">
  {#if data.tree}
    <header class="space-y-2">
      <h1 class="text-display text-foreground">{data.tree}</h1>
      <p class="max-w-prose text-muted-foreground">Overview for the selected Current BMAD Tree.</p>
    </header>

    <nav aria-label="Section destinations" class="border-t border-border pt-4">
      <ul class="space-y-1">
        {#each sectionLinks as item (item.href)}
          <li>
            <a
              href={item.href}
              class="text-label block border-l-2 border-transparent px-2.5 py-2 text-muted-foreground hover:border-accent hover:bg-card hover:text-foreground"
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {:else if !data.bmadRootError}
    <p class="text-muted-foreground">No Current BMAD Tree is selected.</p>
  {/if}
</div>
