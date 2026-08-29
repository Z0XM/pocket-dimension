import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipBadge = (channel: string) => `border-transparent bg-[hsl(var(${channel})/0.15)] text-[hsl(var(${channel}))]`;

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        done: chipBadge("--chip-emerald"),
        "in-progress": chipBadge("--chip-sky"),
        review: chipBadge("--chip-violet"),
        blocked: chipBadge("--chip-rose"),
        backlog: "border-transparent bg-muted text-muted-foreground",
        "ready-for-dev": chipBadge("--chip-teal"),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
