<script lang="ts">
  /**
   * Keeps prior list visible while refetching — dims + status strip, no layout jump.
   */
  let {
    busy = false,
    label = "Updating…",
    fill = false,
    children,
  }: {
    busy?: boolean;
    label?: string;
    /** Stretch to the parent's height so a child scroller can own scrolling. */
    fill?: boolean;
    children: import("svelte").Snippet;
  } = $props();
</script>

<div class={`relative ${fill ? "h-full" : ""}`}>
  <div class={`transition-opacity duration-150 ${fill ? "h-full" : ""} ${busy ? "pointer-events-none opacity-55" : ""}`}>
    {@render children()}
  </div>
  {#if busy}
    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2" role="status" aria-live="polite" aria-busy="true">
      <span
        class="inline-flex items-center gap-2 rounded border border-signal/35 bg-background/90 px-2.5 py-1 font-mono text-[10px] tracking-wide text-signal shadow-sm backdrop-blur-sm"
      >
        <span class="zap-busy-bars" aria-hidden="true"><span></span><span></span><span></span></span>
        {label}
      </span>
    </div>
  {/if}
</div>
