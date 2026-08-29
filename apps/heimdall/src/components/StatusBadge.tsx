import type { StoryStatus } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PROGRESS_CHIP, PROGRESS_DIAL } from "@/lib/statusColors";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<StoryStatus, "done" | "in-progress" | "review" | "blocked" | "backlog" | "ready-for-dev"> = {
  done: "done",
  "in-progress": "in-progress",
  review: "review",
  blocked: "blocked",
  backlog: "backlog",
  "ready-for-dev": "ready-for-dev",
};

export function StatusBadge({ status }: { status: StoryStatus | string }) {
  const variant = STATUS_VARIANT[status as StoryStatus] ?? "backlog";
  return (
    <Badge variant={variant} className="capitalize">
      {status.replace(/-/g, " ")}
    </Badge>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return <Progress value={Math.min(100, Math.max(0, pct))} className="mt-2" />;
}

export function storyPct(storyCounts: { done: number; total: number }): number {
  if (!storyCounts.total) return 0;
  return Math.round((storyCounts.done / storyCounts.total) * 100);
}

function progressTone(pct: number): {
  dial: string;
  chip: string;
} {
  if (pct >= 100) {
    return { dial: PROGRESS_DIAL.complete, chip: PROGRESS_CHIP.complete };
  }
  if (pct > 0) {
    return { dial: PROGRESS_DIAL.partial, chip: PROGRESS_CHIP.partial };
  }
  return { dial: PROGRESS_DIAL.idle, chip: PROGRESS_CHIP.idle };
}

function ProgressDial({ pct, size = 26 }: { pct: number; size?: number }) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;
  const tone = progressTone(pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0 -rotate-90", tone.dial)} aria-hidden>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-secondary/70" />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  );
}

/** Epic progress: radial dial + count chip on one line. */
export function EpicProgressLine({
  storyCounts,
  className,
  compact = false,
}: {
  storyCounts: { done: number; total: number };
  className?: string;
  compact?: boolean;
}) {
  const pct = storyPct(storyCounts);
  const clamped = Math.min(100, Math.max(0, pct));
  const tone = progressTone(clamped);
  const dialSize = compact ? 22 : 26;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ProgressDial pct={clamped} size={dialSize} />
      <span
        className={cn(
          "shrink-0 rounded-full border px-1.5 py-0.5 font-mono tabular-nums leading-none",
          compact ? "text-[0.55rem]" : "text-[0.6rem]",
          tone.chip
        )}
        title={`${storyCounts.done} of ${storyCounts.total} stories complete`}
      >
        {storyCounts.total > 0 ? `${storyCounts.done}/${storyCounts.total} · ${clamped}%` : `${clamped}%`}
      </span>
    </div>
  );
}
