<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import Disc3Icon from "@lucide/svelte/icons/disc-3";
  import PageHeader from "$lib/components/PageHeader.svelte";
</script>

<section class="zap-page">
  <PageHeader title="Spotify">
    {#snippet crumb()}
      <a href="/connections" class="inline-flex items-center gap-1 hover:text-signal">
        <ArrowLeftIcon class="size-3" aria-hidden="true" />
        Connections
      </a>
    {/snippet}
    {#snippet meta()}
      Coming later
    {/snippet}
  </PageHeader>

  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <div class="space-y-3 border border-border/70 bg-card/30 p-4">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Details</h2>
      <p class="flex items-center gap-2 text-sm text-muted-foreground">
        <Disc3Icon class="size-4 shrink-0" aria-hidden="true" />
        Spotify OAuth is not wired in Zap yet. This page is a placeholder for connect status and activity.
      </p>
    </div>

    <div class="mt-6 space-y-3">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Activity</h2>
      <p class="font-mono text-[11px] text-muted-foreground">No Spotify activity.</p>
    </div>
  </div>
</section>
