import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, Layers } from "lucide-react";
import type { FeatureRecord, StoryRecord } from "@/api/client";
import { FilterChips } from "@/components/FilterChips";
import { ModuleLabelChip } from "@/components/ModuleLabelChip";
import { SoftEmptyBanner } from "@/components/SoftEmptyBanner";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/context/DashboardContext";
import { formatEpicId } from "@/lib/formatIds";
import {
  areaHealthTitle,
  deliveryStatusBadgeVariant,
  deliveryStatusLabel,
  deriveFeatureDeliveryStatus,
  featureHasDeferred,
  featureMatchesStatusFilter,
  summarizeAreaStatus,
  type AreaHealth,
  type AreaStatusSummary,
  type FeatureStatusFilter,
} from "@/lib/featureStatus";
import { cn } from "@/lib/utils";
import { inlineMarkdown } from "@/lib/inlineMarkdown";
import {
  applyFeatureFilterParams,
  FEATURE_SEARCH_PARAM,
  FEATURE_STATUS_PARAM,
  parseFeatureSearchParam,
  parseFeatureStatusParam,
} from "@/lib/featuresFilterParams";
import { featuresLocation } from "@/lib/featuresLocation";
import {
  areaFilterKey,
  featureMatchesAreaFilter,
  groupFeaturesByArea,
  groupFeaturesByModuleThenArea,
  shouldNestFeaturesByModule,
  type AreaGroup,
} from "@/lib/featuresAreaGroups";
import { featuresProjectAreasScrollClassName } from "@/lib/featuresPanelDensity";

function featureMatches(feature: FeatureRecord, q: string): boolean {
  if (!q) return true;
  const haystack = [feature.id, feature.name, feature.goal ?? "", feature.area, feature.status, ...feature.screens, ...feature.includes]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function functionalityMatches(item: string, q: string): boolean {
  if (!q) return true;
  return item.toLowerCase().includes(q);
}

function matchingFunctionalities(feature: FeatureRecord, q: string): string[] {
  if (!q) return feature.includes;
  return feature.includes.filter((item) => functionalityMatches(item, q));
}

const STATUS_FILTERS: { id: FeatureStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "complete", label: "Complete" },
  { id: "in-progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "confirmed", label: "In flight" },
  { id: "pending", label: "Pending" },
  { id: "deferred", label: "Has deferred" },
];

function areaHealthDotClass(health: AreaHealth): string {
  switch (health) {
    case "all-complete":
      return "bg-emerald-500";
    case "in-progress":
      return "bg-sky-500";
    case "blocked":
      return "bg-rose-500";
    case "confirmed":
      return "bg-teal-500";
    case "mixed":
      return "bg-amber-500";
  }
}

function AreaHealthIndicator({ summary }: { summary: AreaStatusSummary }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={areaHealthTitle(summary)} aria-label={areaHealthTitle(summary)}>
      <span className={cn("h-2 w-2 rounded-full", areaHealthDotClass(summary.health))} />
      {(summary.inProgress > 0 || summary.blocked > 0 || summary.confirmed > 0) && (
        <span className="hidden font-mono text-[0.6rem] leading-none text-muted-foreground xl:inline">
          {summary.complete > 0 ? `${summary.complete}✓` : null}
          {summary.inProgress > 0 ? ` ${summary.inProgress}↻` : null}
          {summary.blocked > 0 ? ` ${summary.blocked}!` : null}
        </span>
      )}
    </span>
  );
}

function linkedFeatureIds(text: string): string[] {
  return [...text.matchAll(/\bF-\d+\b/g)].map((m) => m[0]);
}

