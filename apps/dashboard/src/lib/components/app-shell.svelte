<script lang="ts">
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import HonestState from "$lib/components/honest-state.svelte";
  import SectionNav from "$lib/components/section-nav.svelte";
  import TreeSwitcher from "$lib/components/tree-switcher.svelte";
  import { EXPERIENCE_COPY } from "$lib/experience-copy";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import type { TreeId } from "$lib/types";
  import type { Snippet } from "svelte";

  let {
    children,
    trees = [],
    tree = null,
    bmadRootError = null,
  }: {
    children: Snippet;
    trees?: TreeId[];
    tree?: TreeId | null;
    bmadRootError?: string | null;
  } = $props();

  let sheetOpen = $state(false);

  function closeSheet() {
    sheetOpen = false;
  }
</script>

<div class="flex min-h-screen flex-col bg-background">
  <header class="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
    <Sheet.Root bind:open={sheetOpen}>
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" size="sm" {...props}>
            <PanelLeftIcon />
            Navigation
          </Button>
        {/snippet}
      </Sheet.Trigger>
      <Sheet.Content side="left" class="w-[280px] max-w-[85vw] border-border bg-background p-0 shadow-none">
        <Sheet.Header class="border-b border-border px-3 py-4 text-left">
          <Sheet.Title class="text-label tracking-widest text-muted-foreground uppercase">dashboard</Sheet.Title>
        </Sheet.Header>
        <div class="px-3 pb-3">
          <TreeSwitcher {trees} {tree} />
        </div>
        <nav aria-label="Sections" class="border-t border-border px-2 py-3">
          <SectionNav {tree} onNavigate={closeSheet} />
        </nav>
      </Sheet.Content>
    </Sheet.Root>
    <span class="text-label text-muted-foreground uppercase tracking-widest">dashboard</span>
  </header>

  <div class="flex min-h-0 flex-1">
    <aside class="hidden w-[280px] shrink-0 border-r border-border bg-background px-3 py-4 lg:block" aria-label="Application navigation">
      <p class="text-label tracking-widest text-muted-foreground uppercase">dashboard</p>
      <TreeSwitcher {trees} {tree} />
      <nav aria-label="Sections" class="mt-4 border-t border-border pt-4">
        <SectionNav {tree} />
      </nav>
    </aside>

    <main class="min-w-0 flex-1 p-4">
      {#if bmadRootError || trees.length === 0}
        <div class="mb-4 border-b border-border pb-4">
          <HonestState
            title={EXPERIENCE_COPY.bmadRootUnavailable.title}
            reason={bmadRootError ?? EXPERIENCE_COPY.bmadRootUnavailable.reasonFallback}
          />
        </div>
      {/if}
      {@render children()}
    </main>
  </div>
</div>
