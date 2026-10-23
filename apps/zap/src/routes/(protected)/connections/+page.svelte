<script lang="ts">
  import CableIcon from "@lucide/svelte/icons/cable";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import Disc3Icon from "@lucide/svelte/icons/disc-3";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import ListVideoIcon from "@lucide/svelte/icons/list-video";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function iconFor(id: string) {
    if (id === "discord") return HeadphonesIcon;
    if (id === "spotify") return Disc3Icon;
    if (id === "youtube") return ListVideoIcon;
    return CableIcon;
  }
</script>

<section class="zap-page">
  <PageHeader title="Connections">
    {#snippet meta()}
      Link accounts and manage Discord / YouTube imports
    {/snippet}
  </PageHeader>

  <div class="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
    {#each data.connections as c (c.id)}
      {@const Icon = iconFor(c.id)}
      <a
        href={c.href}
        class="flex items-center gap-3 border border-border/70 bg-card/30 px-4 py-3 transition-colors hover:border-signal/40 hover:bg-signal/5"
      >
        <span
          class={`inline-flex size-9 items-center justify-center border ${
            c.connected ? "border-signal/50 text-signal" : "border-border text-muted-foreground"
          }`}
        >
          <Icon class="size-4" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-foreground">{c.name}</p>
          <p class="truncate font-mono text-[11px] text-muted-foreground">{c.detail}</p>
        </div>
        <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </a>
    {/each}
  </div>
</section>
