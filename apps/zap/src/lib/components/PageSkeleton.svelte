<script lang="ts">
  import TrackListSkeleton from "$lib/components/TrackListSkeleton.svelte";

  let {
    title = "Loading",
    showFilters = false,
    rows = 7,
    variant = "list",
  }: {
    title?: string;
    showFilters?: boolean;
    rows?: number;
    /** list = catalogue-style; form = join/add; home = hero + actions */
    variant?: "list" | "form" | "home";
  } = $props();
</script>

<section class="space-y-6" role="status" aria-live="polite" aria-busy="true" aria-label={title}>
  <div class="space-y-2">
    <div class="zap-skeleton h-8 w-40 rounded-sm"></div>
    <div class="zap-skeleton h-3 w-full max-w-md rounded-sm opacity-70"></div>
  </div>

  {#if variant === "home"}
    <div class="flex flex-wrap gap-3">
      <div class="zap-skeleton h-10 w-36 rounded-sm"></div>
      <div class="zap-skeleton h-10 w-24 rounded-sm opacity-80"></div>
      <div class="zap-skeleton h-10 w-28 rounded-sm opacity-70"></div>
    </div>
    <TrackListSkeleton rows={4} />
  {:else if variant === "form"}
    <div class="mx-auto max-w-md space-y-3">
      <div class="zap-skeleton h-3 w-20 rounded-sm opacity-70"></div>
      <div class="zap-skeleton h-11 w-full rounded-sm"></div>
      <div class="zap-skeleton h-10 w-full rounded-sm"></div>
    </div>
  {:else}
    {#if showFilters}
      <div class="space-y-3 rounded-lg border border-border/70 bg-card/50 p-4">
        <div class="flex gap-2">
          <div class="zap-skeleton h-8 w-14 rounded-sm"></div>
          <div class="zap-skeleton h-8 w-24 rounded-sm"></div>
        </div>
        <div class="zap-skeleton h-10 w-full rounded-sm"></div>
        <div class="zap-skeleton h-10 w-full rounded-sm opacity-80"></div>
        <div class="flex flex-wrap gap-2">
          {#each [1, 2, 3, 4, 5] as n}
            <div class="zap-skeleton h-6 w-14 rounded-full opacity-70"></div>
          {/each}
        </div>
      </div>
    {/if}

    <TrackListSkeleton {rows} />
  {/if}
</section>
