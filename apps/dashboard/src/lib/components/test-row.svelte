<script lang="ts">
  import { sectionHref } from "$lib/nav";
  import type { TestCatalogEntry, TreeId } from "$lib/types";

  let {
    test,
    tree = null,
  }: {
    test: TestCatalogEntry;
    tree?: TreeId | null;
  } = $props();

  const href = $derived(sectionHref(test.href, tree));
</script>

<a
  {href}
  class="text-label block border-l-2 border-transparent px-2.5 py-2 text-muted-foreground hover:border-accent hover:bg-card hover:text-foreground"
>
  <span class="block text-foreground">{test.name}</span>
  <span class="font-mono text-xs text-muted-foreground">{test.sourcePath}</span>
</a>
