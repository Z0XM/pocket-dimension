import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SourceFieldLinks } from "@/components/EntityLink";
import { FilterChips } from "@/components/FilterChips";
import { SoftEmptyBanner } from "@/components/SoftEmptyBanner";
import { PageError, PageHeader, PageLoading } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboard } from "@/context/DashboardContext";
import { kindChipClass } from "@/lib/statusColors";
import type { DeferredItemKind } from "@/types/dashboard";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<DeferredItemKind, string> = {
  product: "Product",
  integration: "Integration",
  engineering: "Engineering",
  tooling: "Tooling",
};

type KindFilter = "all" | DeferredItemKind;

export function DeferredPage() {
  const { data, loading, error } = useDashboard();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const items = useMemo(() => {
    if (!data) return [];
    if (kindFilter === "all") return data.deferredItems;
    return data.deferredItems.filter((i) => i.kind === kindFilter);
  }, [data, kindFilter]);

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error ?? "Failed to load"} />;

  const allItems = data.deferredItems;
  const byKind = (kind: DeferredItemKind) => allItems.filter((i) => i.kind === kind);

  return (
    <div>
      <PageHeader
        title={
          <>
            Deferred <span className="font-sans text-2xl font-medium tabular-nums text-muted-foreground">({allItems.length})</span>
          </>
        }
        description="Out-of-initial-scope product, integration, engineering, and tooling items from DEFERRED-INDEX"
      />

      {allItems.length === 0 && <SoftEmptyBanner kind="optional-deferred" />}

      <FilterChips
        className="mb-6"
        ariaLabel="Deferred kind filter"
        value={kindFilter}
        onChange={setKindFilter}
        options={[
          { id: "all", label: "All", colorKey: "all", count: allItems.length },
          ...(Object.keys(KIND_LABEL) as DeferredItemKind[]).map((kind) => ({
            id: kind as KindFilter,
            label: KIND_LABEL[kind],
            className: kindChipClass(kind),
            count: byKind(kind).length,
          })),
        ]}
      />

      <Card className="mb-6 border-border/60 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base font-sans">Active deferred items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              No active deferred items
              {kindFilter !== "all" ? ` for ${KIND_LABEL[kindFilter]}` : ""} in{" "}
              <Link className="underline" to={`/browse?path=${encodeURIComponent("docs/requirements/DEFERRED-INDEX.md")}`}>
                DEFERRED-INDEX.md
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Timing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-sans text-xs", kindChipClass(item.kind))}>
                        {KIND_LABEL[item.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.summary}</TableCell>
                    <TableCell className="max-w-[16rem] text-sm text-muted-foreground">
                      <SourceFieldLinks source={item.source} />
                    </TableCell>
                    <TableCell className="max-w-[12rem] text-sm text-muted-foreground">{item.timing}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Source of truth:{" "}
        <Link className="underline" to={`/browse?path=${encodeURIComponent("docs/requirements/DEFERRED-INDEX.md")}`}>
          docs/requirements/DEFERRED-INDEX.md
        </Link>
        . Future epic backlog remains on{" "}
        <Link className="underline" to="/delivery?view=timeline">
          Epics & Stories → Timeline
        </Link>
        .
      </p>
    </div>
  );
}
