import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { EpicRecord, EpicStatus, StoryRecord, StoryStatus } from "@/api/client";
import { DeliveryTimelineView } from "@/components/DeliveryTimelineView";
import { EpicLink } from "@/components/EntityLink";
import { FilterChips } from "@/components/FilterChips";
import { ModuleLabelChip } from "@/components/ModuleLabelChip";
import { SoftEmptyBanner } from "@/components/SoftEmptyBanner";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { EpicProgressLine, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/context/DashboardContext";
import {
  applyDeliveryFilterParams,
  DELIVERY_SEARCH_PARAM,
  DELIVERY_STATUS_PARAM,
  DELIVERY_VIEW_PARAM,
  parseDeliverySearchParam,
  parseDeliveryStatusParam,
  parseDeliveryViewParam,
  type DeliveryStatusFilter,
  type DeliveryView,
} from "@/lib/deliveryFilterParams";
import { bareStoryId, formatEpicId, formatStoryId } from "@/lib/formatIds";
import { inlineMarkdown, stripInlineMarkdown } from "@/lib/inlineMarkdown";
import { isBridgeTitle } from "@/lib/softEmptyCopy";
import { cn } from "@/lib/utils";
import { epicStatusTextClass, storyStatusTextClass } from "@/lib/statusColors";
import { Badge } from "@/components/ui/badge";

const STORY_COLUMNS: StoryStatus[] = ["backlog", "ready-for-dev", "in-progress", "review", "blocked", "done"];

const EPIC_COLUMNS: EpicStatus[] = ["backlog", "in-progress", "done"];

const EPIC_COLUMN_LABEL: Record<EpicStatus, string> = {
  backlog: "Future",
  "in-progress": "In progress",
  done: "Complete",
};

type GroupBy = "epic" | "story";

function storyMatchesSearch(story: StoryRecord, q: string): boolean {
  return (
    stripInlineMarkdown(story.title).toLowerCase().includes(q) ||
    story.id.includes(q) ||
    formatStoryId(story).toLowerCase().includes(q) ||
    bareStoryId(story).includes(q) ||
    String(story.epicNumber).includes(q)
  );
}

function BridgeHistoricalBadge({ title }: { title: string }) {
  if (!isBridgeTitle(title)) return null;
  return (
    <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
      Historical
    </Badge>
  );
}

function StoryCard({ story, compact = false, moduleScope }: { story: StoryRecord; compact?: boolean; moduleScope: string }) {
  return (
    <Link to={`/stories/${story.id}`}>
      <Card
        className={cn(
          "border-border/50 bg-background/40 transition-colors hover:border-primary/40",
          story.status === "blocked" && "border-[hsl(var(--chip-rose)/0.3)]"
        )}
      >
        <CardContent className={cn(compact ? "p-2" : "p-2.5")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="font-mono text-xs text-heading">{formatStoryId(story)}</div>
            <ModuleLabelChip moduleScope={moduleScope} moduleLabel={story.moduleLabel} />
          </div>
          <div className="mt-0.5 text-xs leading-snug">
            {inlineMarkdown(story.title.length > (compact ? 50 : 60) ? `${story.title.slice(0, compact ? 50 : 60)}…` : story.title)}
          </div>
          {!compact && (
            <div className="mt-1.5">
              <StatusBadge status={story.status} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function EpicBoardCard({
  epic,
  stories,
  expanded,
  onToggle,
  moduleScope,
}: {
  epic: EpicRecord;
  stories: StoryRecord[];
  expanded: boolean;
  onToggle: () => void;
  moduleScope: string;
}) {
  return (
    <Card className="border-border/50 bg-background/40">
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full px-3 py-2.5 text-left transition-colors hover:bg-accent/30"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <EpicLink epicId={epic.id} className="font-mono text-xs text-heading" onClick={(e) => e.stopPropagation()}>
                  Epic {formatEpicId(epic)}
                </EpicLink>
                <ModuleLabelChip moduleScope={moduleScope} moduleLabel={epic.moduleLabel} />
                <StatusBadge status={epic.status} />
                <BridgeHistoricalBadge title={epic.title} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground" title={stripInlineMarkdown(epic.title)}>
                {stripInlineMarkdown(epic.title)}
              </p>
              <EpicProgressLine storyCounts={epic.storyCounts} className="mt-2" />
            </div>
            <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </button>
        {expanded && stories.length > 0 && (
          <div className="space-y-2 border-t border-border/50 p-2">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} compact moduleScope={moduleScope} />
            ))}
          </div>
        )}
        {expanded && stories.length === 0 && (
          <p className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">No stories match the current filters.</p>
        )}
      </CardContent>
    </Card>
  );
}

function EpicTableGroup({
  epic,
  stories,
  expanded,
  onToggle,
  moduleScope,
}: {
  epic: EpicRecord;
  stories: StoryRecord[];
  expanded: boolean;
  onToggle: () => void;
  moduleScope: string;
}) {
  return (
    <>
      <TableRow className="bg-card/40 hover:bg-card/60">
        <TableCell className="w-10">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse epic" : "Expand epic"}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            onClick={onToggle}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        </TableCell>
        <TableCell className="font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link to={`/epics/${epic.id}`} className="hover:underline">
              Epic {formatEpicId(epic)}
            </Link>
            <ModuleLabelChip moduleScope={moduleScope} moduleLabel={epic.moduleLabel} />
          </div>
        </TableCell>
        <TableCell colSpan={2}>
          <div className="flex flex-wrap items-center gap-1.5">
            {inlineMarkdown(epic.title)}
            <BridgeHistoricalBadge title={epic.title} />
          </div>
        </TableCell>
        <TableCell>
          <StatusBadge status={epic.status} />
        </TableCell>
        <TableCell>
          <EpicProgressLine storyCounts={epic.storyCounts} compact className="min-w-[9rem]" />
        </TableCell>
      </TableRow>
      {expanded &&
        stories.map((s) => (
          <TableRow key={s.id} className={cn("bg-muted/20", s.status === "blocked" && "bg-[hsl(var(--chip-rose)/0.05)]")}>
            <TableCell />
            <TableCell className="font-mono pl-6">
              <Link to={`/stories/${s.id}`}>{formatStoryId(s)}</Link>
            </TableCell>
            <TableCell colSpan={2} className="pl-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {inlineMarkdown(s.title)}
                <ModuleLabelChip moduleScope={moduleScope} moduleLabel={s.moduleLabel} />
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge status={s.status} />
            </TableCell>
            <TableCell />
          </TableRow>
        ))}
    </>
  );
}

export function DeliveryPage() {
  const { data, loading, error, reload, moduleScope } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseDeliveryViewParam(searchParams.get(DELIVERY_VIEW_PARAM));
  const statusFilter = parseDeliveryStatusParam(searchParams.get(DELIVERY_STATUS_PARAM));
  const search = parseDeliverySearchParam(searchParams.get(DELIVERY_SEARCH_PARAM));

  const [groupBy, setGroupBy] = useState<GroupBy>("story");
  const [hideEnabler, setHideEnabler] = useState(false);
  const [hideEmptyColumns, setHideEmptyColumns] = useState(true);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(() => new Set());

  const setView = (next: DeliveryView) => {
    const params = new URLSearchParams(searchParams);
    if (next === "kanban") params.delete(DELIVERY_VIEW_PARAM);
    else params.set(DELIVERY_VIEW_PARAM, next);
    setSearchParams(params, { replace: true });
  };

  const setStatusFilter = (next: DeliveryStatusFilter) => {
    setSearchParams(applyDeliveryFilterParams(searchParams, { status: next }), {
      replace: true,
    });
  };

  const setSearch = (next: string) => {
    setSearchParams(applyDeliveryFilterParams(searchParams, { q: next }), {
      replace: true,
    });
  };

  const toggleEpic = (epicId: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  };

  const epics = useMemo(() => {
    if (!data) return [];
    return data.epics.filter((e) => !(hideEnabler && e.isEnabler));
  }, [data, hideEnabler]);

  const storiesByEpic = useMemo(() => {
    const map = new Map<string, StoryRecord[]>();
    if (!data) return map;
    for (const s of data.stories) {
      if (hideEnabler) {
        const epic = data.epics.find((e) => e.id === s.epicId);
        if (epic?.isEnabler) continue;
      }
      const list = map.get(s.epicId) ?? [];
      list.push(s);
      map.set(s.epicId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.number - b.number);
    }
    return map;
  }, [data, hideEnabler]);

  const stories = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.stories.filter((s) => {
      if (hideEnabler) {
        const epic = data.epics.find((e) => e.id === s.epicId);
        if (epic?.isEnabler) return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q && !storyMatchesSearch(s, q)) return false;
      return true;
    });
  }, [data, statusFilter, search, hideEnabler]);

  const filteredEpics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return epics.filter((e) => {
      if (!q) return true;
      if (e.title.toLowerCase().includes(q) || String(e.number).includes(q)) return true;
      const epicStories = storiesByEpic.get(e.id) ?? [];
      return epicStories.some((s) => storyMatchesSearch(s, q));
    });
  }, [epics, search, storiesByEpic]);

  const epicStoriesFor = (epicId: string) => {
    const q = search.trim().toLowerCase();
    return (storiesByEpic.get(epicId) ?? []).filter((s) => !q || storyMatchesSearch(s, q));
  };

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Epics & Stories" />
        <PageLoading label="Loading dashboard data…" />
      </>
    );
  }
  if (error && !data) {
    return (
      <>
        <PageHeader title="Epics & Stories" />
        <PageError message={error} onRetry={reload} />
      </>
    );
  }
  if (!data) return <PageError message="Failed to load dashboard" onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Epics & Stories" description="Kanban, table, and process timeline — delivery slices and planning frontier included" />

      {data.epics.length === 0 && <SoftEmptyBanner kind="delivery-epics" />}

      <FilterChips
        className="mb-4"
        ariaLabel="Delivery view"
        value={view}
        onChange={setView}
        options={[
          { id: "kanban", label: "Kanban", colorKey: "kanban" },
          { id: "table", label: "Table", colorKey: "table" },
          { id: "timeline", label: "Timeline", colorKey: "timeline" },
        ]}
      />

      {view === "timeline" ? (
        <DeliveryTimelineView
          epics={data.epics}
          stories={data.stories}
          deliverySlices={data.deliverySlices}
          summary={data.summary}
          moduleScope={moduleScope}
        />
      ) : (
        <>
          <FilterChips
            className="mb-4"
            ariaLabel="Group by"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { id: "story", label: "View by stories", colorKey: "kanban" },
              { id: "epic", label: "View by epic", colorKey: "table" },
            ]}
          />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder={groupBy === "epic" ? "Search epics or stories…" : "Search stories…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <Button variant={hideEnabler ? "default" : "outline"} size="sm" onClick={() => setHideEnabler((v) => !v)}>
              {hideEnabler ? "Show Epic 0" : "Hide Epic 0"}
            </Button>
            {view === "kanban" && (
              <Button variant={hideEmptyColumns ? "default" : "outline"} size="sm" onClick={() => setHideEmptyColumns((v) => !v)}>
                {hideEmptyColumns ? "Show empty columns" : "Hide empty columns"}
              </Button>
            )}
          </div>

          {groupBy === "story" && (
            <FilterChips
              className="mb-4"
              ariaLabel="Story status filter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: "all", label: "All statuses", colorKey: "all" },
                ...STORY_COLUMNS.map((s) => ({
                  id: s,
                  label: s.replace(/-/g, " "),
                  colorKey: s,
                })),
              ]}
            />
          )}

          <p className="mb-4 text-sm text-muted-foreground">
            {groupBy === "epic"
              ? `${filteredEpics.length} epic${filteredEpics.length === 1 ? "" : "s"}`
              : `${stories.length} stor${stories.length === 1 ? "y" : "ies"}${
                  data.stories.length !== stories.length ? ` of ${data.stories.length}` : ""
                }`}
          </p>

          {view === "kanban" && groupBy === "story" && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STORY_COLUMNS.filter((col) => {
                if (!hideEmptyColumns) return true;
                return stories.some((s) => s.status === col);
              }).map((col) => (
                <div key={col} className="min-w-[170px] flex-1 rounded-xl border border-border/60 bg-card/40">
                  <div
                    className={cn("border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider", storyStatusTextClass(col))}
                  >
                    {col.replace(/-/g, " ")} ({stories.filter((s) => s.status === col).length})
                  </div>
                  <div className="space-y-2 p-2">
                    {stories
                      .filter((s) => s.status === col)
                      .map((s) => (
                        <StoryCard key={s.id} story={s} moduleScope={moduleScope} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "kanban" && groupBy === "epic" && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {EPIC_COLUMNS.filter((col) => {
                if (!hideEmptyColumns) return true;
                return filteredEpics.some((e) => e.status === col);
              }).map((col) => {
                const columnEpics = filteredEpics.filter((e) => e.status === col);
                return (
                  <div key={col} className="min-w-[220px] flex-1 rounded-xl border border-border/60 bg-card/40">
                    <div
                      className={cn("border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider", epicStatusTextClass(col))}
                    >
                      {EPIC_COLUMN_LABEL[col]} ({columnEpics.length})
                    </div>
                    <div className="space-y-2 p-2">
                      {columnEpics.map((epic) => (
                        <EpicBoardCard
                          key={epic.id}
                          epic={epic}
                          stories={epicStoriesFor(epic.id)}
                          expanded={expandedEpics.has(epic.id)}
                          onToggle={() => toggleEpic(epic.id)}
                          moduleScope={moduleScope}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "table" && groupBy === "story" && (
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Epic</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stories.map((s, index) => (
                      <TableRow key={s.id} className={cn(s.status === "blocked" && "bg-rose-500/5")}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-mono">
                          <Link to={`/stories/${s.id}`}>{formatStoryId(s)}</Link>
                        </TableCell>
                        <TableCell>
                          <Link to={`/epics/${s.epicId}`} className="hover:underline">
                            {s.code ? s.code.replace(/\.\d+$/, "") : s.epicNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {inlineMarkdown(s.title)}
                            <ModuleLabelChip moduleScope={moduleScope} moduleLabel={s.moduleLabel} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {view === "table" && groupBy === "epic" && (
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Epic</TableHead>
                      <TableHead colSpan={2}>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEpics.map((epic) => (
                      <EpicTableGroup
                        key={epic.id}
                        epic={epic}
                        stories={epicStoriesFor(epic.id)}
                        expanded={expandedEpics.has(epic.id)}
                        onToggle={() => toggleEpic(epic.id)}
                        moduleScope={moduleScope}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
