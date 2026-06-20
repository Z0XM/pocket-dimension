<script lang="ts">
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
  import { appIcons } from "$lib/app-icons";
  import type { LinkedApp } from "$lib/apps";

  const { app }: { app: LinkedApp } = $props();

  const iconSrc = $derived(appIcons[app.id]);
</script>

<a
  class="group flex flex-col rounded-xl border border-border bg-card/60 p-5 transition-all hover:border-primary/40 hover:bg-card hover:shadow-[0_0_24px_rgba(147,51,234,0.08)]"
  href={app.url}
  rel="noopener noreferrer"
  target="_blank"
>
  <div class="mb-4 flex items-start {iconSrc ? 'justify-between' : 'justify-end'}">
    {#if iconSrc}
      <div
        class="flex size-10 items-center justify-center overflow-hidden rounded-lg border border-primary/20 bg-primary/10 transition-colors group-hover:border-primary/40 group-hover:bg-primary/15"
      >
        <img src={iconSrc} alt="" class="size-full object-cover" />
      </div>
    {/if}
    <ArrowUpRightIcon
      class="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
    />
  </div>

  <h2 class="text-base font-semibold text-foreground">{app.name}</h2>
  <p class="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>

  <p class="mt-4 truncate font-mono text-xs text-primary/70">{app.url}</p>
</a>
