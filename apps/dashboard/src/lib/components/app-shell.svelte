<script lang="ts">
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import type { Snippet } from "svelte";

  const sections = ["Overview", "Features", "Epics & Stories", "Tests", "Docs"] as const;

  let { children }: { children: Snippet } = $props();
  let sheetOpen = $state(false);
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
        <nav aria-label="Sections" class="px-2 py-3">
          <ul class="space-y-0.5">
            {#each sections as section, index (section)}
              <li>
                <span
                  class="text-label block border-l-2 px-2.5 py-2 {index === 0
                    ? 'border-accent bg-card text-foreground'
                    : 'border-transparent text-muted-foreground'}"
                  aria-current={index === 0 ? "page" : undefined}
                >
                  {section}
                </span>
              </li>
            {/each}
          </ul>
        </nav>
      </Sheet.Content>
    </Sheet.Root>
    <span class="text-label text-muted-foreground uppercase tracking-widest">dashboard</span>
  </header>

  <div class="flex min-h-0 flex-1">
    <aside class="hidden w-[280px] shrink-0 border-r border-border bg-background px-3 py-4 lg:block" aria-label="Application navigation">
      <p class="text-label tracking-widest text-muted-foreground uppercase">dashboard</p>
      <nav aria-label="Sections" class="mt-4">
        <ul class="space-y-0.5">
          {#each sections as section, index (section)}
            <li>
              <span
                class="text-label block border-l-2 px-2.5 py-2 {index === 0
                  ? 'border-accent bg-card text-foreground'
                  : 'border-transparent text-muted-foreground'}"
                aria-current={index === 0 ? "page" : undefined}
              >
                {section}
              </span>
            </li>
          {/each}
        </ul>
      </nav>
    </aside>

    <main class="min-w-0 flex-1 p-4">
      {@render children()}
    </main>
  </div>
</div>
