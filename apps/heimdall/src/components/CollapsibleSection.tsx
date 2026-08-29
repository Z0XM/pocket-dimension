import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  /** When true, CardContent has no padding (tables). */
  flush?: boolean;
  badge?: ReactNode;
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className,
  contentClassName,
  flush = false,
  badge,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <Card className={cn("border-border/60 bg-card/50", className)}>
      <CardHeader className="py-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="text-base font-sans">{title}</CardTitle>
            {badge}
          </div>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      {open && (
        <CardContent id={panelId} className={cn(flush && "p-0", contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
