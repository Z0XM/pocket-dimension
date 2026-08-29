import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DeliverySlice, EpicRecord, StoryRecord, StoryStatus } from "@/api/client";
import { ModuleLabelChip } from "@/components/ModuleLabelChip";
import { EpicProgressLine, ProgressBar, StatusBadge, storyPct } from "@/components/StatusBadge";
import { FilterChips } from "@/components/FilterChips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inlineMarkdown } from "@/lib/inlineMarkdown";
import { formatEpicId, formatStoryId } from "@/lib/formatIds";
import { isBridgeTitle } from "@/lib/softEmptyCopy";
import {
  currentEpicId,
  currentSliceIndex,
  epicMatchesFilter,
  resolveSliceStories,
  sliceStatus,
  storiesOutsideSlices,
  storyMatchesFilter,
  type TimelineFilter,
} from "@/lib/timeline";
import { cn } from "@/lib/utils";
import { CHIP_TEXT, statusChipClass, statusPillClass } from "@/lib/statusColors";

function storyDotClass(status: StoryStatus): string {
  if (status === "done") return "bg-[hsl(var(--chip-emerald))]";
  if (status === "blocked") return "bg-[hsl(var(--chip-rose))]";
  if (status === "in-progress" || status === "review") return "bg-[hsl(var(--chip-sky))]";
  if (status === "ready-for-dev") return "bg-[hsl(var(--chip-teal))]";
  return "bg-muted-foreground/40";
}

function epicRailClass(status: "done" | "in-progress" | "backlog"): string {
  if (status === "done") return "border-[hsl(var(--chip-emerald))] bg-[hsl(var(--chip-emerald))]";
  if (status === "in-progress") return "border-[hsl(var(--chip-sky))] bg-[hsl(var(--chip-sky))]";
  return "border-muted-foreground/40 bg-background";
}

function StoryNode({ story, moduleScope }: { story: StoryRecord; moduleScope: string }) {
  return (
    <li className="process-story">
      <span className={cn("process-story-dot", storyDotClass(story.status))} />
      <Link to={`/stories/${story.id}`} className="process-story-link">
        <span className="font-mono text-heading">{formatStoryId(story)}</span>
        <span className="min-w-0 truncate">{inlineMarkdown(story.title)}</span>
      </Link>
      <ModuleLabelChip moduleScope={moduleScope} moduleLabel={story.moduleLabel} />
      <StatusBadge status={story.status} />
    </li>
  );
}

