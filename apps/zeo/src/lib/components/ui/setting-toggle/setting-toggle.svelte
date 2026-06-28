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
    onCheckedChange?: (checked: boolean) => void;
    children?: Snippet;
  };

  let { id, label, tooltip, checked = $bindable(false), disabled = false, onCheckedChange, children }: Props = $props();

  function handleChange(value: boolean) {
    checked = value;
    onCheckedChange?.(value);
  }
</script>

<div class={cn("flex items-center justify-between gap-3 py-2", disabled && "opacity-60")}>
  <Tooltip>
    <TooltipTrigger class="cursor-default text-left text-sm text-foreground">{label}</TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>

  <div class="flex shrink-0 items-center gap-3">
    {@render children?.()}
    <Switch {id} {checked} {disabled} onCheckedChange={(value) => handleChange(Boolean(value))} aria-label={label} />
  </div>
</div>
