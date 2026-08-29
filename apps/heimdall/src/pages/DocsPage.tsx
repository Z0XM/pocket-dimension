import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { fetchDocCatalog, fetchDocContent, searchDocs, type DocRecord } from "@/api/client";
import { DocExplorer } from "@/components/DocExplorer";
import { MarkdownView } from "@/components/MarkdownView";
import { PageHeader, PageLoading } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHashScroll } from "@/lib/hashScroll";
import { inlineMarkdown } from "@/lib/inlineMarkdown";
import { searchShortcutLabel } from "@/lib/platform";
import { getDocsEmptyBoardCopy } from "@/lib/softEmptyCopy";
import { cn } from "@/lib/utils";

function groupDocs(docs: DocRecord[]): Map<string, DocRecord[]> {
  const groups = new Map<string, DocRecord[]>();
  for (const doc of docs) {
    const key = doc.section ? `${doc.category}/${doc.section}` : doc.category;
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }
  return groups;
}

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPath = searchParams.get("path");
  const queryParam = searchParams.get("q");

  const [catalog, setCatalog] = useState<DocRecord[]>([]);
  const [content, setContent] = useState("");
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchDocs>>["results"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocCatalog().then((c) => {
      setCatalog(c.docs);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (queryParam) {
      searchDocs(queryParam).then((r) => setSearchResults(r.results));
    } else {
      setSearchResults([]);
    }
  }, [queryParam]);

  useEffect(() => {
    if (!selectedPath) {
      setContent("");
      return;
    }
    fetchDocContent(selectedPath).then((r) => setContent(r.content));
  }, [selectedPath]);

  const grouped = useMemo(() => groupDocs(catalog), [catalog]);
  const contentReady = Boolean(selectedPath && content);
  useHashScroll(contentReady);

  if (loading) return <PageLoading label="Loading docs…" />;

  return (
    <div>
      <PageHeader title="Docs" description={`${catalog.length} files indexed · Use ${searchShortcutLabel()} to search`} />

      {catalog.length === 0 && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {getDocsEmptyBoardCopy().description}
        </p>
      )}

      {queryParam && (
        <Card className="mb-4 border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-sans">Search results for &ldquo;{queryParam}&rdquo;</CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {searchResults.map((r) => (
                  <li key={r.path} className="py-2 first:pt-0">
                    <button type="button" className="text-left text-sm hover:underline" onClick={() => setSearchParams({ path: r.path })}>
                      {inlineMarkdown(r.title)}
                    </button>
                    <div className="text-xs text-muted-foreground">{r.path}</div>
                    {r.snippets[0] && <div className="text-xs text-muted-foreground/80">{r.snippets[0]}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[280px_1fr]">
        <Card className={cn("border-border/60 bg-card/50", selectedPath && "hidden lg:flex lg:flex-col")}>
          <ScrollArea className="h-auto max-h-[70dvh] lg:max-h-none lg:h-[calc(100dvh-12rem)]">
            <DocExplorer groups={grouped} selectedPath={selectedPath} onSelect={(path) => setSearchParams({ path })} />
          </ScrollArea>
        </Card>

        <Card className={cn("border-border/60 bg-card/50", !selectedPath && "hidden lg:block")}>
          <CardContent className="max-h-none overflow-auto p-3 sm:p-5 lg:max-h-[calc(100dvh-12rem)]">
            {!selectedPath ? (
              <p className="text-sm text-muted-foreground">Select a document from the tree</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 lg:hidden" onClick={() => setSearchParams({})}>
                    <ArrowLeft className="h-4 w-4" />
                    All docs
                  </Button>
                  <div className="min-w-0 break-all font-mono text-xs text-muted-foreground">{selectedPath}</div>
                </div>
                {selectedPath.endsWith(".yaml") || selectedPath.endsWith(".yml") ? (
                  <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-xs sm:p-4">{content}</pre>
                ) : (
                  <MarkdownView content={content} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
