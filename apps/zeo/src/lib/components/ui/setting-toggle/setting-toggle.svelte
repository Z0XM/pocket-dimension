<script lang="ts">
  import type { Snippet } from "svelte";
  import { Switch } from "$lib/components/ui/switch";
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
  import { cn } from "$lib/utils.js";

  type Props = {
    id: string;
    label: string;
    tooltip: string;
    checked?: boolean;
    disabled?: boolean;
    class?: string;
    onCheckedChange?: (checked: boolean) => void;
    children?: Snippet;
  };

  let { id, label, tooltip, checked = $bindable(false), disabled = false, class: className, onCheckedChange, children }: Props = $props();

  function handleChange(value: boolean) {
    checked = value;
    onCheckedChange?.(value);
  }

  function toggleRow() {
    if (disabled) return;
    handleChange(!checked);
  }
</script>

<div
  class={cn(
    "flex items-center justify-between gap-3 rounded-md px-2 py-2 -mx-2 transition-colors",
    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-secondary/50",
    className
  )}
  onclick={toggleRow}
>
  <Tooltip>
    <TooltipTrigger class="cursor-pointer text-left text-sm text-foreground">{label}</TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>

  <div class="flex shrink-0 items-center gap-3" onclick={(e) => e.stopPropagation()}>
    {@render children?.()}
    <Switch {id} {checked} {disabled} onCheckedChange={(value) => handleChange(Boolean(value))} aria-label={label} />
  </div>
</div>
