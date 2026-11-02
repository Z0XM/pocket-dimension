<script lang="ts">
  import { onMount } from "svelte";
  import { readCatalogueTagDisplay, ZAP_THEME_EVENT, type CatalogueTagDisplay } from "$lib/theme-prefs";

  let {
    tags = [],
  }: {
    tags: { id: string; name: string; kind?: string; icon?: string | null }[];
  } = $props();

  let tagDisplay = $state<CatalogueTagDisplay>("text");

  onMount(() => {
    tagDisplay = readCatalogueTagDisplay();
    const sync = () => {
      tagDisplay = readCatalogueTagDisplay();
    };
    window.addEventListener(ZAP_THEME_EVENT, sync);
    return () => window.removeEventListener(ZAP_THEME_EVENT, sync);
  });
</script>

{#if tags.length}
  <span class="flex min-w-0 flex-wrap items-center gap-0.5">
    {#each tags as tag (tag.id)}
      {#if tagDisplay === "icons"}
        {#if tag.icon}
          <span class="zap-tag-icon text-sm" title={tag.name} aria-label={tag.name}>{tag.icon}</span>
        {:else}
          <span class="zap-tag-chip px-1.5 py-0 text-[9px]" title={tag.name}>{tag.name}</span>
        {/if}
      {:else if tagDisplay === "both"}
        <span class="zap-tag-chip inline-flex items-center gap-0.5 px-1.5 py-0 text-[9px]" title={tag.name}>
          {#if tag.icon}<span class="zap-tag-icon text-sm" aria-hidden="true">{tag.icon}</span>{/if}
          {tag.name}
        </span>
      {:else}
        <span class="zap-tag-chip px-1.5 py-0 text-[9px]" title={tag.name}>{tag.name}</span>
      {/if}
    {/each}
  </span>
{/if}
