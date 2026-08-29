import { SoftEmptyBanner } from "@/components/SoftEmptyBanner";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ExtGapLink, LinkedEntityText, StoryLink } from "@/components/EntityLink";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/context/DashboardContext";
import { formatStoryId } from "@/lib/formatIds";
import { inlineMarkdown } from "@/lib/inlineMarkdown";
import { statusChipClass } from "@/lib/statusColors";

export function BlockersPage() {
  const { data, loading, error } = useDashboard();

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error ?? "Failed to load"} />;

  const blockedStories = data.stories.filter((s) => s.status === "blocked");
  const openGaps = data.externalGaps.filter((g) => g.status !== "closed");

  return (
    <div>
      <PageHeader title="Blockers & Dependencies" description="Blocked stories and external gaps from configured planning docs" />

      {blockedStories.length === 0 && openGaps.length === 0 && <SoftEmptyBanner kind="optional-external" />}

      <CollapsibleSection
        className="mb-6"
        flush
        title="Blocked stories"
        badge={
          <Badge variant="outline" className={statusChipClass("blocked")}>
            {blockedStories.length}
          </Badge>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Story</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Blocked by</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blockedStories.map((s) => {
              const refs = s.blockers.filter((b) => /EXT-\d+|Epic \d+|Story \d+\.\d+/.test(b));
              const detail = s.blockers[0];
              return (
                <TableRow key={s.id} className="bg-[hsl(var(--chip-rose)/0.05)]">
                  <TableCell className="font-mono">
                    <StoryLink storyId={s.id} label={formatStoryId(s)} />
                  </TableCell>
                  <TableCell>{inlineMarkdown(s.title)}</TableCell>
                  <TableCell className="text-sm">
                    {refs.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {refs.map((b, i) => (
                          <LinkedEntityText key={i} text={b} />
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {detail ? <LinkedEntityText text={detail} /> : <StoryLink storyId={s.id}>Open story →</StoryLink>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CollapsibleSection>

      <CollapsibleSection
        className="mb-6"
        flush
        title="External gaps (EXT)"
        badge={
          <Badge variant="outline" className={statusChipClass("blocked")}>
            {openGaps.length}
          </Badge>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Affected stories</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openGaps.map((g) => {
              const affected = data.stories.filter((s) => s.blockers.some((b) => b.includes(g.id)));
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <ExtGapLink extId={g.id} />
                  </TableCell>
                  <TableCell>
                    {g.summary.slice(0, 100)}
                    {g.summary.length > 100 ? "…" : ""}
                  </TableCell>
                  <TableCell>{g.owner}</TableCell>
                  <TableCell>
                    <StatusBadge status={g.status === "partial" ? "review" : g.status === "closed" ? "done" : "blocked"} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {affected.length > 0 ? (
                      <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
                        {affected.map((s, i) => (
                          <span key={s.id}>
                            {i > 0 && <span className="text-muted-foreground">, </span>}
                            <StoryLink storyId={s.id} label={formatStoryId(s)} />
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CollapsibleSection>
    </div>
  );
}
