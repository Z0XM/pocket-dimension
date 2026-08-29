import { Link } from "react-router-dom";
import { SoftEmptyBanner } from "@/components/SoftEmptyBanner";
import { EpicTrain } from "@/components/EpicTrain";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/context/DashboardContext";
import { formatStoryId } from "@/lib/formatIds";
import { inlineMarkdown } from "@/lib/inlineMarkdown";
import { cn } from "@/lib/utils";
import { CHIP_TEXT } from "@/lib/statusColors";

export function OverviewPage() {
  const { data, loading, error, reload } = useDashboard();

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Overview" />
        <PageLoading label="Loading dashboard data…" />
      </>
    );
  }
  if (error && !data) {
    return (
      <>
        <PageHeader title="Overview" />
        <PageError message={error} onRetry={reload} />
      </>
    );
  }
  if (!data) return <PageError message="Failed to load dashboard" />;

  const active = data.stories.filter((s) => s.status === "in-progress" || s.status === "review");
  const blocked = data.stories.filter((s) => s.status === "blocked");
  const inProgressEpicIds = new Set(data.epics.filter((e) => e.status === "in-progress").map((e) => e.id));
  const readyForDev = data.stories.filter((s) => s.status === "ready-for-dev").sort((a, b) => a.epicNumber - b.epicNumber || a.number - b.number);
  const frontierBacklog = data.stories
    .filter((s) => s.status === "backlog" && inProgressEpicIds.has(s.epicId))
    .sort((a, b) => a.epicNumber - b.epicNumber || a.number - b.number);
  const nextUp = [...readyForDev, ...frontierBacklog].slice(0, 8);

  const kpis: Array<{
    label: string;
    value: string;
    href: string;
    small?: boolean;
    valueClassName?: string;
  }> = [
    {
      label: "Story completion",
      value: `${data.summary.storyCompletionPct}%`,
      href: "/delivery",
    },
    {
      label: "Epics done / active / future",
      value: `${data.summary.epics.done} / ${data.summary.epics["in-progress"]} / ${data.summary.epics.backlog}`,
      small: true,
      href: "/delivery",
    },
    {
      label: "Active work",
      value: String(data.summary.stories["in-progress"] + data.summary.stories.review),
      valueClassName: CHIP_TEXT.sky,
      href: "/delivery",
    },
    {
      label: "Blockers",
      value: String(data.summary.openBlockers),
      valueClassName: "text-destructive",
      href: "/blockers",
    },
    {
      label: "Deferred items",
      value: String(data.summary.deferredItems),
      valueClassName: CHIP_TEXT.amber,
      href: "/deferred",
    },
  ];

  return (
    <div>
      <PageHeader title="Overview" description="Sprint pulse across epics, stories, and blockers" />

      {data.epics.length === 0 && data.stories.length === 0 && <SoftEmptyBanner kind="planning" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/60 bg-card/50 transition-colors hover:border-heading/40 hover:bg-accent/20">
            <Link to={kpi.href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={kpi.small ? "text-xl font-semibold" : cn("text-3xl font-semibold tabular-nums", kpi.valueClassName)}>{kpi.value}</div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <Card className="mb-6 border-border/60 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Epic release train</CardTitle>
          <Link to="/delivery?view=timeline" className="text-xs font-medium text-muted-foreground hover:text-heading">
            Process timeline →
          </Link>
        </CardHeader>
        <CardContent>
          <EpicTrain epics={data.epics} />
        </CardContent>
      </Card>

      <Card className="mb-6 border-border/60 bg-card/50">
        <CardHeader>
          <CardTitle>Story status breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(data.summary.stories).map(([status, count]) => (
              <Link key={status} to="/delivery" className="inline-flex items-center gap-1.5 rounded-md transition-opacity hover:opacity-90">
                <StatusBadge status={status} />
                <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className={CHIP_TEXT.sky}>Active now</CardTitle>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stories in progress or review</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {active.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0">
                    <Link to={`/stories/${s.id}`} className="text-sm hover:underline">
                      <span className="mr-1.5 font-mono text-heading">{formatStoryId(s)}</span>
                      {inlineMarkdown(s.title)}
                    </Link>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-destructive">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            {blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked stories</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {blocked.map((s) => (
                  <li key={s.id} className="py-2.5 first:pt-0">
                    <Link to={`/stories/${s.id}`} className="text-sm hover:underline">
                      <span className="mr-1.5 font-mono text-heading">{formatStoryId(s)}</span>
                      {inlineMarkdown(s.title)}
                    </Link>
                    {s.blockers.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.blockers.slice(0, 2).join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/50">
        <CardHeader>
          <CardTitle>Next up — {readyForDev.length > 0 ? "ready for dev" : "active-epic backlog"}</CardTitle>
        </CardHeader>
        <CardContent>
          {nextUp.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ready-for-dev or backlog stories on in-progress epics</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {nextUp.map((s) => (
                <li key={s.id} className="py-2 first:pt-0">
                  <Link to={`/stories/${s.id}`} className="text-sm hover:underline">
                    <span className="mr-1.5 font-mono text-heading">{formatStoryId(s)}</span>
                    {inlineMarkdown(s.title)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />
      <p className="text-xs text-muted-foreground">Last updated: {data.meta.lastUpdated || "unknown"} · Auto-refreshes when docs change</p>
    </div>
  );
}
