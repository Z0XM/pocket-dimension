import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStoryDetail, type StoryDetail } from "@/api/client";
import { MarkdownView } from "@/components/MarkdownView";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { ProgressBar, StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatStoryId } from "@/lib/formatIds";

export function StoryDetailPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) return;
    setLoading(true);
    fetchStoryDetail(storyId)
      .then(setStory)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [storyId]);

  if (loading) return <PageLoading label="Loading story…" />;
  if (error) return <PageError message={error} />;
  if (!story) return <PageError message="Story not found" />;

  const taskPct = story.taskProgress && story.taskProgress.total ? Math.round((story.taskProgress.completed / story.taskProgress.total) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Link to="/delivery" className="hover:text-heading">
          ← Epics & Stories
        </Link>
        <span>·</span>
        <Link to={`/epics/${story.epicId}`} className="hover:text-heading">
          Epic {story.code ? story.code.replace(/\.\d+$/, "") : story.epicNumber}
        </Link>
      </div>

      <PageHeader title={`Story ${formatStoryId(story)}: ${story.title}`} />
      <StatusBadge status={story.status} />

      {!story.hasImplementationFile && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>Story file not created yet — showing epic definition only.</AlertDescription>
        </Alert>
      )}

      {story.userStory && (
        <Card className="mt-4 border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>User story</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{story.userStory}</p>
          </CardContent>
        </Card>
      )}

      {story.blockers.length > 0 && (
        <Card className="mt-4 border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Blocking dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {story.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            {story.blockingSection && <MarkdownView content={story.blockingSection} />}
          </CardContent>
        </Card>
      )}

      {story.acceptanceCriteria && (
        <Card className="mt-4 border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Acceptance criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownView content={story.acceptanceCriteria} />
          </CardContent>
        </Card>
      )}

      {story.taskProgress && story.taskProgress.total > 0 && (
        <Card className="mt-4 border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {story.taskProgress.completed}/{story.taskProgress.total} complete ({taskPct}%)
            </p>
            <ProgressBar pct={taskPct} />
          </CardContent>
        </Card>
      )}

      {story.devNotes && (
        <details className="mt-4" open>
          <summary className="cursor-pointer font-display text-lg">Dev notes</summary>
          <Card className="mt-2 border-border/60 bg-card/50">
            <CardContent className="pt-4">
              <MarkdownView content={story.devNotes} />
            </CardContent>
          </Card>
        </details>
      )}

      {story.rawImplementation && (
        <details className="mt-4">
          <summary className="cursor-pointer font-display text-lg">Full implementation file</summary>
          <Card className="mt-2 border-border/60 bg-card/50">
            <CardContent className="pt-4">
              <MarkdownView content={story.rawImplementation} />
            </CardContent>
          </Card>
        </details>
      )}

      {story.implementationPath && (
        <>
          <Separator className="my-6" />
          <p className="text-xs text-muted-foreground">
            Source: <code className="font-mono">{story.implementationPath}</code>
          </p>
        </>
      )}
    </div>
  );
}
