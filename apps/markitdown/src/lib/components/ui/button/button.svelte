<script lang="ts" module>
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
  import { tv, type VariantProps } from "tailwind-variants";
  import { cn, type WithElementRef } from "$lib/utils.js";

  export const buttonVariants = tv({
    base: "focus-visible:border-ring cursor-pointer focus-visible:ring-ring/30 rounded-md border border-transparent bg-clip-padding text-xs/relaxed font-medium focus-visible:ring-[2px] inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none select-none",
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline: "border-accent/50 bg-input/30 hover:bg-input/50 hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-8 gap-1.5 px-3 text-xs",
        sm: "h-7 gap-1 px-2.5 text-xs",
        lg: "h-9 gap-2 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
  export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    };
</script>

<script lang="ts">
  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    class={cn(buttonVariants({ variant, size }), className)}
    {href}
    aria-disabled={disabled}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button bind:this={ref} class={cn(buttonVariants({ variant, size }), className)} {type} {disabled} {...restProps}>
    {@render children?.()}
  </button>
{/if}
