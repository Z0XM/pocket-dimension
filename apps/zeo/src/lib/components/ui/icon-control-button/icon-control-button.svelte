<script lang="ts">
  import type { Snippet } from "svelte";
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
  import { cn } from "$lib/utils.js";

  type Props = {
    label: string;
    active?: boolean;
    variant?: "default" | "destructive" | "accent";
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  };

  let { label, active = false, variant = "default", disabled = false, onclick, children }: Props = $props();
</script>

<Tooltip>
  <TooltipTrigger>
    <button
      type="button"
      class={cn(
        "inline-flex size-10 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        variant === "destructive" && "border-destructive/40 bg-destructive text-white hover:bg-destructive/90",
        variant === "accent" && active && "border-accent bg-accent/15 text-accent",
        variant === "accent" && !active && "border-border bg-card text-foreground hover:bg-secondary",
        variant === "default" && active && "border-primary bg-primary/10 text-foreground hover:bg-primary/15",
        variant === "default" && !active && "border-border bg-card text-foreground hover:bg-secondary"
      )}
      aria-label={label}
      aria-pressed={active}
      {disabled}
      {onclick}
    >
      {@render children()}
    </button>
  </TooltipTrigger>
  <TooltipContent>{label}</TooltipContent>
</Tooltip>
