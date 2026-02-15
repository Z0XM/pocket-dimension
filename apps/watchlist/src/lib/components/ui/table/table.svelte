<script lang="ts">
  import type { HTMLTableAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  let { ref = $bindable(null), class: className, children, ...restProps }: WithElementRef<HTMLTableAttributes> = $props();
</script>

<div data-slot="table-container" class="md:px-8 relative w-full overflow-x-auto h-[90vh] overflow-y-scroll">
  <table bind:this={ref} data-slot="table" class={cn("w-full caption-bottom text-xs", className)} {...restProps}>
    {@render children?.()}
  </table>
</div>
