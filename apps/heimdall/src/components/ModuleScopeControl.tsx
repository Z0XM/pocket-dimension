import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/context/DashboardContext";
import { cn } from "@/lib/utils";

type ScopeOption = { value: string; label: string };

export function ModuleScopeControl() {
  const { modules, moduleScope, setModuleScope, showModuleScope } = useDashboard();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const wasOpen = useRef(false);

  const options: ScopeOption[] = [{ value: "all", label: "All modules" }, ...modules.map((mod) => ({ value: mod.id, label: mod.label }))];

  const selected = options.find((opt) => opt.value === moduleScope) ?? options[0] ?? { value: "all", label: "All modules" };

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === selected.value)
  );
  const [highlight, setHighlight] = useState(activeIndex);
  const safeHighlight = options.length === 0 ? 0 : Math.min(Math.max(highlight, 0), options.length - 1);

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      queueMicrotask(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!showModuleScope && open) {
      setOpen(false);
    }
  }, [showModuleScope, open]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setHighlight(activeIndex);
      queueMicrotask(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.focus();
      });
    }
    wasOpen.current = open;
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu(false);
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu(false);
      }
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!showModuleScope) return null;

  const choose = (value: string) => {
    setModuleScope(value);
    closeMenu(true);
  };

  const moveHighlight = (delta: number) => {
    setHighlight((prev) => {
      const current = Math.min(Math.max(prev, 0), options.length - 1);
      const next = (current + delta + options.length) % options.length;
      queueMicrotask(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
      });
      return next;
    });
  };

  const focusOption = (index: number) => {
    setHighlight(index);
    queueMicrotask(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
    });
  };

  const onOptionKeyDown = (event: ReactKeyboardEvent, value: string) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(value);
    } else if (event.key === "Tab") {
      closeMenu(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        aria-label="Module scope"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
          }
        }}
      >
        <span className="max-w-[12rem] truncate">{selected.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Module scope"
          className="absolute right-0 z-50 mt-1 min-w-full max-w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-md border border-border bg-card py-1 shadow-sm"
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === selected.value;
            const isHighlighted = index === safeHighlight;
            return (
              <div
                key={opt.value}
                role="option"
                data-index={index}
                aria-selected={isSelected}
                tabIndex={isHighlighted ? 0 : -1}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isHighlighted && "bg-accent text-accent-foreground",
                  !isHighlighted && isSelected && "bg-muted/60 text-foreground",
                  !isHighlighted && !isSelected && "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(opt.value)}
                onKeyDown={(event) => onOptionKeyDown(event, opt.value)}
              >
                <Check className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="truncate">{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
