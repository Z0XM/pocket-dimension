<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    variant = "legend",
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLLegendElement>> & {
    variant?: "legend" | "label";
  } = $props();
</script>

<legend
  bind:this={ref}
  data-slot="field-legend"
  data-variant={variant}
  class={cn("mb-2 font-medium data-[variant=label]:text-xs/relaxed data-[variant=legend]:text-sm", className)}
  {...restProps}
>
  {@render children?.()}
</legend>
