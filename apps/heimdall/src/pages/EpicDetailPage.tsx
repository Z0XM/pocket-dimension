import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/context/DashboardContext";
import { featuresLocation } from "@/lib/featuresLocation";
import { formatEpicId, formatStoryId } from "@/lib/formatIds";
import { cn } from "@/lib/utils";
import { inlineMarkdown } from "@/lib/inlineMarkdown";

export function EpicDetailPage() {
  const { epicId } = useParams<{ epicId: string }>();
  const location = useLocation();
  const { data, loading, error } = useDashboard();
  const [showDone, setShowDone] = useState(false);

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error ?? "Failed to load"} />;

  const epic = data.epics.find((e) => e.id === epicId);
  if (!epic) return <PageError message="Epic not found" />;

  const stories = data.stories.filter((s) => s.epicId === epic.id);
  const doneStories = stories.filter((s) => s.status === "done");
  const remaining = stories.filter((s) => s.status !== "done");
  const retro = data.retrospectives.find((r) => r.epicId === epic.id);
  const features = data.features.filter((f) => f.epicId === epic.id || epic.featureIds.includes(f.id));

  const relatedGaps = data.externalGaps.filter((g) => stories.some((s) => s.blockers.some((b) => b.includes(g.id))));

  return (
    <div>
      <Link to="/delivery" className="text-sm text-muted-foreground hover:text-heading">
        ← Epics & Stories
      </Link>
      <PageHeader title={`Epic ${formatEpicId(epic)} — ${epic.title}`} description={epic.goal} />
      <StatusBadge status={epic.status} />

      {features.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {features.map((f) => (
            <Link key={f.id} to={featuresLocation(f.id, location.search)}>
              <Badge variant="secondary" className="text-xs hover:border-primary/40">
                {f.id}: {f.name} ({f.screens.join(", ")})
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Remaining stories ({remaining.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Story</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remaining.map((s) => (
                  <TableRow key={s.id} className={cn(s.status === "blocked" && "bg-rose-500/5")}>
                    <TableCell className="font-mono">
                      <Link to={`/stories/${s.id}`}>{formatStoryId(s)}</Link>
                    </TableCell>
                    <TableCell>{inlineMarkdown(s.title)}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.taskProgress ? `${s.taskProgress.completed}/${s.taskProgress.total}` : s.hasImplementationFile ? "—" : "No file"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Sidebar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              <span className="text-muted-foreground">Retrospective:</span> {retro?.status ?? "optional"}
            </p>
            {relatedGaps.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium">Related EXT gaps</h4>
                <ul className="space-y-1 text-muted-foreground">
                  {relatedGaps.map((g) => (
                    <li key={g.id}>
                      <span className="font-mono text-primary">{g.id}</span> — {g.summary.slice(0, 80)}…
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-border/60 bg-card/50">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Completed stories ({doneStories.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"}
          </Button>
        </CardHeader>
        {showDone && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Story</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Impl file</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doneStories.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">
                      <Link to={`/stories/${s.id}`}>{formatStoryId(s)}</Link>
                    </TableCell>
                    <TableCell>{inlineMarkdown(s.title)}</TableCell>
                    <TableCell>{s.hasImplementationFile ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
