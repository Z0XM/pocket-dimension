import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, CircleDashed, ExternalLink, Loader2, Minus, Play, RotateCw, Square, Timer, X } from "lucide-react";
import {
  cancelTestRun,
  cancelUiTestRun,
  fetchTestCatalog,
  fetchTestRunCapability,
  fetchUiCaseCatalog,
  fetchUiTestRunCapability,
  startTestRun,
  startUiTestRun,
  subscribeTestRunStream,
  subscribeUiTestRunStream,
  subscribeToReload,
  type TestCaseRecord,
  type TestFileRecord,
  type TestLevel,
  type TestRunScope,
  type TestRunSnapshot,
  type UiCaseCatalog,
  type UiTestCase,
  type UiTestRunCapability,
  type UiTestRunScope,
  type UiTestRunSnapshot,
  type UiTestRunStartBody,
  type VitestCaseRunResult,
  type VitestFileRunResult,
  type VitestRunOutcome,
} from "@/api/client";
import type { UiPlaywrightFormDefaults } from "@/types/dashboard";
import { PageHeader, PageLoading } from "@/components/PageShell";
import { RunLogOutput } from "@/components/RunLogOutput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { dashboardApiBase, pagesTestLevels, uiStorageKey } from "@/lib/runtime-config";
import { areaLabel, layerOf, orderedTestLayers } from "@/lib/testLayers";

