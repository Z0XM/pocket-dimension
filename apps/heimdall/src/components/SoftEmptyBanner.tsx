import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSoftEmptyCopy, type SoftEmptyKind } from "@/lib/softEmptyCopy";

/**
 * Honest empty state when configured BMAD paths are missing or parsers
 * do not match this repo's layout (packages dogfood soft-empty).
 */
export function SoftEmptyBanner({ kind }: { kind: SoftEmptyKind }) {
  const { title, description } = getSoftEmptyCopy(kind);

  return (
    <Alert role="status" className="mb-6 border-border/60 bg-card/40">
      <AlertCircle className="h-4 w-4 text-heading" aria-hidden />
      <AlertTitle className="font-sans text-sm font-medium">{title}</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        {description.split("heimdall doctor").map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>
              {part}
              <code className="font-mono text-xs">heimdall doctor</code>
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </AlertDescription>
    </Alert>
  );
}