function EpicMilestone({
  epic,
  stories,
  isCurrent,
  defaultOpen,
  moduleScope,
}: {
  epic: EpicRecord;
  stories: StoryRecord[];
  isCurrent: boolean;
  defaultOpen: boolean;
  moduleScope: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();

  return (
    <article id={epic.id} className={cn("process-milestone", isCurrent && "process-milestone-current")}>
      <div className={cn("process-rail-node", epicRailClass(epic.status))} />
      <div className="process-milestone-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 font-sans text-base font-semibold">
                <Link to={`/epics/${epic.id}`} className="hover:text-heading">
                  Epic {formatEpicId(epic)} — {inlineMarkdown(epic.title)}
                </Link>
              </h2>
              <StatusBadge status={epic.status} />
              {isBridgeTitle(epic.title) && (
                <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                  Historical
                </Badge>
              )}
              <ModuleLabelChip moduleScope={moduleScope} moduleLabel={epic.moduleLabel} />
              {isCurrent && (
                <Badge variant="outline" className={statusChipClass("active")}>
                  Current frontier
                </Badge>
              )}
              {epic.isEnabler && (
                <Badge variant="outline" className="text-[0.65rem]">
                  Enabler
                </Badge>
              )}
            </div>
            {epic.goal && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{epic.goal}</p>}
          </div>
          <div className="w-44 shrink-0">
            <EpicProgressLine storyCounts={epic.storyCounts} compact />
          </div>
        </div>

        {stories.length > 0 && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide" : "Show"} {stories.length} stor{stories.length === 1 ? "y" : "ies"}
            </Button>
            {open && (
              <ul id={listId} className="process-story-list mt-2">
                {stories.map((s) => (
                  <StoryNode key={s.id} story={s} moduleScope={moduleScope} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function SliceMilestone({
  index,
  slice,
  allStories,
  visibleStories,
  missingIds,
  isCurrent,
  moduleScope,
}: {
  index: number;
  slice: DeliverySlice;
  allStories: StoryRecord[];
  visibleStories: StoryRecord[];
  missingIds: string[];
  isCurrent: boolean;
  moduleScope: string;
}) {
  const status = sliceStatus(allStories);
  const done = allStories.filter((s) => s.status === "done").length;
  const pct = allStories.length ? Math.round((done / allStories.length) * 100) : 0;

  return (
    <article className={cn("process-milestone", isCurrent && "process-milestone-current")}>
      <div className={cn("process-rail-node", epicRailClass(status))} />
      <div className="process-milestone-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 font-sans text-base font-semibold text-foreground">
                Slice {index + 1}: {inlineMarkdown(slice.name)}
              </h2>
              <StatusBadge status={status} />
              {isCurrent && (
                <Badge variant="outline" className={statusChipClass("active")}>
                  Current frontier
                </Badge>
              )}
            </div>
            {missingIds.length > 0 && (
              <p className={cn("mt-1 text-xs", CHIP_TEXT.amber)}>
                {missingIds.length} unresolved story id
                {missingIds.length === 1 ? "" : "s"}: {missingIds.join(", ")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allStories.map((s) => (
                <Link key={s.id} to={`/stories/${s.id}`} className={statusPillClass(s.status)}>
                  {formatStoryId(s)}
                  {s.status === "done" ? " ✓" : ""}
                </Link>
              ))}
            </div>
          </div>
          <div className="w-36 shrink-0">
            <ProgressBar pct={pct} />
            <p className="mt-1 text-right text-[0.7rem] tabular-nums text-muted-foreground">
              {done}/{allStories.length} stories
            </p>
          </div>
        </div>
        {visibleStories.length > 0 && (
          <ul className="process-story-list mt-3">
            {visibleStories.map((s) => (
              <StoryNode key={s.id} story={s} moduleScope={moduleScope} />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function DeliveryTimelineView({
  epics,
  stories,
  deliverySlices,
  summary,
  moduleScope,
}: {
  epics: EpicRecord[];
  stories: StoryRecord[];
  deliverySlices: DeliverySlice[];
  summary: {
    storyCompletionPct: number;
    epics: Record<"done" | "in-progress" | "backlog", number>;
  };
  moduleScope: string;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const storiesByEpic = useMemo(() => {
    const map = new Map<string, StoryRecord[]>();
    for (const s of stories) {
      const list = map.get(s.epicId) ?? [];
      list.push(s);
      map.set(s.epicId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.number - b.number);
    }
    return map;
  }, [stories]);

  const storyMap = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  const frontierEpicId = currentEpicId(epics);
  const frontierSliceIndex = currentSliceIndex(deliverySlices, storyMap);
  const filteredEpics = epics.filter((e) => epicMatchesFilter(e, filter));

  const sliceEntries = deliverySlices
    .map((slice, index) => {
      const { stories: allStories, missingIds } = resolveSliceStories(slice.storyIds, storyMap);
      const visibleStories = allStories.filter((s) => storyMatchesFilter(s, filter));
      return {
        slice,
        index,
        allStories,
        visibleStories,
        missingIds,
        status: sliceStatus(allStories),
      };
    })
    .filter((entry) => {
      if (filter === "all") return true;
      if (filter === "done") return entry.status === "done";
      if (filter === "active") return entry.status === "in-progress";
      return entry.status !== "done";
    });

  const orphanStories = storiesOutsideSlices(stories, deliverySlices).filter((s) => storyMatchesFilter(s, filter));

  return (
    <div>
      <Card className="mb-6 border-border/60 bg-card/50">
        <CardContent className="flex flex-wrap items-center gap-4 pt-5 text-sm">
          <span>
            <span className="tabular-nums font-semibold text-foreground">{summary.storyCompletionPct}%</span>{" "}
            <span className="text-muted-foreground">stories complete</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">
            {summary.epics.done} epics done · {summary.epics["in-progress"]} active · {summary.epics.backlog} ahead
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{deliverySlices.length} delivery slices</span>
        </CardContent>
      </Card>

      <FilterChips
        className="mb-4"
        ariaLabel="Timeline status filter"
        value={filter}
        onChange={setFilter}
        options={[
          { id: "all", label: "All", colorKey: "all" },
          { id: "active", label: "Active", colorKey: "active" },
          { id: "remaining", label: "Not done", colorKey: "remaining" },
          { id: "done", label: "Done", colorKey: "done" },
        ]}
      />

      <Tabs defaultValue="epics">
        <TabsList>
          <TabsTrigger value="epics">By epic</TabsTrigger>
          <TabsTrigger value="slices">By delivery slice</TabsTrigger>
        </TabsList>

        <TabsContent value="epics">
          {filteredEpics.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No epics match this filter.</p>
          ) : (
            <div className="process-timeline">
              {filteredEpics.map((epic) => {
                const epicStories = (storiesByEpic.get(epic.id) ?? []).filter((s) => storyMatchesFilter(s, filter));
                return (
                  <EpicMilestone
                    key={`${filter}-${epic.id}`}
                    epic={epic}
                    stories={epicStories}
                    isCurrent={epic.id === frontierEpicId}
                    defaultOpen={epic.status === "in-progress"}
                    moduleScope={moduleScope}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="slices">
          {sliceEntries.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No delivery slices match this filter.</p>
          ) : (
            <div className="process-timeline">
              {sliceEntries.map((entry) => (
                <SliceMilestone
                  key={entry.index}
                  index={entry.index}
                  slice={entry.slice}
                  allStories={entry.allStories}
                  visibleStories={entry.visibleStories}
                  missingIds={entry.missingIds}
                  isCurrent={entry.index === frontierSliceIndex}
                  moduleScope={moduleScope}
                />
              ))}
            </div>
          )}

          {orphanStories.length > 0 && (
            <Card className="mt-6 border-border/60 bg-card/50">
              <CardContent className="pt-5">
                <h2 className="m-0 mb-1 font-sans text-base font-semibold">Outside delivery slices</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Stories in the epic sequence that are not listed in any recommended delivery slice.
                </p>
                <ul className="process-story-list border-t-0 pt-0">
                  {orphanStories.map((s) => (
                    <StoryNode key={s.id} story={s} moduleScope={moduleScope} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
