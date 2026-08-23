<script lang="ts">
  import { groupArtifactsByKind } from "$lib/catalog/group-by-kind";
  import type { ArtifactRef, TreeId } from "$lib/types";

  let {
    artifacts = [],
    tree = null,
    activePath = null,
    onSelect,
  }: {
    artifacts?: ArtifactRef[];
    tree?: TreeId | null;
    activePath?: string | null;
    onSelect?: (sourcePath: string) => void;
  } = $props();

  const groups = $derived(groupArtifactsByKind(artifacts));

  function rowHref(sourcePath: string): string {
    const url = new URL("/docs", "http://local");
    if (tree) {
      url.searchParams.set("tree", tree);
    }
    url.searchParams.set("artifact", sourcePath);
    return `${url.pathname}${url.search}`;
  }

  function handleSelect(sourcePath: string, event: MouseEvent) {
    // Story 2.2 attaches Reader at `/docs/[...path]` and switches active detection
    // to `page.url.pathname`. Until then, Docs-local `?artifact=` keeps the Catalog
    // mounted while selecting rows.
    event.preventDefault();
    onSelect?.(sourcePath);
  }
</script>

<nav aria-label="Docs catalog" class="space-y-4">
  {#each groups as group (group.kind)}
    <section>
      <h2 class="text-label mb-1 tracking-widest text-muted-foreground uppercase">{group.label}</h2>
      <ul class="space-y-0.5">
        {#each group.items as item (item.id)}
          {@const active = activePath === item.sourcePath}
          <li>
            <a
              href={rowHref(item.sourcePath)}
              class="text-label block border-l-2 px-2.5 py-2 {active
                ? 'border-accent bg-card text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'}"
              aria-current={active ? "true" : undefined}
              onclick={(event) => handleSelect(item.sourcePath, event)}
            >
              <span class="block text-foreground">{item.title}</span>
              <span class="font-mono text-xs text-muted-foreground">{item.sourcePath}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</nav>
