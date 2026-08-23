<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import type { TreeId } from "$lib/types";

  let {
    trees,
    tree,
  }: {
    trees: TreeId[];
    tree: TreeId | null;
  } = $props();

  function selectTree(slug: TreeId) {
    const next = new URL($page.url);
    next.searchParams.set("tree", slug);
    void goto(next, { keepFocus: true, noScroll: true });
  }

  function handleKeydown(event: KeyboardEvent, slug: TreeId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTree(slug);
    }
  }
</script>

<nav aria-label="Current BMAD Trees" class="mt-3">
  <p class="text-label mb-1.5 text-muted-foreground">Current BMAD Trees</p>
  <ul class="space-y-0.5">
    {#each trees as slug (slug)}
      <li>
        <button
          type="button"
          class="text-label block w-full border-l-2 px-2.5 py-2 text-left {tree === slug
            ? 'border-accent bg-card text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'}"
          aria-current={tree === slug ? "true" : undefined}
          onclick={() => selectTree(slug)}
          onkeydown={(event) => handleKeydown(event, slug)}
        >
          {slug}
        </button>
      </li>
    {/each}
  </ul>
</nav>
