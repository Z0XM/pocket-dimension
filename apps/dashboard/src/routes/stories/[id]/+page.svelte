<script lang="ts">
  import HonestState from "$lib/components/honest-state.svelte";
  import MarkdownReader from "$lib/components/markdown-reader.svelte";
  import { encodePathSegments } from "$lib/docs-path";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import { sectionHref } from "$lib/nav";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const artifact = $derived(data.artifact);
  const tree = $derived(data.tree);

  function siblingHref(sourcePath: string): string {
    const encoded = encodePathSegments(sourcePath);
    const url = new URL(`/docs/${encoded}`, "http://local");
    if (tree) {
      url.searchParams.set("tree", tree);
    }
    return `${url.pathname}${url.search}`;
  }
</script>

<svelte:head>
  <title>dashboard · Story · {artifact.title ?? artifact.sourcePath}</title>
</svelte:head>

<div class="space-y-4">
  <nav class="text-sm">
    <a href={sectionHref("/delivery", tree)} class="text-muted-foreground hover:text-foreground">← Epics &amp; Stories</a>
    <span class="text-muted-foreground mx-2">·</span>
    <a href={sectionHref("/docs", tree)} class="text-muted-foreground hover:text-foreground">Docs</a>
  </nav>

  {#if artifact.kind === "markdown"}
    <MarkdownReader html={artifact.html} title={artifact.title} sourcePath={artifact.sourcePath} kindLabel="Story" statusLabel={data.statusLabel} />
  {:else if artifact.kind === "run-folder"}
    <div class="max-w-[48rem] space-y-8 text-foreground">
      {#if artifact.primary}
        <MarkdownReader
          html={artifact.primary.html}
          title={artifact.primary.title}
          sourcePath={artifact.primary.sourcePath}
          kindLabel="Story"
          statusLabel={data.statusLabel}
        />
      {:else}
        <header class="space-y-1">
          <h1 class="text-display text-foreground">{artifact.title}</h1>
          <p class="text-label tracking-widest text-muted-foreground uppercase">Story</p>
          <p class="font-mono text-xs text-muted-foreground">{artifact.sourcePath}</p>
        </header>
      {/if}

      {#if artifact.siblings.length > 0}
        <section class="space-y-2">
          <h2 class="text-label tracking-widest text-muted-foreground uppercase">Files in this folder</h2>
          <ul class="space-y-1">
            {#each artifact.siblings as sibling (sibling.sourcePath)}
              <li>
                <a class="text-foreground underline-offset-4 hover:underline" href={siblingHref(sibling.sourcePath)}>
                  {sibling.title}
                </a>
                <span class="font-mono text-xs text-muted-foreground"> · {sibling.sourcePath}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {:else if artifact.kind === "text"}
    <article class="max-w-[48rem] text-foreground">
      <header class="mb-6 space-y-1">
        <h1 class="text-display text-foreground">{artifact.title}</h1>
        <p class="text-label tracking-widest text-muted-foreground uppercase">Story</p>
        <p class="font-mono text-xs text-muted-foreground">{artifact.sourcePath}</p>
      </header>
      <pre class="overflow-x-auto border border-border p-4 font-mono text-sm whitespace-pre-wrap">{artifact.text}</pre>
    </article>
  {:else}
    <div class="max-w-[48rem]">
      <HonestState title={EXPERIENCE_COPY.unreadableArtifact.title} reason={artifact.reason} meta={artifact.sourcePath} />
    </div>
  {/if}
</div>
