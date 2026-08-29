import { showModuleLabelChip } from "@/lib/softEmptyCopy";
import { cn } from "@/lib/utils";

type ModuleLabelChipProps = {
  moduleScope: string;
  moduleLabel?: string;
  className?: string;
};

/** Quiet Module label pill for view-all rows (FR-14, UX-DR5). Display-only. */
export function ModuleLabelChip({ moduleScope, moduleLabel, className }: ModuleLabelChipProps) {
  if (!showModuleLabelChip(moduleScope, moduleLabel)) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground",
        className
      )}
    >
      {moduleLabel}
    </span>
  );
}
