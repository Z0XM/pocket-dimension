<script lang="ts">
  import { page } from "$app/stores";
  import { isSectionActive, sectionHref, SECTION_NAV } from "$lib/nav";
  import type { TreeId } from "$lib/types";

  let {
    tree = null,
    onNavigate,
  }: {
    tree?: TreeId | null;
    onNavigate?: () => void;
  } = $props();
</script>

<ul class="space-y-0.5">
  {#each SECTION_NAV as item (item.href)}
    {@const active = isSectionActive($page.url.pathname, item.href)}
    <li>
      <a
        href={sectionHref(item.href, tree)}
        class="text-label block border-l-2 px-2.5 py-2 {active
          ? 'border-accent bg-card text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'}"
        aria-current={active ? "page" : undefined}
        onclick={() => onNavigate?.()}
      >
        {item.label}
      </a>
    </li>
  {/each}
</ul>
