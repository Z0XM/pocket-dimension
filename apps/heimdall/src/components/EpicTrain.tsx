import { Link } from "react-router-dom";
import type { EpicRecord } from "@/api/client";
import { formatEpicId } from "@/lib/formatIds";
import { cn } from "@/lib/utils";
import { stripInlineMarkdown } from "@/lib/inlineMarkdown";

interface EpicTrainProps {
  epics: EpicRecord[];
  className?: string;
}

export function EpicTrain({ epics, className }: EpicTrainProps) {
  return (
    <div className={cn("epic-train", className)}>
      {epics.map((epic) => (
        <Link
          key={epic.id}
          to={`/epics/${epic.id}`}
          className={cn("epic-car", epic.status)}
          title={`Epic ${formatEpicId(epic)}: ${stripInlineMarkdown(epic.title)} (${epic.status})`}
        >
          {formatEpicId(epic)}
        </Link>
      ))}
    </div>
  );
}
