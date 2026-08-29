import { cn } from "@/lib/utils";
import { statusChipClass } from "@/lib/statusColors";

export type FilterChipOption<T extends string = string> = {
  id: T;
  label: string;
  /** Color key from statusColors, or a raw className override */
  colorKey?: string;
  className?: string;
  count?: number;
};

type FilterChipsProps<T extends string> = {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
};

export function FilterChips<T extends string>({ options, value, onChange, ariaLabel = "Filters", className, size = "sm" }: FilterChipsProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = value === opt.id;
        const color = opt.className ?? statusChipClass(opt.colorKey ?? opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-full border font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              selected ? color : "border-border/60 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              selected && "ring-1 ring-inset ring-current/20"
            )}
          >
            {opt.label}
            {opt.count != null && <span className="ml-1 tabular-nums opacity-70">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

type MultiFilterChipsProps<T extends string> = {
  options: FilterChipOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  ariaLabel?: string;
  className?: string;
};

/** Toggle chips that allow multiple selections (e.g. search tags). */
export function ToggleChips<T extends string>({ options, values, onChange, ariaLabel = "Tags", className }: MultiFilterChipsProps<T>) {
  const toggle = (id: T) => {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = values.includes(opt.id);
        const color = opt.className ?? statusChipClass(opt.colorKey ?? opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(opt.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              selected ? color : "border-border/60 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
