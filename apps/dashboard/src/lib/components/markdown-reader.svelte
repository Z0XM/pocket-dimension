<script lang="ts">
  import { onMount } from "svelte";

  let {
    html,
    title,
    sourcePath = undefined,
    kindLabel = undefined,
  }: {
    html: string;
    title: string;
    sourcePath?: string;
    kindLabel?: string;
  } = $props();

  onMount(() => {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) {
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
</script>

<article class="max-w-[48rem] text-foreground">
  <header class="mb-6 space-y-1">
    <h1 class="text-display text-foreground">{title}</h1>
    {#if kindLabel}
      <p class="text-label text-muted-foreground uppercase tracking-widest">{kindLabel}</p>
    {/if}
    {#if sourcePath}
      <p class="font-mono text-xs text-muted-foreground">{sourcePath}</p>
    {/if}
  </header>

  <div
    class="markdown-reader-body prose prose-invert prose-neutral max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-foreground prose-strong:text-foreground prose-code:font-mono prose-pre:border prose-pre:border-border prose-pre:bg-transparent prose-th:border-border prose-td:border-border"
  >
    {@html html}
  </div>
</article>
