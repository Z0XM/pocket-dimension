import { Link } from "react-router-dom";
import { SoftEmptyBanner } from "@/components/SoftEmptyBanner";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/context/DashboardContext";

export function QuestionsPage() {
  const { data, loading, error } = useDashboard();

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error ?? "Failed to load"} />;

  return (
    <div>
      <PageHeader
        title={
          <>
            Open Questions <span className="font-sans text-2xl font-medium tabular-nums text-muted-foreground">({data.openQuestions.length})</span>
          </>
        }
        description="Unresolved product questions from INTAKE-INDEX (Resolved = No only)"
      />

      {data.openQuestions.length === 0 && <SoftEmptyBanner kind="optional-intake" />}

      <Card className="border-border/60 bg-card/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            {data.openQuestions.length > 0 && (
              <TableBody>
                {data.openQuestions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono">{q.id}</TableCell>
                    <TableCell>{q.question}</TableCell>
                    <TableCell>
                      <Link to={`/browse?path=${encodeURIComponent("docs/requirements/INTAKE-INDEX.md")}`}>{q.source}</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
