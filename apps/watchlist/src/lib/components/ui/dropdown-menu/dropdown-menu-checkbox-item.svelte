<script lang="ts">
import CheckIcon from "@lucide/svelte/icons/check";
import MinusIcon from "@lucide/svelte/icons/minus";
import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
import type { Snippet } from "svelte";
import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

let {
  ref = $bindable(null),
  checked = $bindable(false),
  indeterminate = $bindable(false),
  class: className,
  children: childrenProp,
  ...restProps
}: WithoutChildrenOrChild<DropdownMenuPrimitive.CheckboxItemProps> & {
  children?: Snippet;
} = $props();
</script>

<DropdownMenuPrimitive.CheckboxItem
	bind:ref
	bind:checked
	bind:indeterminate
	data-slot="dropdown-menu-checkbox-item"
	class={cn(
		"focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground min-h-7 gap-2 rounded-md py-1.5 pr-8 pl-2 text-xs [&_svg:not([class*='size-'])]:size-3.5 relative flex cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{#snippet children({ checked, indeterminate })}
		<span
			class="pointer-events-none absolute right-2 flex items-center justify-center pointer-events-none"
		>
			{#if indeterminate}
				<MinusIcon class="size-4" />
			{:else}
				<CheckIcon class={cn("size-4", !checked && "text-transparent")} />
			{/if}
		</span>
		{@render childrenProp?.()}
	{/snippet}
</DropdownMenuPrimitive.CheckboxItem>
