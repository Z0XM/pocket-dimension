import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarBrand, SidebarNav } from "@/components/SidebarNav";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-border/60 bg-card/95 shadow-2xl backdrop-blur-md outline-none",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            "lg:hidden"
          )}
        >
          <DialogPrimitive.Title className="sr-only">Navigation menu</DialogPrimitive.Title>
          <SidebarBrand />
          <Separator />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <SidebarNav onNavigate={() => onOpenChange(false)} />
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-4 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close menu</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
