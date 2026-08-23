<script lang="ts">
  import { encodePathSegments } from "$lib/docs-path";
  import type { FeatureRow, TreeId } from "$lib/types";

  let {
    feature,
    tree = null,
  }: {
    feature: FeatureRow;
    tree?: TreeId | null;
  } = $props();

  const href = $derived.by(() => {
    const encoded = encodePathSegments(feature.sourcePath);
    const url = new URL(`/docs/${encoded}`, "http://local");
    if (tree) {
      url.searchParams.set("tree", tree);
    }
    url.hash = feature.headingSlug;
    return `${url.pathname}${url.search}${url.hash}`;
  });
</script>

<a
  {href}
  class="text-label block border-l-2 border-transparent px-2.5 py-2 text-muted-foreground hover:border-accent hover:bg-card hover:text-foreground"
>
  <span class="block font-mono text-xs text-accent">{feature.id}</span>
  <span class="block text-foreground">{feature.name}</span>
  <span class="block text-xs text-muted-foreground">{feature.sourceTitle}</span>
  <span class="font-mono text-xs text-muted-foreground">{feature.sourcePath}</span>
</a>
