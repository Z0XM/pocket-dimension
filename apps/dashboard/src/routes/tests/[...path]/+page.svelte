<script lang="ts">
  import HonestState from "$lib/components/honest-state.svelte";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const source = $derived(data.source);
</script>

<svelte:head>
  <title>dashboard · Tests · {source.kind === "text" ? source.name : source.sourcePath}</title>
</svelte:head>

{#if source.kind === "text"}
  <article class="max-w-[48rem] text-foreground">
    <header class="mb-6 space-y-1">
      <h1 class="text-display text-foreground">{source.name}</h1>
      <p class="font-mono text-xs text-muted-foreground">{source.sourcePath}</p>
    </header>
    <pre class="overflow-x-auto border border-border p-4 font-mono text-sm whitespace-pre-wrap">{source.text}</pre>
  </article>
{:else}
  <div class="max-w-[48rem]">
    <HonestState title={EXPERIENCE_COPY.unreadableArtifact.title} reason={source.reason} meta={source.sourcePath} />
  </div>
{/if}