function playwrightReportHref(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = dashboardApiBase().replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function PlaywrightReportButton({ href, compact = false }: { href: string | null; compact?: boolean }) {
  if (!href) return null;
  return (
    <Button size="sm" variant="outline" className="gap-1" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer" title="Open Playwright HTML report">
        <ExternalLink className="h-3.5 w-3.5" />
        {compact ? "Report" : "Playwright report"}
      </a>
    </Button>
  );
}

const LEVEL_INFO: Record<TestLevel, { label: string; description: string }> = {
  L1: {
    label: "L1 · Unit",
    description: "Pure logic — formulas, mappers, state rules (Vitest, co-located *.test.ts)",
  },
  L2: {
    label: "L2 · Functional",
    description: "Route/service behavior vs story ACs — fastify.inject, mocks, auth personas",
  },
  L3: {
    label: "L3 · Feature",
    description: "Multi-endpoint suites for a shipped capability (BMAD QA automation)",
  },
  L4: {
    label: "L4 · Flows",
    description: "Chained API journeys via Compenly Flows (dev/staging only)",
  },
  tooling: {
    label: "Tooling",
    description: "Heimdall and parser tests",
  },
};

const LEVEL_VARIANT: Record<TestLevel, "default" | "secondary" | "outline"> = {
  L1: "secondary",
  L2: "default",
  L3: "outline",
  L4: "outline",
  tooling: "secondary",
};

/** Prefer nested describe as the subsection once a file gets large. */
const SUBSECTION_CASE_THRESHOLD = 12;
/** Collapse area sections with this many cases unless searching. */
const AREA_COLLAPSE_THRESHOLD = 40;

type CaseGroup = {
  title: string;
  cases: TestCaseRecord[];
};

type AreaGroup = {
  area: string;
  files: TestFileRecord[];
  caseCount: number;
};

type LayerGroup = {
  layer: string;
  areas: AreaGroup[];
  caseCount: number;
  fileCount: number;
};

type UiPriorityGroup = {
  title: string;
  cases: UiTestCase[];
};

type UiScreenGroup = {
  screenId: string;
  name: string;
  path: string;
  intakeRef?: string;
  cases: UiTestCase[];
};

type UiAreaGroup = {
  area: string;
  screens: UiScreenGroup[];
  caseCount: number;
};

function uiWorkspaceArea(_screenId: string): string {
  return "Screens";
}

function uiCaseMatches(c: UiTestCase, q: string): boolean {
  if (!q) return true;
  return (
    c.id.toLowerCase().includes(q) ||
    c.title.toLowerCase().includes(q) ||
    c.screenId.toLowerCase().includes(q) ||
    (c.frRefs ?? []).some((f) => f.toLowerCase().includes(q)) ||
    (c.featureIds ?? []).some((f) => f.toLowerCase().includes(q)) ||
    (c.status ?? "").toLowerCase().includes(q) ||
    c.priority.toLowerCase().includes(q) ||
    (c.lastRun?.outcome ?? "").toLowerCase().includes(q)
  );
}

function formatRunWhen(runAt: string): string {
  const t = new Date(runAt).getTime();
  if (Number.isNaN(t)) return runAt;
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function LastRunIcon({
  lastRun,
  hasSnapshot,
}: {
  lastRun?: UiTestCase["lastRun"] | VitestCaseRunResult | VitestFileRunResult | null;
  hasSnapshot: boolean;
}) {
  if (!hasSnapshot) return null;

  if (lastRun == null) {
    return (
      <span
        className="inline-flex shrink-0 cursor-help text-muted-foreground"
        title="Not in last run — absent from latest.json results"
        aria-label="Not in last run"
      >
        <CircleDashed className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }

  const outcome = lastRun.outcome as VitestRunOutcome | "timedOut";
  const detail = [
    outcome === "passed" ? "Passed" : outcome === "failed" ? "Failed" : outcome === "timedOut" ? "Timed out" : "Skipped",
    "durationMs" in lastRun && lastRun.durationMs != null ? `${lastRun.durationMs}ms` : null,
    "reason" in lastRun && typeof lastRun.reason === "string" ? lastRun.reason : null,
    "error" in lastRun && typeof lastRun.error === "string" ? lastRun.error : null,
    "passed" in lastRun ? `${lastRun.passed}p / ${lastRun.failed}f / ${lastRun.skipped}s` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (outcome === "passed") {
    return (
      <span className="inline-flex shrink-0 cursor-help text-emerald-400" title={detail} aria-label={detail}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (outcome === "failed" || outcome === "timedOut") {
    const Icon = outcome === "timedOut" ? Timer : X;
    return (
      <span className="inline-flex shrink-0 cursor-help text-rose-400" title={detail} aria-label={detail}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 cursor-help text-muted-foreground" title={detail} aria-label={detail}>
      <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

type RunRollup = { passed: number; failed: number; skipped: number; hasAny: boolean };

function emptyRollup(): RunRollup {
  return { passed: 0, failed: 0, skipped: 0, hasAny: false };
}

function levelRunRollup(files: TestFileRecord[], level: TestLevel): RunRollup {
  const rollup = emptyRollup();
  for (const file of files) {
    if (file.level !== level || !file.lastRun) continue;
    rollup.hasAny = true;
    rollup.passed += file.lastRun.passed;
    rollup.failed += file.lastRun.failed;
    rollup.skipped += file.lastRun.skipped;
  }
  return rollup;
}

/** Aggregate last-run case counts from child files (area / layer headers). */
function filesRunRollup(files: TestFileRecord[]): RunRollup {
  const rollup = emptyRollup();
  for (const file of files) {
    if (!file.lastRun) continue;
    rollup.hasAny = true;
    rollup.passed += file.lastRun.passed;
    rollup.failed += file.lastRun.failed;
    rollup.skipped += file.lastRun.skipped;
  }
  return rollup;
}

function casesRunRollup(cases: Array<{ lastRun?: { outcome: string } | null }>): RunRollup {
  const rollup = emptyRollup();
  for (const c of cases) {
    if (!c.lastRun) continue;
    rollup.hasAny = true;
    if (c.lastRun.outcome === "passed") rollup.passed += 1;
    else if (c.lastRun.outcome === "failed" || c.lastRun.outcome === "timedOut") rollup.failed += 1;
    else rollup.skipped += 1;
  }
  return rollup;
}

function RunRollupBadges({ rollup, hasSnapshot, className }: { rollup: RunRollup; hasSnapshot: boolean; className?: string }) {
  if (!hasSnapshot) return null;
  if (!rollup.hasAny) {
    return (
      <span className={cn("inline-flex shrink-0 cursor-help items-center text-muted-foreground", className)} title="No children in last run overlay">
        <CircleDashed className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 cursor-help items-center gap-1.5 text-[0.65rem] leading-none", className)}
      title={`${rollup.passed} passed · ${rollup.failed} failed · ${rollup.skipped} skipped`}
    >
      <span className="inline-flex items-center gap-0.5 text-emerald-400">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        {rollup.passed}
      </span>
      <span className="inline-flex items-center gap-0.5 text-rose-400">
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        {rollup.failed}
      </span>
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
        {rollup.skipped}
      </span>
    </span>
  );
}

function stopCardHeaderClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function runnableL12Paths(files: TestFileRecord[]): string[] {
  return [...new Set(files.filter((f) => f.level === "L1" || f.level === "L2").map((f) => f.path))].sort((a, b) => a.localeCompare(b));
}

function RollupRunButton({
  paths,
  runBusy,
  onRun,
  title,
  compact = false,
}: {
  paths: string[];
  runBusy: boolean;
  onRun?: (paths: string[]) => void;
  title?: string;
  compact?: boolean;
}) {
  if (!onRun || paths.length === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      className={cn("h-7 shrink-0 text-xs", compact ? "w-7" : "gap-1 px-2")}
      disabled={runBusy}
      title={title ?? `Run ${paths.length} L1/L2 file${paths.length === 1 ? "" : "s"}`}
      onClick={(e) => {
        stopCardHeaderClick(e);
        onRun(paths);
      }}
    >
      <Play className="h-3 w-3" />
      {!compact && "Run"}
    </Button>
  );
}

function SmallRunButton({
  runBusy,
  onRun,
  title,
  disabled,
  compact = false,
}: {
  runBusy: boolean;
  onRun: () => void;
  title: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      className={cn("h-7 shrink-0 text-xs", compact ? "w-7" : "gap-1 px-2")}
      disabled={runBusy || disabled}
      title={title}
      onClick={(e) => {
        stopCardHeaderClick(e);
        onRun();
      }}
    >
      <Play className="h-3 w-3" />
      {!compact && "Run"}
    </Button>
  );
}

const L5_FORM_STORAGE_KEY_SUFFIX = "l5-form";

type L5FormPersisted = {
  baseUrl: string;
  adminEmail: string;
  viewerEmail: string;
};

function loadL5FormPersisted(): L5FormPersisted {
  try {
    const raw = sessionStorage.getItem(uiStorageKey(L5_FORM_STORAGE_KEY_SUFFIX));
    if (!raw) return { baseUrl: "", adminEmail: "", viewerEmail: "" };
    const parsed = JSON.parse(raw) as Partial<L5FormPersisted>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      adminEmail: typeof parsed.adminEmail === "string" ? parsed.adminEmail : "",
      viewerEmail: typeof parsed.viewerEmail === "string" ? parsed.viewerEmail : "",
    };
  } catch {
    return { baseUrl: "", adminEmail: "", viewerEmail: "" };
  }
}

function saveL5FormPersisted(form: L5FormPersisted): void {
  try {
    sessionStorage.setItem(uiStorageKey(L5_FORM_STORAGE_KEY_SUFFIX), JSON.stringify(form));
  } catch {
    /* ignore */
  }
}

function mergeL5FormDefaults(
  current: {
    baseUrl: string;
    adminEmail: string;
    adminPassword: string;
    viewerEmail: string;
    viewerPassword: string;
  },
  defaults?: UiPlaywrightFormDefaults
): typeof current {
  if (!defaults) return current;
  return {
    baseUrl: current.baseUrl || defaults.baseUrl || "",
    adminEmail: current.adminEmail || defaults.adminEmail || "",
    adminPassword: current.adminPassword || defaults.adminPassword || "",
    viewerEmail: current.viewerEmail || defaults.viewerEmail || "",
    viewerPassword: current.viewerPassword || defaults.viewerPassword || "",
  };
}

function groupUiCasesByArea(cases: UiTestCase[], manifests?: Record<string, { name?: string; intakeRef?: string }>): UiAreaGroup[] {
  const byScreen = new Map<string, UiTestCase[]>();
  for (const c of cases) {
    const list = byScreen.get(c.screenId) ?? [];
    list.push(c);
    byScreen.set(c.screenId, list);
  }

  const areaMap = new Map<string, UiScreenGroup[]>();
  for (const [screenId, screenCases] of [...byScreen.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const area = uiWorkspaceArea(screenId);
    const screens = areaMap.get(area) ?? [];
    screens.push({
      screenId,
      name: manifests?.[screenId]?.name ?? screenId,
      path: `docs/validation/ui-expectations/${screenId}.json`,
      intakeRef: manifests?.[screenId]?.intakeRef,
      cases: screenCases.sort((a, b) => a.id.localeCompare(b.id)),
    });
    areaMap.set(area, screens);
  }

  const areaOrder = ["Screens"];

  return [...areaMap.entries()]
    .sort(([a], [b]) => {
      const ia = areaOrder.indexOf(a);
      const ib = areaOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map(([area, screens]) => ({
      area,
      screens,
      caseCount: screens.reduce((n, s) => n + s.cases.length, 0),
    }));
}

function groupUiByPriority(cases: UiTestCase[]): UiPriorityGroup[] {
  const order = ["P0", "P1", "P2"] as const;
  const map = new Map<string, UiTestCase[]>();
  for (const c of cases) {
    const list = map.get(c.priority) ?? [];
    list.push(c);
    map.set(c.priority, list);
  }
  return order.filter((p) => map.has(p)).map((p) => ({ title: p, cases: map.get(p)! }));
}

const EPICS_DOC = "docs/planning/epics/epics.md";
const SCREEN_INVENTORY_DOC = "docs/requirements/SCREEN-INVENTORY.md";

function browsePath(path: string, q?: string): string {
  const params = new URLSearchParams({ path });
  if (q) params.set("q", q);
  return `/browse?${params.toString()}`;
}

function DocRefLinks({ screenId, frRefs, intakeRef }: { screenId: string; frRefs?: string[]; intakeRef?: string }) {
  const scrHref = browsePath(intakeRef || SCREEN_INVENTORY_DOC);
  return (
    <p className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">
      <Link
        to={scrHref}
        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {screenId}
      </Link>
      {frRefs && frRefs.length > 0 && (
        <>
          <span> · </span>
          {frRefs.map((fr, i) => (
            <span key={fr}>
              {i > 0 && <span>, </span>}
              <Link
                to={browsePath(EPICS_DOC, fr)}
                className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {fr}
              </Link>
            </span>
          ))}
        </>
      )}
    </p>
  );
}

function UiCaseList({
  cases,
  intakeRef,
  hasSnapshot,
  canRun,
  runBusy,
  onRunCase,
  playwrightReportUrl,
}: {
  cases: UiTestCase[];
  intakeRef?: string;
  hasSnapshot: boolean;
  canRun?: boolean;
  runBusy?: boolean;
  onRunCase?: (caseId: string) => void;
  playwrightReportUrl?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      {cases.map((c) => (
        <div key={c.id} className="rounded-md border border-border/40 px-2.5 py-2">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[0.65rem]">
              {c.id}
            </Badge>
            <Badge variant="secondary" className="text-[0.65rem]">
              {c.priority}
            </Badge>
            <Badge variant="outline" className="text-[0.65rem]">
              {c.status ?? "defined"}
            </Badge>
            <LastRunIcon lastRun={c.lastRun} hasSnapshot={hasSnapshot} />
            {playwrightReportUrl && (c.lastRun?.outcome === "failed" || c.lastRun?.outcome === "timedOut") && (
              <PlaywrightReportButton href={playwrightReportUrl} compact />
            )}
            {canRun && onRunCase && (
              <div className="ml-auto">
                <SmallRunButton runBusy={Boolean(runBusy)} title={`Run ${c.id}`} onRun={() => onRunCase(c.id)} />
              </div>
            )}
          </div>
          <p className="text-sm text-foreground/90">{c.title}</p>
          <DocRefLinks screenId={c.screenId} frRefs={c.frRefs} intakeRef={intakeRef} />
        </div>
      ))}
    </div>
  );
}

function UiScreenCard({
  screen,
  search,
  defaultOpen,
  hasSnapshot,
  canRun,
  runBusy,
  onRunScreen,
  onRunCase,
  playwrightReportUrl,
}: {
  screen: UiScreenGroup;
  search: string;
  defaultOpen: boolean;
  hasSnapshot: boolean;
  canRun?: boolean;
  runBusy?: boolean;
  onRunScreen?: (screenId: string) => void;
  onRunCase?: (caseId: string) => void;
  playwrightReportUrl?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const q = search.trim().toLowerCase();
  const visible = useMemo(() => (q ? screen.cases.filter((c) => uiCaseMatches(c, q)) : screen.cases), [screen.cases, q]);
  const groups = useMemo(() => groupUiByPriority(visible), [visible]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (q) setOpen(true);
  }, [q]);

  useEffect(() => {
    if (!q) return;
    const next: Record<string, boolean> = {};
    for (const group of groups) next[group.title] = true;
    setOpenGroups((prev) => ({ ...prev, ...next }));
  }, [q, groups]);

  if (visible.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/40">
      <CardHeader className="space-y-0 p-2 pb-1">
        <CollapsibleHeader
          open={open}
          onToggle={() => setOpen((v) => !v)}
          title={
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-sans font-medium">
                  {screen.intakeRef ? (
                    <Link to={browsePath(screen.intakeRef)} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {screen.name}
                    </Link>
                  ) : (
                    screen.name
                  )}
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[0.65rem]">
                  L5
                </Badge>
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  {visible.length}
                  {q && visible.length !== screen.cases.length ? ` / ${screen.cases.length}` : ""} case{visible.length === 1 ? "" : "s"}
                </span>
                {canRun && onRunScreen && (
                  <SmallRunButton
                    runBusy={Boolean(runBusy)}
                    title={`Run all cases for ${screen.screenId}`}
                    onRun={() => onRunScreen(screen.screenId)}
                  />
                )}
              </div>
              <p className="mt-0.5 truncate font-mono text-[0.65rem] text-muted-foreground">{screen.path}</p>
            </div>
          }
        />
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 p-3 pt-1">
          {groups.map((group) => {
            const groupOpen = openGroups[group.title] ?? true;
            return (
              <div key={group.title} className="rounded-lg border border-border/50 bg-background/30">
                <div className="px-2 py-1">
                  <CollapsibleHeader
                    open={groupOpen}
                    onToggle={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [group.title]: !(prev[group.title] ?? true),
                      }))
                    }
                    title={<span className="text-sm font-medium text-foreground/90">Priority {group.title}</span>}
                    meta={<span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">{group.cases.length}</span>}
                  />
                </div>
                {groupOpen && (
                  <div className="border-t border-border/40 px-2 py-2">
                    <UiCaseList
                      cases={group.cases}
                      intakeRef={screen.intakeRef}
                      hasSnapshot={hasSnapshot}
                      canRun={canRun}
                      runBusy={runBusy}
                      onRunCase={onRunCase}
                      playwrightReportUrl={playwrightReportUrl}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

function UiAreaSection({
  area,
  screens,
  caseCount,
  search,
  defaultOpen,
  hasSnapshot,
  canRun,
  runBusy,
  onRunScreen,
  onRunCase,
  playwrightReportUrl,
}: {
  area: string;
  screens: UiScreenGroup[];
  caseCount: number;
  search: string;
  defaultOpen: boolean;
  hasSnapshot: boolean;
  canRun?: boolean;
  runBusy?: boolean;
  onRunScreen?: (screenId: string) => void;
  onRunCase?: (caseId: string) => void;
  playwrightReportUrl?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const q = search.trim().toLowerCase();

  useEffect(() => {
    if (q) setOpen(true);
  }, [q]);

  return (
    <section className="rounded-xl border border-border/50 bg-card/20">
      <div className="px-3 py-2">
        <CollapsibleHeader
          open={open}
          onToggle={() => setOpen((v) => !v)}
          title={
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-sm font-semibold text-foreground">{area}</h3>
              <RunRollupBadges rollup={casesRunRollup(screens.flatMap((s) => s.cases))} hasSnapshot={hasSnapshot} />
            </div>
          }
          meta={
            <div className="flex shrink-0 items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
              <span>
                {screens.length} screen{screens.length === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>
                {caseCount} case{caseCount === 1 ? "" : "s"}
              </span>
            </div>
          }
        />
      </div>
      {open && (
        <div className="space-y-2 border-t border-border/40 px-3 py-3">
          {screens.map((screen) => (
            <UiScreenCard
              key={screen.screenId}
              screen={screen}
              search={search}
              defaultOpen={Boolean(q) || screen.cases.length <= SUBSECTION_CASE_THRESHOLD}
              hasSnapshot={hasSnapshot}
              canRun={canRun}
              runBusy={runBusy}
              onRunScreen={onRunScreen}
              onRunCase={onRunCase}
              playwrightReportUrl={playwrightReportUrl}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function UiLayerSection({
  areas,
  caseCount,
  screenCount,
  search,
  defaultOpen,
  lastRun,
  canRun,
  runBusy,
  onRunScreen,
  onRunCase,
  playwrightReportUrl,
}: {
  areas: UiAreaGroup[];
  caseCount: number;
  screenCount: number;
  search: string;
  defaultOpen: boolean;
  lastRun?: UiCaseCatalog["lastRun"];
  canRun?: boolean;
  runBusy?: boolean;
  onRunScreen?: (screenId: string) => void;
  onRunCase?: (caseId: string) => void;
  playwrightReportUrl?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const q = search.trim().toLowerCase();
  const hasSnapshot = Boolean(lastRun?.runAt);

  useEffect(() => {
    if (q) setOpen(true);
  }, [q]);

  return (
    <section>
      <CollapsibleHeader
        open={open}
        onToggle={() => setOpen((v) => !v)}
        className="mb-2 px-0"
        title={<h2 className="font-display text-lg tracking-tight text-heading">L5 · UI presentation</h2>}
        meta={
          <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>
              {areas.length} area{areas.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              {screenCount} screen{screenCount === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              {caseCount} case{caseCount === 1 ? "" : "s"}
            </span>
            {hasSnapshot && lastRun?.runAt ? (
              <>
                <span>·</span>
                <span
                  className="inline-flex cursor-help items-center gap-1.5"
                  title={[
                    `Last run ${formatRunWhen(lastRun.runAt)}`,
                    lastRun.runAt,
                    lastRun.source && lastRun.source !== "none" ? `source: ${lastRun.source}` : null,
                    `${lastRun.summary.passed} passed · ${lastRun.summary.failed} failed · ${lastRun.summary.skipped} skipped`,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                >
                  <span className="inline-flex items-center gap-0.5 text-emerald-400" aria-hidden>
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                    <span className="tabular-nums">{lastRun.summary.passed}</span>
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-rose-400" aria-hidden>
                    <X className="h-3 w-3" strokeWidth={2.5} />
                    <span className="tabular-nums">{lastRun.summary.failed}</span>
                  </span>
                  <span className="inline-flex items-center gap-0.5" aria-hidden>
                    <Minus className="h-3 w-3" strokeWidth={2.5} />
                    <span className="tabular-nums">{lastRun.summary.skipped}</span>
                  </span>
                </span>
              </>
            ) : (
              <>
                <span>·</span>
                <span
                  className="inline-flex cursor-help items-center"
                  title="No Playwright run recorded yet"
                  aria-label="No Playwright run recorded yet"
                >
                  <CircleDashed className="h-3.5 w-3.5" />
                </span>
              </>
            )}
            {playwrightReportUrl && (lastRun?.summary.failed ?? 0) > 0 && (
              <>
                <span>·</span>
                <PlaywrightReportButton href={playwrightReportUrl} compact />
              </>
            )}
          </div>
        }
      />
      {open && (
        <div className="space-y-3 pl-1">
          {areas.map((area) => (
            <UiAreaSection
              key={area.area}
              area={area.area}
              screens={area.screens}
              caseCount={area.caseCount}
              search={search}
              defaultOpen={Boolean(q) || area.caseCount < AREA_COLLAPSE_THRESHOLD}
              hasSnapshot={hasSnapshot}
              canRun={canRun}
              runBusy={runBusy}
              onRunScreen={onRunScreen}
              onRunCase={onRunCase}
              playwrightReportUrl={playwrightReportUrl}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LevelBadge({ level }: { level: TestLevel }) {
  return (
    <Badge variant={LEVEL_VARIANT[level]} className="shrink-0 font-mono text-[0.65rem]">
      {level === "tooling" ? "tooling" : level}
    </Badge>
  );
}

function caseMatches(testCase: TestCaseRecord, q: string): boolean {
  if (!q) return true;
  return testCase.name.toLowerCase().includes(q) || testCase.suitePath.some((s) => s.toLowerCase().includes(q));
}

type RunStatusFilter = "all" | "passed" | "failed" | "pending";

function outcomeMatchesStatus(outcome: string | undefined | null, filter: RunStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return outcome == null;
  if (outcome == null) return false;
  if (filter === "passed") return outcome === "passed";
  if (filter === "failed") return outcome === "failed" || outcome === "timedOut";
  return true;
}

function caseMatchesRunStatus(testCase: { lastRun?: { outcome: string } | null }, filter: RunStatusFilter): boolean {
  return outcomeMatchesStatus(testCase.lastRun?.outcome ?? null, filter);
}

function fileMatches(file: TestFileRecord, q: string): boolean {
  if (!q) return true;
  if (file.path.toLowerCase().includes(q)) return true;
  if (file.area.toLowerCase().includes(q)) return true;
  if (file.suiteName.toLowerCase().includes(q)) return true;
  return file.cases.some((c) => caseMatches(c, q));
}

function groupCases(cases: TestCaseRecord[], search: string): CaseGroup[] {
  const q = search.trim().toLowerCase();
  const visible = q ? cases.filter((c) => caseMatches(c, q)) : cases;
  if (visible.length === 0) return [];

  const hasNested = visible.some((c) => c.suitePath.length > 1);
  if (!hasNested || cases.length < SUBSECTION_CASE_THRESHOLD) {
    return [{ title: "", cases: visible }];
  }

  const map = new Map<string, TestCaseRecord[]>();
  for (const testCase of visible) {
    const title = testCase.suitePath[1] ?? "General";
    const list = map.get(title) ?? [];
    list.push(testCase);
    map.set(title, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    })
    .map(([title, grouped]) => ({ title, cases: grouped }));
}

function CollapsibleHeader({
  open,
  onToggle,
  title,
  meta,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-accent/50", className)}
      onClick={onToggle}
      aria-expanded={open}
    >
      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-90")} />
      <div className="min-w-0 flex-1">{title}</div>
      {meta}
    </button>
  );
}

function CaseList({ cases, hasSnapshot }: { cases: TestCaseRecord[]; hasSnapshot: boolean }) {
  return (
    <div className="space-y-1.5">
      {cases.map((testCase, i) => (
        <div key={`${testCase.name}-${i}`} className="flex items-start gap-2 rounded-md border border-border/40 px-2.5 py-2">
          <div className="min-w-0 flex-1">
            {testCase.suitePath.length > 2 && (
              <p className="mb-0.5 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">{testCase.suitePath.slice(2).join(" › ")}</p>
            )}
            <p className="text-sm text-foreground/90">{testCase.name}</p>
          </div>
          <LastRunIcon lastRun={testCase.lastRun} hasSnapshot={hasSnapshot} />
        </div>
      ))}
    </div>
  );
}

function TestFileCard({
  file,
  search,
  defaultOpen,
  canRun,
  runBusy,
  onRunFile,
  hasSnapshot,
}: {
  file: TestFileRecord;
  search: string;
  defaultOpen: boolean;
  canRun: boolean;
  runBusy: boolean;
  onRunFile?: (path: string) => void;
  hasSnapshot: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const groups = useMemo(() => groupCases(file.cases, search), [file.cases, search]);
  const visibleCount = groups.reduce((n, g) => n + g.cases.length, 0);
  const q = search.trim().toLowerCase();
  const showRun = canRun && (file.level === "L1" || file.level === "L2") && onRunFile;

  useEffect(() => {
    if (q) setOpen(true);
  }, [q]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!q) return;
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      if (group.title) next[group.title] = true;
    }
    setOpenGroups((prev) => ({ ...prev, ...next }));
  }, [q, groups]);

  if (visibleCount === 0) return null;

  return (
    <Card className="border-border/60 bg-card/40">
      <CardHeader className="space-y-0 p-2 pb-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <CollapsibleHeader
              open={open}
              onToggle={() => setOpen((v) => !v)}
              title={
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm font-sans font-medium">{file.suiteName}</CardTitle>
                    <LevelBadge level={file.level} />
                    <LastRunIcon lastRun={file.lastRun} hasSnapshot={hasSnapshot} />
                    <span className="font-mono text-[0.65rem] text-muted-foreground">
                      {visibleCount}
                      {q && visibleCount !== file.caseCount ? ` / ${file.caseCount}` : ""} case
                      {visibleCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[0.65rem] text-muted-foreground">{file.path}</p>
                </div>
              }
            />
          </div>
          {showRun && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 h-7 shrink-0 gap-1 px-2 text-xs"
              disabled={runBusy}
              onClick={(e) => {
                stopCardHeaderClick(e);
                onRunFile(file.path);
              }}
              title={`Run ${file.level} file`}
            >
              <Play className="h-3 w-3" />
              Run
            </Button>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 p-3 pt-1">
          {groups.map((group) => {
            if (!group.title) {
              return <CaseList key="flat" cases={group.cases} hasSnapshot={hasSnapshot} />;
            }
            const groupOpen = openGroups[group.title] ?? Boolean(q);
            return (
              <div key={group.title} className="rounded-lg border border-border/50 bg-background/30">
                <div className="px-2 py-1">
                  <CollapsibleHeader
                    open={groupOpen}
                    onToggle={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [group.title]: !(prev[group.title] ?? Boolean(q)),
                      }))
                    }
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground/90">{group.title}</span>
                        <RunRollupBadges rollup={casesRunRollup(group.cases)} hasSnapshot={hasSnapshot} />
                      </div>
                    }
                    meta={<span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">{group.cases.length}</span>}
                  />
                </div>
                {groupOpen && (
                  <div className="border-t border-border/40 px-2 py-2">
                    <CaseList cases={group.cases} hasSnapshot={hasSnapshot} />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

function AreaSection({
  area,
  files,
  caseCount,
  search,
  defaultOpen,
  canRun,
  runBusy,
  onRunFile,
  onRunFiles,
  hasSnapshot,
}: {
  area: string;
  files: TestFileRecord[];
  caseCount: number;
  search: string;
  defaultOpen: boolean;
  canRun: boolean;
  runBusy: boolean;
  onRunFile?: (path: string) => void;
  onRunFiles?: (paths: string[]) => void;
  hasSnapshot: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const q = search.trim().toLowerCase();
  const rollup = useMemo(() => filesRunRollup(files), [files]);
  const runPaths = useMemo(() => runnableL12Paths(files), [files]);

  useEffect(() => {
    if (q) setOpen(true);
  }, [q]);

  return (
    <section className="rounded-xl border border-border/50 bg-card/20">
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <CollapsibleHeader
            open={open}
            onToggle={() => setOpen((v) => !v)}
            title={
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="font-mono text-sm font-semibold text-foreground">{areaLabel(area)}</h3>
                <span className="font-mono text-[0.65rem] text-muted-foreground">{area}</span>
              </div>
            }
            meta={
              <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
                <RunRollupBadges rollup={rollup} hasSnapshot={hasSnapshot} />
                <span>
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {caseCount} case{caseCount === 1 ? "" : "s"}
                </span>
              </div>
            }
          />
        </div>
        {canRun && (
          <RollupRunButton
            paths={runPaths}
            runBusy={runBusy}
            onRun={onRunFiles}
            title={`Run ${runPaths.length} L1/L2 file${runPaths.length === 1 ? "" : "s"} in ${areaLabel(area)}`}
          />
        )}
      </div>
      {open && (
        <div className="space-y-2 border-t border-border/40 px-3 py-3">
          {files.map((file) => (
            <TestFileCard
              key={file.path}
              file={file}
              search={search}
              defaultOpen={Boolean(q) || file.caseCount <= SUBSECTION_CASE_THRESHOLD}
              canRun={canRun}
              runBusy={runBusy}
              onRunFile={onRunFile}
              hasSnapshot={hasSnapshot}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LayerSection({
  layer,
  areas,
  caseCount,
  fileCount,
  search,
  defaultOpen,
  canRun,
  runBusy,
  onRunFile,
  onRunFiles,
  hasSnapshot,
}: {
  layer: string;
  areas: AreaGroup[];
  caseCount: number;
  fileCount: number;
  search: string;
  defaultOpen: boolean;
  canRun: boolean;
  runBusy: boolean;
  onRunFile?: (path: string) => void;
  onRunFiles?: (paths: string[]) => void;
  hasSnapshot: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const q = search.trim().toLowerCase();
  const allFiles = useMemo(() => areas.flatMap((a) => a.files), [areas]);
  const rollup = useMemo(() => filesRunRollup(allFiles), [allFiles]);
  const runPaths = useMemo(() => runnableL12Paths(allFiles), [allFiles]);

  useEffect(() => {
    if (q) setOpen(true);
  }, [q]);

  return (
    <section>
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <CollapsibleHeader
            open={open}
            onToggle={() => setOpen((v) => !v)}
            className="px-0"
            title={<h2 className="font-display text-lg tracking-tight text-heading">{layer}</h2>}
            meta={
              <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                <RunRollupBadges rollup={rollup} hasSnapshot={hasSnapshot} className="text-xs" />
                <span>
                  {areas.length} area{areas.length === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {fileCount} file{fileCount === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>
                  {caseCount} case{caseCount === 1 ? "" : "s"}
                </span>
              </div>
            }
          />
        </div>
        {canRun && (
          <RollupRunButton
            paths={runPaths}
            runBusy={runBusy}
            onRun={onRunFiles}
            title={`Run ${runPaths.length} L1/L2 file${runPaths.length === 1 ? "" : "s"} in ${layer}`}
          />
        )}
      </div>
      {open && (
        <div className="space-y-3 pl-1">
          {areas.map((area) => (
            <AreaSection
              key={area.area}
              area={area.area}
              files={area.files}
              caseCount={area.caseCount}
              search={search}
              defaultOpen={Boolean(q) || area.caseCount < AREA_COLLAPSE_THRESHOLD}
              canRun={canRun}
              runBusy={runBusy}
              onRunFile={onRunFile}
              onRunFiles={onRunFiles}
              hasSnapshot={hasSnapshot}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function describeVitestRunScope(scope: TestRunScope): string {
  if (scope.scope === "level") return `all ${scope.level}`;
  if (scope.scope === "file") return scope.path;
  return `${scope.paths.length} files`;
}

function describeUiRunScope(scope: UiTestRunScope): string {
  if (scope.scope === "all") return "all L5";
  if (scope.scope === "screen") return scope.screenId;
  return scope.caseId;
}

export function TestsPage() {
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof fetchTestCatalog>> | null>(null);
  const [uiCatalog, setUiCatalog] = useState<UiCaseCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => {
    const file = searchParams.get("file");
    const q = searchParams.get("q");
    return file || q || "";
  });
  const [levelFilter, setLevelFilter] = useState<TestLevel | "all" | "L5">("all");
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>("all");
  const [runsAvailable, setRunsAvailable] = useState(false);
  const [run, setRun] = useState<TestRunSnapshot | null>(null);
  const [logText, setLogText] = useState("");
  const [vitestRunOpen, setVitestRunOpen] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLPreElement | null>(null);
  const runBusy = run?.status === "running";

  const persistedL5 = useMemo(() => loadL5FormPersisted(), []);
  const [uiRunsAvailable, setUiRunsAvailable] = useState(false);
  const [uiCapability, setUiCapability] = useState<UiTestRunCapability | null>(null);
  const [uiRun, setUiRun] = useState<UiTestRunSnapshot | null>(null);
  const [uiLogText, setUiLogText] = useState("");
  const [uiLogOpen, setUiLogOpen] = useState(true);
  const [uiRunError, setUiRunError] = useState<string | null>(null);
  const uiLogEndRef = useRef<HTMLPreElement | null>(null);
  const [l5BaseUrl, setL5BaseUrl] = useState(persistedL5.baseUrl);
  const [l5AdminEmail, setL5AdminEmail] = useState(persistedL5.adminEmail);
  const [l5AdminPassword, setL5AdminPassword] = useState("");
  const [l5ViewerEmail, setL5ViewerEmail] = useState(persistedL5.viewerEmail);
  const [l5ViewerPassword, setL5ViewerPassword] = useState("");
  const [l5TargetOpen, setL5TargetOpen] = useState(false);
  const uiRunBusy = uiRun?.status === "running";
  const anyRunBusy = runBusy || uiRunBusy;
  const enabledLevels = useMemo(() => {
    if (catalog?.enabledLevels) return new Set(catalog.enabledLevels);
    return pagesTestLevels();
  }, [catalog]);
  const l5Enabled = enabledLevels.has("L5");

  const playwrightReportUrl = useMemo(
    () => playwrightReportHref(uiRun?.playwrightReportUrl ?? uiCapability?.playwrightReportUrl),
    [uiRun?.playwrightReportUrl, uiCapability?.playwrightReportUrl]
  );

  const showPlaywrightReport = Boolean(playwrightReportUrl && ((uiRun?.summary?.failed ?? 0) > 0 || (uiCatalog?.lastRun?.summary.failed ?? 0) > 0));

  const refreshCatalogs = useRef(() => {
    void fetchTestCatalog()
      .then(async (tests) => {
        setCatalog(tests);
        const levels = new Set(tests.enabledLevels ?? [...pagesTestLevels()]);
        if (!levels.has("L5")) return;
        const [ui, uiCap] = await Promise.all([fetchUiCaseCatalog(), fetchUiTestRunCapability()]);
        setUiCatalog(ui);
        setUiCapability(uiCap);
      })
      .catch(() => undefined);
  });

  useEffect(() => {
    if (levelFilter !== "all" && !pagesTestLevels().has(levelFilter)) {
      setLevelFilter("all");
    }
  }, [levelFilter]);

  useEffect(() => {
    saveL5FormPersisted({
      baseUrl: l5BaseUrl,
      adminEmail: l5AdminEmail,
      viewerEmail: l5ViewerEmail,
    });
  }, [l5BaseUrl, l5AdminEmail, l5ViewerEmail]);

  useEffect(() => {
    void fetchTestCatalog()
      .then(async (tests) => {
        setCatalog(tests);
        const capability = await fetchTestRunCapability();
        setRunsAvailable(capability.available);
        if (capability.run) {
          setRun(capability.run);
          setLogText(capability.run.log);
        }
        const levels = new Set(tests.enabledLevels ?? [...pagesTestLevels()]);
        if (!levels.has("L5")) return;
        const [ui, uiCap] = await Promise.all([fetchUiCaseCatalog(), fetchUiTestRunCapability()]);
        setUiCatalog(ui);
        setUiCapability(uiCap);
        setUiRunsAvailable(uiCap.available);
        if (uiCap.run) {
          setUiRun(uiCap.run);
          setUiLogText(uiCap.run.log);
        }
        const merged = mergeL5FormDefaults(
          {
            baseUrl: l5BaseUrl,
            adminEmail: l5AdminEmail,
            adminPassword: l5AdminPassword,
            viewerEmail: l5ViewerEmail,
            viewerPassword: l5ViewerPassword,
          },
          uiCap.formDefaults
        );
        setL5BaseUrl(merged.baseUrl || uiCap.defaultBaseUrl || "");
        setL5AdminEmail(merged.adminEmail);
        setL5AdminPassword(merged.adminPassword);
        setL5ViewerEmail(merged.viewerEmail);
        setL5ViewerPassword(merged.viewerPassword);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    const reload = () => refreshCatalogs.current();
    const unsub = subscribeToReload(reload);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(reload, 8_000);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (runBusy) setVitestRunOpen(true);
  }, [runBusy]);

  useEffect(() => {
    if (uiRunBusy) setUiLogOpen(true);
  }, [uiRunBusy]);

  useEffect(() => {
    if (!runsAvailable) return;
    return subscribeTestRunStream({
      onSnapshot: (snap) => {
        setRun(snap);
        setLogText(snap.log);
      },
      onLog: (chunk) => {
        setLogText((prev) => prev + chunk);
      },
      onStatus: (status) => {
        setRun((prev) => {
          if (!prev || prev.runId !== status.runId) {
            return prev;
          }
          return {
            ...prev,
            status: status.status,
            finishedAt: status.finishedAt ?? prev.finishedAt,
            exitCode: status.exitCode ?? prev.exitCode,
            cancelled: status.cancelled ?? prev.cancelled,
            summary: status.summary ?? prev.summary,
            paths: status.paths ?? prev.paths,
            scope: status.scope ?? prev.scope,
          };
        });
      },
      onDone: (done) => {
        setRun((prev) =>
          prev && prev.runId === done.runId
            ? {
                ...prev,
                status: done.status,
                exitCode: done.exitCode,
                summary: done.summary,
                finishedAt: done.finishedAt,
              }
            : prev
        );
        if (done.status !== "cancelled") {
          refreshCatalogs.current();
        }
      },
    });
  }, [runsAvailable]);

  useEffect(() => {
    if (!uiRunsAvailable) return;
    return subscribeUiTestRunStream({
      onSnapshot: (snap) => {
        setUiRun(snap);
        setUiLogText(snap.log);
      },
      onLog: (chunk) => {
        setUiLogText((prev) => prev + chunk);
      },
      onStatus: (status) => {
        setUiRun((prev) => {
          if (!prev || prev.runId !== status.runId) return prev;
          return {
            ...prev,
            status: status.status,
            finishedAt: status.finishedAt ?? prev.finishedAt,
            exitCode: status.exitCode ?? prev.exitCode,
            cancelled: status.cancelled ?? prev.cancelled,
            summary: status.summary ?? prev.summary,
            scope: status.scope ?? prev.scope,
            grep: status.grep ?? prev.grep,
            baseUrl: status.baseUrl ?? prev.baseUrl,
            phase: status.phase ?? prev.phase,
            playwrightReportAvailable: status.playwrightReportAvailable ?? prev.playwrightReportAvailable,
            playwrightReportUrl: status.playwrightReportUrl ?? prev.playwrightReportUrl,
          };
        });
      },
      onDone: (done) => {
        setUiRun((prev) =>
          prev && prev.runId === done.runId
            ? {
                ...prev,
                status: done.status,
                exitCode: done.exitCode,
                summary: done.summary,
                finishedAt: done.finishedAt,
                playwrightReportAvailable: done.playwrightReportAvailable ?? prev.playwrightReportAvailable,
                playwrightReportUrl: done.playwrightReportUrl ?? prev.playwrightReportUrl,
              }
            : prev
        );
        if (done.status !== "cancelled") {
          refreshCatalogs.current();
        }
      },
    });
  }, [uiRunsAvailable]);

  useEffect(() => {
    if (!vitestRunOpen) return;
    logEndRef.current?.scrollTo({ top: logEndRef.current.scrollHeight });
  }, [logText, vitestRunOpen]);

  useEffect(() => {
    if (!uiLogOpen) return;
    uiLogEndRef.current?.scrollTo({ top: uiLogEndRef.current.scrollHeight });
  }, [uiLogText, uiLogOpen]);

  async function beginRun(scope: TestRunScope) {
    setRunError(null);
    try {
      const result = await startTestRun(scope);
      setRun(result.run);
      setLogText(result.run.log);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onCancelRun() {
    setRunError(null);
    try {
      const result = await cancelTestRun();
      if (result.run) setRun(result.run);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  }

  function buildUiStartBody(scope: UiTestRunStartBody["scope"], extra?: { screenId?: string; caseId?: string }): UiTestRunStartBody {
    const credentials: UiTestRunStartBody["credentials"] = {};
    if (l5AdminEmail.trim()) credentials.adminEmail = l5AdminEmail.trim();
    if (l5AdminPassword) credentials.adminPassword = l5AdminPassword;
    if (l5ViewerEmail.trim()) credentials.viewerEmail = l5ViewerEmail.trim();
    if (l5ViewerPassword) credentials.viewerPassword = l5ViewerPassword;
    const hasCreds = Object.keys(credentials).length > 0;
    return {
      scope,
      ...extra,
      baseUrl: l5BaseUrl.trim() || undefined,
      credentials: hasCreds ? credentials : undefined,
    };
  }

  async function beginUiRun(
    scope: UiTestRunStartBody["scope"],
    extra?: { screenId?: string; caseId?: string },
    options?: { baseUrl?: string | null }
  ) {
    setUiRunError(null);
    try {
      const body = buildUiStartBody(scope, extra);
      if (options?.baseUrl) body.baseUrl = options.baseUrl;
      const result = await startUiTestRun(body);
      setUiRun(result.run);
      setUiLogText(result.run.log);
      setL5AdminPassword("");
      setL5ViewerPassword("");
    } catch (e) {
      setUiRunError(e instanceof Error ? e.message : String(e));
    }
  }

  async function rerunLastVitest() {
    if (!run || run.status === "running" || anyRunBusy) return;
    await beginRun(run.scope);
  }

  async function rerunLastUiRun() {
    if (!uiRun || uiRun.status === "running" || anyRunBusy) return;
    const opts = uiRun.baseUrl ? { baseUrl: uiRun.baseUrl } : undefined;
    const s = uiRun.scope;
    if (s.scope === "all") {
      await beginUiRun("all", undefined, opts);
    } else if (s.scope === "screen") {
      await beginUiRun("screen", { screenId: s.screenId }, opts);
    } else {
      await beginUiRun("case", { caseId: s.caseId }, opts);
    }
  }

  async function onCancelUiRun() {
    setUiRunError(null);
    try {
      const result = await cancelUiTestRun();
      if (result.run) setUiRun(result.run);
    } catch (e) {
      setUiRunError(e instanceof Error ? e.message : String(e));
    }
  }

  const filteredUiCases = useMemo(() => {
    if (!uiCatalog) return [];
    const q = search.trim().toLowerCase();
    return uiCatalog.cases.filter((c) => uiCaseMatches(c, q) && caseMatchesRunStatus(c, statusFilter));
  }, [uiCatalog, search, statusFilter]);

  const uiAreas = useMemo(() => groupUiCasesByArea(filteredUiCases, uiCatalog?.manifests), [filteredUiCases, uiCatalog?.manifests]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    if (levelFilter === "L5") return [];
    const q = search.trim().toLowerCase();
    const out: TestFileRecord[] = [];
    for (const file of catalog.files) {
      if (levelFilter !== "all" && file.level !== levelFilter) continue;
      if (!fileMatches(file, q)) continue;
      const cases = statusFilter === "all" ? file.cases : file.cases.filter((c) => caseMatchesRunStatus(c, statusFilter));
      if (statusFilter !== "all") {
        if (cases.length === 0) continue;
        if (cases.length !== file.cases.length) {
          out.push({ ...file, cases, caseCount: cases.length });
          continue;
        }
      }
      out.push(file);
    }
    return out;
  }, [catalog, search, levelFilter, statusFilter]);

  const byLayer = useMemo((): LayerGroup[] => {
    const areaMap = new Map<string, TestFileRecord[]>();
    for (const file of filtered) {
      const list = areaMap.get(file.area) ?? [];
      list.push(file);
      areaMap.set(file.area, list);
    }

    const layerMap = new Map<string, AreaGroup[]>();
    for (const [area, files] of [...areaMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const layer = layerOf(area);
      const caseCount = files.reduce((n, f) => n + f.caseCount, 0);
      const list = layerMap.get(layer) ?? [];
      list.push({
        area,
        files: files.sort((a, b) => b.caseCount - a.caseCount || a.path.localeCompare(b.path)),
        caseCount,
      });
      layerMap.set(layer, list);
    }

    const order = orderedTestLayers(layerMap.keys());

    return order.map((layer) => {
      const areas = (layerMap.get(layer) ?? []).sort((a, b) => b.caseCount - a.caseCount);
      return {
        layer,
        areas,
        caseCount: areas.reduce((n, a) => n + a.caseCount, 0),
        fileCount: areas.reduce((n, a) => n + a.files.length, 0),
      };
    });
  }, [filtered]);

  if (loading) return <PageLoading label="Scanning test files…" />;
  if (error || !catalog) {
    return (
      <div>
        <PageHeader title="Tests" description="Could not load test catalog" />
        <p className="text-sm text-destructive">{error ?? "Unknown error"}</p>
      </div>
    );
  }

  /** Summary + filter order: only levels from config (`enabledLevels` / pages.testLevels). */
  const filterOrder: Array<TestLevel | "L5"> = (["L1", "L2", "L3", "L4", "L5", "tooling"] as const).filter((level) => enabledLevels.has(level));
  const vitestHasSnapshot = Boolean(catalog.lastRun?.runAt);

  return (
    <div>
      <PageHeader
        title="Tests"
        description={
          l5Enabled
            ? `${catalog.summary.caseCount} Vitest cases · ${uiCatalog?.summary.caseCount ?? 0} L5 UI cases from docs`
            : `${catalog.summary.caseCount} Vitest cases`
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider text-foreground/80">Last run</span>
        {vitestHasSnapshot && catalog.lastRun?.runAt ? (
          <span
            className="inline-flex flex-wrap items-center gap-2 font-mono"
            title={`Vitest · ${catalog.lastRun.source} · ${catalog.lastRun.runAt}`}
          >
            <span>Vitest</span>
            <span className="inline-flex items-center gap-0.5 text-emerald-400">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              {catalog.lastRun.summary.passed}
            </span>
            <span className="inline-flex items-center gap-0.5 text-rose-400">
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              {catalog.lastRun.summary.failed}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              {catalog.lastRun.summary.skipped}
            </span>
            <span>· {formatRunWhen(catalog.lastRun.runAt)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono" title="No Vitest overlay in vitest-runs/latest.json yet">
            <CircleDashed className="h-3.5 w-3.5" />
            Vitest · no run recorded
          </span>
        )}
        {l5Enabled ? (
          <>
            <span className="text-border">|</span>
            {uiCatalog?.lastRun?.runAt ? (
              <span
                className="inline-flex flex-wrap items-center gap-2 font-mono"
                title={`L5 · ${uiCatalog.lastRun.source} · ${uiCatalog.lastRun.runAt}`}
              >
                <span>L5</span>
                <span className="inline-flex items-center gap-0.5 text-emerald-400">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {uiCatalog.lastRun.summary.passed}
                </span>
                <span className="inline-flex items-center gap-0.5 text-rose-400">
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {uiCatalog.lastRun.summary.failed}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {uiCatalog.lastRun.summary.skipped}
                </span>
                <span>· {formatRunWhen(uiCatalog.lastRun.runAt)}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono">
                <CircleDashed className="h-3.5 w-3.5" />
                L5 · no Playwright run recorded
              </span>
            )}
          </>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {filterOrder.map((level) =>
          level === "L5" ? (
            <Card key="L5" className="border-border/60 bg-card/50">
              <CardHeader className="p-3 pb-1">
                <div className="flex min-w-0 items-start justify-between gap-1.5">
                  <CardTitle className="min-w-0 truncate text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
                    L5 · UI cases
                  </CardTitle>
                  {uiRunsAvailable && uiCapability?.webAppConfigured && (
                    <SmallRunButton
                      compact
                      runBusy={anyRunBusy}
                      title="Run all catalog L5 Playwright cases (not the full WebApp suite)"
                      onRun={() => void beginUiRun("all")}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold tabular-nums">{uiCatalog?.summary.caseCount ?? 0}</div>
                <p
                  className="mt-1 flex cursor-help items-center gap-2 text-xs leading-snug text-muted-foreground"
                  title={
                    uiCatalog?.lastRun?.runAt
                      ? `Last run ${formatRunWhen(uiCatalog.lastRun.runAt)} · ${uiCatalog.lastRun.summary.passed} passed · ${uiCatalog.lastRun.summary.failed} failed · ${uiCatalog.lastRun.summary.skipped} skipped`
                      : "Presentation cases · no Playwright run recorded yet"
                  }
                >
                  {uiCatalog?.lastRun?.runAt ? (
                    <>
                      <span className="inline-flex items-center gap-0.5 text-emerald-400">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {uiCatalog.lastRun.summary.passed}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-rose-400">
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {uiCatalog.lastRun.summary.failed}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {uiCatalog.lastRun.summary.skipped}
                      </span>
                    </>
                  ) : (
                    <CircleDashed className="h-3.5 w-3.5" />
                  )}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card key={level} className="border-border/60 bg-card/50">
              <CardHeader className="p-3 pb-1">
                <div className="flex min-w-0 items-start justify-between gap-1.5">
                  <CardTitle className="min-w-0 truncate text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">
                    {LEVEL_INFO[level].label}
                  </CardTitle>
                  {runsAvailable && (level === "L1" || level === "L2") && (
                    <RollupRunButton
                      compact
                      paths={runnableL12Paths(catalog.files.filter((f) => f.level === level))}
                      runBusy={anyRunBusy}
                      onRun={(_paths) => void beginRun({ scope: "level", level })}
                      title={`Run all ${level}`}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold tabular-nums">{catalog.summary.byLevel[level]}</div>
                {(() => {
                  const rollup = levelRunRollup(catalog.files, level);
                  if (!vitestHasSnapshot) {
                    return (
                      <p className="mt-1 flex cursor-help items-center gap-1 text-xs text-muted-foreground" title="No Vitest last-run overlay yet">
                        <CircleDashed className="h-3.5 w-3.5" />
                        No run yet
                      </p>
                    );
                  }
                  if (!rollup.hasAny) {
                    return (
                      <p
                        className="mt-1 flex cursor-help items-center gap-1 text-xs text-muted-foreground"
                        title="No files at this level in the last Vitest run overlay"
                      >
                        <CircleDashed className="h-3.5 w-3.5" />
                        Not in last run
                      </p>
                    );
                  }
                  return (
                    <p
                      className="mt-1 flex cursor-help items-center gap-2 text-xs leading-snug text-muted-foreground"
                      title={`${rollup.passed} passed · ${rollup.failed} failed · ${rollup.skipped} skipped`}
                    >
                      <span className="inline-flex items-center gap-0.5 text-emerald-400">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {rollup.passed}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-rose-400">
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {rollup.failed}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {rollup.skipped}
                      </span>
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          )
        )}
      </div>

      {l5Enabled && uiRunsAvailable && (
        <div className="mb-4 rounded-xl border border-border/60 bg-card/30 p-3">
          <CollapsibleHeader
            open={l5TargetOpen}
            onToggle={() => setL5TargetOpen((v) => !v)}
            className="px-0 py-0"
            title={<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">L5 · Playwright target</span>}
            meta={
              !l5TargetOpen ? (
                <span className="max-w-[min(24rem,50vw)] truncate font-mono text-[0.65rem] text-muted-foreground">
                  {!uiCapability?.webAppConfigured ? (
                    <span className="text-amber-500">WebApp missing</span>
                  ) : (
                    l5BaseUrl || uiCapability.defaultBaseUrl || "http://localhost:3000"
                  )}
                </span>
              ) : undefined
            }
          />
          {l5TargetOpen && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!uiCapability?.webAppConfigured && <span className="font-mono text-[0.65rem] text-amber-500">WebApp missing — set WEBAPP_ROOT</span>}
                {uiCapability?.webAppConfigured && !uiCapability.hostCredentialsConfigured && (
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    Enter credentials below (or set PLAYWRIGHT_* in the host .env / WebApp .env.playwright.local)
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Target URL
                  <Input
                    value={l5BaseUrl}
                    onChange={(e) => setL5BaseUrl(e.target.value)}
                    placeholder={uiCapability?.defaultBaseUrl ?? "http://localhost:3000"}
                    autoComplete="off"
                    disabled={uiRunBusy}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Admin email
                  <Input
                    value={l5AdminEmail}
                    onChange={(e) => setL5AdminEmail(e.target.value)}
                    placeholder="admin@…"
                    autoComplete="username"
                    disabled={uiRunBusy}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Admin password
                  <Input
                    type="password"
                    value={l5AdminPassword}
                    onChange={(e) => setL5AdminPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={uiRunBusy}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Viewer email
                  <Input
                    value={l5ViewerEmail}
                    onChange={(e) => setL5ViewerEmail(e.target.value)}
                    placeholder="viewer@… (defaults to admin)"
                    autoComplete="username"
                    disabled={uiRunBusy}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
                  Viewer password
                  <Input
                    type="password"
                    value={l5ViewerPassword}
                    onChange={(e) => setL5ViewerPassword(e.target.value)}
                    placeholder="•••••••• (defaults to admin)"
                    autoComplete="current-password"
                    disabled={uiRunBusy}
                  />
                </label>
              </div>
              <p className="font-mono text-[0.65rem] text-muted-foreground">
                Passwords are sent only for this run (not stored). Emails and URL stay in sessionStorage.
                {uiCapability?.webAppRoot ? ` · WebApp: ${uiCapability.webAppRoot}` : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {l5Enabled && uiRunsAvailable && (uiRun || uiRunBusy || uiLogText || uiRunError) && (
        <div className="mb-4 space-y-3 rounded-xl border border-border/60 bg-card/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">L5 Playwright run</span>
            {uiRunBusy && (
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => void onCancelUiRun()}>
                <Square className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
            {uiRun && !uiRunBusy && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={anyRunBusy}
                title={`Rerun ${describeUiRunScope(uiRun.scope)}${uiRun.baseUrl ? ` @ ${uiRun.baseUrl}` : ""}`}
                onClick={() => void rerunLastUiRun()}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rerun
              </Button>
            )}
            {showPlaywrightReport && <PlaywrightReportButton href={playwrightReportUrl} />}
            {uiRun && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                {uiRunBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : uiRun.status === "passed" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : uiRun.status === "cancelled" ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5 text-rose-400" />
                )}
                <span className="capitalize">{uiRun.status}</span>
                {uiRun.phase && uiRunBusy && <span>· {uiRun.phase}</span>}
                {uiRun.summary && (
                  <span>
                    · {uiRun.summary.passed} passed · {uiRun.summary.failed} failed · {uiRun.summary.skipped} skipped
                  </span>
                )}
                {uiRun.exitCode != null && <span>· exit {uiRun.exitCode}</span>}
                {uiRun.baseUrl && <span>· {uiRun.baseUrl}</span>}
              </span>
            )}
          </div>
          {uiRunError && <p className="text-sm text-destructive">{uiRunError}</p>}
          {(uiRunBusy || uiLogText) && (
            <RunLogOutput
              title="Playwright output"
              text={uiLogText}
              emptyLabel="Waiting for Playwright output…"
              open={uiLogOpen}
              onToggleOpen={() => setUiLogOpen((v) => !v)}
              busy={uiRunBusy}
              scrollRef={uiLogEndRef}
              downloadBasename="l5-playwright-run"
            />
          )}
        </div>
      )}

      {runsAvailable && (run || runBusy || logText || runError) && (
        <div className="mb-4 rounded-xl border border-border/60 bg-card/30 p-3">
          <div className="flex items-start gap-2">
            <CollapsibleHeader
              open={vitestRunOpen}
              onToggle={() => setVitestRunOpen((v) => !v)}
              className="min-w-0 flex-1 px-0 py-0"
              title={<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vitest run</span>}
              meta={
                !vitestRunOpen && run ? (
                  <span className="inline-flex max-w-[min(28rem,55vw)] items-center gap-1.5 truncate font-mono text-[0.65rem] text-muted-foreground">
                    {runBusy ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    ) : run.status === "passed" ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                    ) : run.status === "cancelled" ? (
                      <Minus className="h-3 w-3 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 shrink-0 text-rose-400" />
                    )}
                    <span className="truncate capitalize">{run.status}</span>
                    {run.summary && (
                      <span className="truncate">
                        · {run.summary.passed} passed · {run.summary.failed} failed · {run.summary.skipped} skipped
                      </span>
                    )}
                    {run.exitCode != null && <span>· exit {run.exitCode}</span>}
                  </span>
                ) : undefined
              }
            />
            {runBusy && (
              <Button size="sm" variant="destructive" className="shrink-0 gap-1" onClick={() => void onCancelRun()}>
                <Square className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
            {run && !runBusy && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                disabled={anyRunBusy}
                title={`Rerun ${describeVitestRunScope(run.scope)}`}
                onClick={() => void rerunLastVitest()}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rerun
              </Button>
            )}
          </div>
          {vitestRunOpen && (
            <div className="mt-3 space-y-3">
              {run && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  {runBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : run.status === "passed" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : run.status === "cancelled" ? (
                    <Minus className="h-3.5 w-3.5" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className="capitalize">{run.status}</span>
                  {run.summary && (
                    <span>
                      · {run.summary.passed} passed · {run.summary.failed} failed · {run.summary.skipped} skipped
                    </span>
                  )}
                  {run.exitCode != null && <span>· exit {run.exitCode}</span>}
                </span>
              )}
              {runError && <p className="text-sm text-destructive">{runError}</p>}
              {(runBusy || logText) && (
                <RunLogOutput
                  title="Test output"
                  text={logText}
                  emptyLabel="Waiting for Vitest output…"
                  collapsible={false}
                  busy={runBusy}
                  scrollRef={logEndRef}
                  downloadBasename="vitest-run"
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input placeholder="Search tests, suites, UI case ids…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div
          role="group"
          aria-label="Filter by last-run outcome"
          className="inline-flex items-center rounded-lg border border-border/60 bg-card/40 p-0.5"
        >
          {(
            [
              { id: "all" as const, label: "All", title: "All last-run outcomes" },
              {
                id: "passed" as const,
                label: "Passed",
                title: "Passed in last run",
                Icon: Check,
                iconClass: "text-emerald-400",
              },
              {
                id: "failed" as const,
                label: "Failed",
                title: "Failed in last run",
                Icon: X,
                iconClass: "text-rose-400",
              },
              {
                id: "pending" as const,
                label: "Pending",
                title: "Not in last run",
                Icon: CircleDashed,
                iconClass: "text-muted-foreground",
              },
            ] as const
          ).map((opt) => {
            const active = statusFilter === opt.id;
            const Icon = "Icon" in opt ? opt.Icon : null;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.title}
                aria-label={opt.title}
                aria-pressed={active}
                onClick={() => setStatusFilter(opt.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon ? <Icon className={cn("h-3.5 w-3.5", active && "iconClass" in opt ? opt.iconClass : undefined)} strokeWidth={2.5} /> : null}
                <span className={cn(Icon && "hidden sm:inline")}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Level</span>
        <Button variant={levelFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setLevelFilter("all")}>
          All
        </Button>
        {filterOrder.map((level) =>
          level === "L5" ? (
            <Button key="L5" variant={levelFilter === "L5" ? "default" : "outline"} size="sm" onClick={() => setLevelFilter("L5")}>
              L5 · UI cases
            </Button>
          ) : (
            <Button key={level} variant={levelFilter === level ? "default" : "outline"} size="sm" onClick={() => setLevelFilter(level)}>
              {LEVEL_INFO[level].label}
            </Button>
          )
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-22rem)] pr-3">
        <div className="space-y-8">
          {levelFilter !== "L5" &&
            byLayer.map((layer) => (
              <LayerSection
                key={layer.layer}
                layer={layer.layer}
                areas={layer.areas}
                caseCount={layer.caseCount}
                fileCount={layer.fileCount}
                search={search}
                defaultOpen={Boolean(search.trim()) || layer.layer === "Routes" || layer.caseCount < AREA_COLLAPSE_THRESHOLD}
                canRun={runsAvailable}
                runBusy={anyRunBusy}
                onRunFile={(path) => void beginRun({ scope: "file", path })}
                onRunFiles={(paths) => void beginRun(paths.length === 1 ? { scope: "file", path: paths[0]! } : { scope: "files", paths })}
                hasSnapshot={vitestHasSnapshot}
              />
            ))}
          {(levelFilter === "all" || levelFilter === "L5") && uiAreas.length > 0 && (
            <UiLayerSection
              areas={uiAreas}
              caseCount={filteredUiCases.length}
              screenCount={uiAreas.reduce((n, a) => n + a.screens.length, 0)}
              search={search}
              lastRun={uiCatalog?.lastRun}
              defaultOpen={levelFilter === "L5" || Boolean(search.trim()) || filteredUiCases.length < AREA_COLLAPSE_THRESHOLD}
              canRun={Boolean(uiRunsAvailable && uiCapability?.webAppConfigured)}
              runBusy={anyRunBusy}
              onRunScreen={(screenId) => void beginUiRun("screen", { screenId })}
              onRunCase={(caseId) => void beginUiRun("case", { caseId })}
              playwrightReportUrl={showPlaywrightReport ? playwrightReportUrl : null}
            />
          )}
          {filtered.length === 0 && levelFilter !== "L5" && filteredUiCases.length === 0 && (
            <p className="text-sm text-muted-foreground">No tests match your filters.</p>
          )}
          {levelFilter === "L5" && filteredUiCases.length === 0 && (
            <p className="text-sm text-muted-foreground">No L5 UI cases match your filters.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
