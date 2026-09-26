<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  let { ref = $bindable(null), class: className, children, ...restProps }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
  bind:this={ref}
  data-slot="card"
  class={cn(
    "flex flex-col gap-2 rounded-md border border-border/80 bg-white/50 py-4 text-card-foreground shadow-none backdrop-blur-[2px]",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
