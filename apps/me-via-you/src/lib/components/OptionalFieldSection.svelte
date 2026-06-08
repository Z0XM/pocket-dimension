<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { ChevronDown } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  type Props = {
    open?: boolean;
    title: string;
    hint?: string;
    optional?: boolean;
    children: Snippet;
  };

  let { open = $bindable(false), title, hint, optional = true, children }: Props = $props();
</script>

<div class="overflow-hidden rounded-lg border border-border bg-background/40 {open ? 'border-accent/30' : ''}">
  <button
    type="button"
    class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
    onclick={() => (open = !open)}
    aria-expanded={open}
  >
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-foreground">{title}</span>
        {#if optional}
          <span class="rounded-full bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"> Optional </span>
        {/if}
      </div>
      {#if hint}
        <p class="mt-1 text-xs text-muted-foreground">{hint}</p>
      {/if}
    </div>
    <ChevronDown class={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
  </button>

  {#if open}
    <div class="border-t border-border px-4 py-3">
      {@render children()}
    </div>
  {/if}
</div>