function SeeAlsoItem({ text }: { text: string }) {
  const location = useLocation();
  const ids = linkedFeatureIds(text);
  if (ids.length === 0) {
    return <span>{inlineMarkdown(text)}</span>;
  }

  // Split on feature IDs so each becomes a deep link.
  const parts = text.split(/\b(F-\d+)\b/);
  return (
    <span>
      {parts.map((part, i) =>
        /^F-\d+$/.test(part) ? (
          <Link
            key={`${part}-${i}`}
            to={featuresLocation(part, location.search)}
            className="font-mono text-heading hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        ) : (
          <span key={i}>{inlineMarkdown(part)}</span>
        )
      )}
    </span>
  );
}

function FeatureCard({
  feature,
  expanded,
  onToggle,
  stories,
  searchQuery,
  statusFilter,
  moduleScope,
}: {
  feature: FeatureRecord;
  expanded: boolean;
  onToggle: () => void;
  stories: StoryRecord[];
  searchQuery: string;
  statusFilter: FeatureStatusFilter;
  moduleScope: string;
}) {
  const location = useLocation();
  const { data: dash } = useDashboard();
  const epic = dash?.epics.find((e) => e.id === feature.epicId);
  const epicLabel = epic ? formatEpicId(epic) : feature.epicId.replace(/^epic-/, "");
  const done = stories.filter((s) => s.status === "done").length;
  const total = stories.length;
  const deliveryStatus = deriveFeatureDeliveryStatus(feature, stories);
  const q = searchQuery.trim().toLowerCase();
  const visibleIncludes = matchingFunctionalities(feature, q);
  const searching = q.length > 0;
  const deferredOnly = statusFilter === "deferred";
  // While searching, force the details open so matching functionalities are visible.
  const showDetails = expanded || (deferredOnly && feature.deferred.length > 0) || (searching && !deferredOnly && visibleIncludes.length > 0);

  return (
    <article
      id={feature.id}
      className={cn(
        "scroll-mt-24 rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-border",
        showDetails && "border-primary/35 bg-card/70"
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3.5 text-left" aria-expanded={showDetails}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-heading">{feature.id}</span>
            <ModuleLabelChip moduleScope={moduleScope} moduleLabel={feature.moduleLabel} />
            <Badge variant={deliveryStatusBadgeVariant(deliveryStatus)}>{deliveryStatusLabel(deliveryStatus)}</Badge>
            {featureHasDeferred(feature) && (
              <Badge variant="outline" className="text-[0.65rem]">
                Deferred items
              </Badge>
            )}
            {total > 0 && (
              <span className="text-xs text-muted-foreground">
                {done}/{total} stories done
              </span>
            )}
            {searching && !deferredOnly && feature.includes.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {visibleIncludes.length}/{feature.includes.length} functionalities
              </span>
            )}
          </div>
          <h3 className="mt-1 font-sans text-base font-semibold text-foreground">{inlineMarkdown(feature.name)}</h3>
          {feature.goal && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{feature.goal}</p>}
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", showDetails && "rotate-180")} />
      </button>

      {showDetails && (
        <div className="space-y-4 border-t border-border/50 px-4 py-4">
          {!deferredOnly && visibleIncludes.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Main functionalities
                {searching && feature.includes.length !== visibleIncludes.length ? ` (${visibleIncludes.length} matching)` : ""}
              </h4>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {visibleIncludes.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-sm text-foreground/90 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-heading/70 before:content-['']"
                  >
                    <span>{inlineMarkdown(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!deferredOnly && searching && feature.includes.length > 0 && visibleIncludes.length === 0 && (
            <p className="text-sm text-muted-foreground">No functionalities match “{searchQuery.trim()}”.</p>
          )}

          {!deferredOnly && !searching && feature.seeAlso.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Defined in related features</h4>
              <ul className="space-y-1.5">
                {feature.seeAlso.map((item) => (
                  <li key={item} className="text-sm text-foreground/85">
                    · <SeeAlsoItem text={item} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feature.deferred.length > 0 && (deferredOnly || !searching) && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deferred (not in current scope)</h4>
              <ul className="space-y-1">
                {feature.deferred.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    · {inlineMarkdown(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {feature.screens.map((screen) => (
              <Badge key={screen} variant="outline" className="font-mono text-[0.65rem]">
                {screen}
              </Badge>
            ))}
            <Link
              to={{ pathname: `/epics/${feature.epicId}`, search: location.search }}
              className="ml-auto text-sm text-heading hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View Epic {epicLabel} & stories →
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

export function FeaturesPage() {
  const { data, loading, error, moduleScope, modules } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseFeatureStatusParam(searchParams.get(FEATURE_STATUS_PARAM));
  const search = parseFeatureSearchParam(searchParams.get(FEATURE_SEARCH_PARAM));
  const [activeArea, setActiveArea] = useState<string | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Sidebar + main: module ids that are collapsed (absent = expanded). */
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set());

  const nestByModule = shouldNestFeaturesByModule(modules, moduleScope);
  const hashFeatureId = location.hash.replace(/^#/, "");

  const toggleModuleCollapsed = (moduleId: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const setStatusFilter = (next: FeatureStatusFilter) => {
    setSearchParams(applyFeatureFilterParams(searchParams, { status: next }), {
      replace: true,
    });
  };

  const setSearch = (next: string) => {
    setSearchParams(applyFeatureFilterParams(searchParams, { q: next }), {
      replace: true,
    });
  };

  useEffect(() => {
    if (!hashFeatureId || !data) return;
    const feature = data.features.find((f) => f.id === hashFeatureId);
    if (!feature) return;
    setExpandedId(feature.id);
    setActiveArea(nestByModule ? areaFilterKey(feature.moduleId, feature.areaId) : feature.areaId);
    requestAnimationFrame(() => {
      document.getElementById(feature.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hashFeatureId, data, nestByModule]);

  const searchQuery = search.trim().toLowerCase();

  const storiesByEpic = useMemo(() => {
    const map = new Map<string, StoryRecord[]>();
    if (!data) return map;
    for (const s of data.stories) {
      const list = map.get(s.epicId) ?? [];
      list.push(s);
      map.set(s.epicId, list);
    }
    return map;
  }, [data]);

  const searchMatchedFeatures = useMemo(() => {
    if (!data) return [];
    return data.features.filter((f) => featureMatches(f, searchQuery));
  }, [data, searchQuery]);

  const statusMatchedFeatures = useMemo(() => {
    return searchMatchedFeatures.filter((f) => featureMatchesStatusFilter(f, storiesByEpic.get(f.epicId) ?? [], statusFilter));
  }, [searchMatchedFeatures, statusFilter, storiesByEpic]);

  const filtered = useMemo(() => {
    return statusMatchedFeatures.filter((f) => featureMatchesAreaFilter(f, activeArea, nestByModule));
  }, [statusMatchedFeatures, activeArea, nestByModule]);

  const areas = useMemo(() => groupFeaturesByArea(statusMatchedFeatures, storiesByEpic), [statusMatchedFeatures, storiesByEpic]);

  const moduleGroups = useMemo(
    () => (nestByModule ? groupFeaturesByModuleThenArea(statusMatchedFeatures, modules, storiesByEpic) : []),
    [nestByModule, statusMatchedFeatures, modules, storiesByEpic]
  );

  useEffect(() => {
    if (activeArea === "all") return;
    if (nestByModule) {
      const stillVisible = moduleGroups.some((mod) => mod.areas.some((area) => areaFilterKey(mod.moduleId, area.id) === activeArea));
      if (!stillVisible) setActiveArea("all");
      return;
    }
    const stillVisible = areas.some((area) => area.id === activeArea);
    if (!stillVisible) setActiveArea("all");
  }, [activeArea, areas, nestByModule, moduleGroups]);

  const grouped = useMemo(() => groupFeaturesByArea(filtered, storiesByEpic), [filtered, storiesByEpic]);

  const groupedModules = useMemo(
    () =>
      nestByModule
        ? groupFeaturesByModuleThenArea(filtered, modules, storiesByEpic).filter((mod) => activeArea === "all" || mod.featureCount > 0)
        : [],
    [nestByModule, filtered, modules, storiesByEpic, activeArea]
  );

  const allAreasStatus = useMemo(() => summarizeAreaStatus(statusMatchedFeatures, storiesByEpic), [statusMatchedFeatures, storiesByEpic]);

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error ?? "Failed to load"} />;

  const toggleFeature = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    navigate(featuresLocation(next, location.search), { replace: true });
  };

  return (
    <div>
      <PageHeader title="Features" description="Project breakdown — browse by area when a feature registry is configured." />

      {data.features.length === 0 && <SoftEmptyBanner kind="feature-registry" />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search features, goals, or capabilities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md"
        />
        <p className="text-sm text-muted-foreground">
          {filtered.length} feature{filtered.length === 1 ? "" : "s"}
          {filtered.length !== data.features.length ? ` of ${data.features.length}` : ""}
        </p>
      </div>

      <FilterChips
        className="mb-5"
        ariaLabel="Feature status filter"
        value={statusFilter}
        onChange={setStatusFilter}
        options={STATUS_FILTERS.map((f) => ({
          id: f.id,
          label: f.label,
          colorKey: f.id,
        }))}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-4 lg:w-56 lg:shrink-0">
          <div className="rounded-xl border border-border/60 bg-card/30 p-2">
            <p className="px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Project areas</p>
            <div className={featuresProjectAreasScrollClassName()}>
              <Button
                variant={activeArea === "all" ? "default" : "ghost"}
                size="sm"
                className="mb-0.5 w-full justify-between gap-2 font-normal"
                onClick={() => setActiveArea("all")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AreaHealthIndicator summary={allAreasStatus} />
                  <span>{nestByModule ? "All modules" : "All areas"}</span>
                </span>
                <span className="shrink-0 font-mono text-xs opacity-70">{statusMatchedFeatures.length}</span>
              </Button>
              {nestByModule
                ? moduleGroups.map((mod) => {
                    const open = !collapsedModules.has(mod.moduleId);
                    return (
                      <div key={mod.moduleId} className="mt-1">
                        <button
                          type="button"
                          onClick={() => toggleModuleCollapsed(mod.moduleId)}
                          className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-heading/80 transition-colors hover:bg-accent/60"
                          aria-expanded={open}
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
                          <span className="min-w-0 flex-1 truncate">{mod.moduleLabel}</span>
                          <span className="shrink-0 font-mono font-normal opacity-70">{mod.featureCount}</span>
                        </button>
                        {open &&
                          (mod.areas.length === 0 ? (
                            <p className="px-3 py-1 text-xs text-muted-foreground">No features</p>
                          ) : (
                            mod.areas.map((area) => {
                              const key = areaFilterKey(mod.moduleId, area.id);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setActiveArea(key)}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                                    activeArea === key
                                      ? "bg-accent/80 font-medium text-foreground"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <AreaHealthIndicator summary={area.status} />
                                    <span className="leading-snug">{area.label}</span>
                                  </span>
                                  <span className="shrink-0 font-mono text-xs opacity-70">{area.count}</span>
                                </button>
                              );
                            })
                          ))}
                      </div>
                    );
                  })
                : areas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setActiveArea(area.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        activeArea === area.id
                          ? "bg-accent/80 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <AreaHealthIndicator summary={area.status} />
                        <span className="leading-snug">{area.label}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs opacity-70">{area.count}</span>
                    </button>
                  ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-8">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No features match your filters.</p>}

          {nestByModule
            ? groupedModules.map((mod) => {
                const open = !collapsedModules.has(mod.moduleId);
                return (
                  <section key={mod.moduleId} id={`module-${mod.moduleId}`} className="scroll-mt-24 space-y-4">
                    <button
                      type="button"
                      onClick={() => toggleModuleCollapsed(mod.moduleId)}
                      className="flex w-full items-start gap-2 border-b border-border/60 pb-2 text-left"
                      aria-expanded={open}
                    >
                      <ChevronDown className={cn("mt-1.5 h-4 w-4 shrink-0 text-heading transition-transform", !open && "-rotate-90")} />
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-2xl leading-tight text-heading">{mod.moduleLabel}</h2>
                        <p className="mt-1 text-xs text-muted-foreground" title={areaHealthTitle(mod.status)}>
                          {mod.featureCount} feature{mod.featureCount === 1 ? "" : "s"}
                          {mod.status.complete > 0 ? ` · ${mod.status.complete} complete` : ""}
                          {mod.status.inProgress > 0 ? ` · ${mod.status.inProgress} in progress` : ""}
                        </p>
                      </div>
                    </button>
                    {open &&
                      (mod.areas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No features in this module.</p>
                      ) : (
                        <div className="space-y-6">
                          {mod.areas.map((area) => (
                            <AreaFeaturesSection
                              key={`${mod.moduleId}::${area.id}`}
                              area={area}
                              sectionId={`area-${mod.moduleId}-${area.id}`}
                              expandedId={expandedId}
                              onToggleFeature={toggleFeature}
                              storiesByEpic={storiesByEpic}
                              searchQuery={search}
                              statusFilter={statusFilter}
                              moduleScope={moduleScope}
                            />
                          ))}
                        </div>
                      ))}
                  </section>
                );
              })
            : grouped.map((area) => (
                <AreaFeaturesSection
                  key={area.id}
                  area={area}
                  sectionId={`area-${area.id}`}
                  expandedId={expandedId}
                  onToggleFeature={toggleFeature}
                  storiesByEpic={storiesByEpic}
                  searchQuery={search}
                  statusFilter={statusFilter}
                  moduleScope={moduleScope}
                />
              ))}
        </div>
      </div>
    </div>
  );
}

function AreaFeaturesSection({
  area,
  sectionId,
  expandedId,
  onToggleFeature,
  storiesByEpic,
  searchQuery,
  statusFilter,
  moduleScope,
}: {
  area: AreaGroup;
  sectionId: string;
  expandedId: string | null;
  onToggleFeature: (id: string) => void;
  storiesByEpic: Map<string, StoryRecord[]>;
  searchQuery: string;
  statusFilter: FeatureStatusFilter;
  moduleScope: string;
}) {
  return (
    <section id={sectionId} className="scroll-mt-24">
      <div className="mb-3 flex items-start gap-2 border-b border-border/60 pb-2">
        <Layers className="mt-0.5 h-4 w-4 text-heading" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl leading-tight">{area.label}</h3>
            <AreaHealthIndicator summary={area.status} />
          </div>
          {area.blurb && <p className="mt-0.5 text-sm text-muted-foreground">{area.blurb}</p>}
          <p className="mt-1 text-xs text-muted-foreground" title={areaHealthTitle(area.status)}>
            {area.features.length} feature{area.features.length === 1 ? "" : "s"}
            {area.status.complete > 0 ? ` · ${area.status.complete} complete` : ""}
            {area.status.inProgress > 0 ? ` · ${area.status.inProgress} in progress` : ""}
            {area.status.blocked > 0 ? ` · ${area.status.blocked} blocked` : ""}
            {area.status.confirmed > 0 ? ` · ${area.status.confirmed} in flight` : ""}
            {area.status.deferred > 0 ? ` · ${area.status.deferred} with deferred items` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {area.features.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            expanded={expandedId === feature.id}
            onToggle={() => onToggleFeature(feature.id)}
            stories={storiesByEpic.get(feature.epicId) ?? []}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            moduleScope={moduleScope}
          />
        ))}
      </div>
    </section>
  );
}
