<script lang="ts">
  import type { Snippet } from "svelte";
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
  import { cn } from "$lib/utils.js";

  type Props = {
    label: string;
    active?: boolean;
    variant?: "default" | "destructive" | "accent";
    disabled?: boolean;
    showTooltip?: boolean;
    onclick?: () => void;
    children: Snippet;
  };

  let { label, active = false, variant = "default", disabled = false, showTooltip = true, onclick, children }: Props = $props();

  const buttonClass = cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:size-10",
    variant === "destructive" &&
      "border-destructive/40 bg-destructive text-white hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25 active:scale-95",
    variant === "accent" && active && "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:shadow-sm active:scale-95",
    variant === "accent" && !active && "border-border bg-card text-foreground hover:bg-secondary hover:shadow-sm active:scale-95",
    variant === "default" &&
      active &&
      "border-border bg-primary/10 text-foreground hover:bg-primary/20 hover:shadow-sm hover:shadow-participant-orange/15 active:scale-95",
    variant === "default" && !active && "border-border bg-card text-foreground hover:bg-secondary hover:shadow-sm active:scale-95"
  );
</script>

{#if showTooltip}
  <Tooltip>
    <TooltipTrigger>
      <button type="button" class={buttonClass} aria-label={label} aria-pressed={active} {disabled} {onclick}>
        {@render children()}
      </button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
{:else}
  <button type="button" class={buttonClass} aria-label={label} aria-pressed={active} {disabled} {onclick}>
    {@render children()}
  </button>
{/if}
