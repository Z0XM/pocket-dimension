import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { searchDocs, type SearchResult } from "@/api/client";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { bareEpicId, bareStoryId, formatEpicId, formatStoryId } from "@/lib/formatIds";
import { featuresHref } from "@/lib/featuresLocation";
import { inlineMarkdown, stripInlineMarkdown } from "@/lib/inlineMarkdown";
import { browsePath, extGapBrowsePath } from "@/lib/sourcePaths";
import { searchShortcutLabel } from "@/lib/platform";
import { statusChipClass } from "@/lib/statusColors";
import { cn } from "@/lib/utils";

type SearchType = "all" | "story" | "epic" | "feature" | "ext" | "docs" | "deferred" | "question";

type PaletteHit = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  to: string;
};

const TYPE_OPTIONS: { id: SearchType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "story", label: "Story" },
  { id: "epic", label: "Epic" },
  { id: "feature", label: "Feature" },
  { id: "ext", label: "EXT" },
  { id: "docs", label: "Docs" },
  { id: "deferred", label: "Deferred" },
  { id: "question", label: "Question" },
];

const STORY_STATUSES = ["backlog", "ready-for-dev", "in-progress", "review", "blocked", "done"] as const;

const EPIC_STATUSES = ["done", "in-progress", "backlog"] as const;
const DOC_CATS = ["project", "requirements", "planning", "implementation"] as const;
const EXT_STATUSES = ["open", "partial"] as const;

function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true;
  return haystack.toLowerCase().includes(q.toLowerCase());
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [typeTag, setTypeTag] = useState<SearchType>("all");
  const [secondary, setSecondary] = useState<string | null>(null);
  const [tertiary, setTertiary] = useState<string | null>(null);
  const [docResults, setDocResults] = useState<SearchResult[]>([]);
  const { data } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery("");
      setTypeTag("all");
      setSecondary(null);
      setTertiary(null);
      setDocResults([]);
    }
  }, [open]);

  useEffect(() => {
    setSecondary(null);
    setTertiary(null);
  }, [typeTag]);

  useEffect(() => {
    setTertiary(null);
  }, [secondary]);

  useEffect(() => {
    if (!open) return;
    const wantsDocs = typeTag === "all" || typeTag === "docs";
    if (!wantsDocs) {
      setDocResults([]);
      return;
    }
    const timer = setTimeout(() => {
      let q = query.trim();
      if (typeTag === "docs" && secondary) {
        q = `cat:${secondary} ${q}`.trim();
      }
      if (!q && typeTag === "docs" && secondary) {
        q = `cat:${secondary}`;
      }
      if (!q) {
        setDocResults([]);
        return;
      }
      searchDocs(q).then((r) => setDocResults(r.results));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, typeTag, secondary]);

  const secondaryOptions = useMemo(() => {
    switch (typeTag) {
      case "story":
        return STORY_STATUSES.map((s) => ({ id: s, label: s.replace(/-/g, " ") }));
      case "epic":
        return EPIC_STATUSES.map((s) => ({
          id: s,
          label: s === "done" ? "complete" : s.replace(/-/g, " "),
        }));
      case "docs":
        return DOC_CATS.map((c) => ({ id: c, label: c }));
      case "ext":
        return EXT_STATUSES.map((s) => ({ id: s, label: s }));
      default:
        return [] as { id: string; label: string }[];
    }
  }, [typeTag]);

  const tertiaryOptions = useMemo(() => {
    return [] as { id: string; label: string }[];
  }, []);

  const entityHits = useMemo((): PaletteHit[] => {
    if (!data) return [];
    const q = query.trim();
    const hits: PaletteHit[] = [];
    const include = (t: SearchType) => typeTag === "all" || typeTag === t;

    if (include("story")) {
      for (const s of data.stories) {
        if (secondary && s.status !== secondary) continue;
        const hay = `${formatStoryId(s)} ${bareStoryId(s)} ${stripInlineMarkdown(s.title)} ${s.id}`;
        if (!matchesQuery(hay, q) && q) continue;
        if (!q && !secondary && typeTag === "all") continue;
        hits.push({
          id: `story:${s.id}`,
          group: "Stories",
          title: `${formatStoryId(s)} — ${stripInlineMarkdown(s.title)}`,
          subtitle: s.status,
          to: `/stories/${s.id}`,
        });
      }
    }

    if (include("epic")) {
      for (const e of data.epics) {
        if (secondary && e.status !== secondary) continue;
        const hay = `epic ${formatEpicId(e)} ${bareEpicId(e)} ${e.title} ${e.featureIds.join(" ")}`;
        if (!matchesQuery(hay, q) && q) continue;
        if (!q && !secondary && typeTag === "all") continue;
        hits.push({
          id: `epic:${e.id}`,
          group: "Epics",
          title: `Epic ${formatEpicId(e)} — ${stripInlineMarkdown(e.title)}`,
          subtitle: e.status,
          to: `/epics/${e.id}`,
        });
      }
    }

    if (include("feature")) {
      for (const f of data.features) {
        const hay = `${f.id} ${f.name} ${f.area} ${f.status}`;
        if (!matchesQuery(hay, q) && q) continue;
        if (!q && typeTag === "all") continue;
        hits.push({
          id: `feature:${f.id}`,
          group: "Features",
          title: `${f.id} — ${f.name}`,
          subtitle: `${f.area} · ${f.status}`,
          to: featuresHref(f.id, location.search),
        });
      }
    }

    if (include("ext")) {
      for (const g of data.externalGaps) {
        if (g.status === "closed") continue;
        if (secondary && g.status !== secondary) continue;
        const hay = `${g.id} ${g.summary} ${g.owner}`;
        if (!matchesQuery(hay, q) && q) continue;
        if (!q && !secondary && typeTag === "all") continue;
        hits.push({
          id: `ext:${g.id}`,
          group: "External gaps",
          title: `${g.id} — ${g.summary.slice(0, 80)}`,
          subtitle: g.status,
          to: extGapBrowsePath(g.id),
        });
      }
    }

    if (include("deferred")) {
      for (const d of data.deferredItems) {
        const hay = `${d.id} ${d.summary} ${d.kind} ${d.source}`;
        if (!matchesQuery(hay, q) && q) continue;
        if (!q && typeTag === "all") continue;
        hits.push({
          id: `deferred:${d.id}`,
          group: "Deferred",
          title: `${d.id} — ${d.summary}`,
          subtitle: d.kind,
          to: `/deferred`,
        });
      }
    }

    if (include("question")) {
      for (const qq of data.openQuestions) {
        const hay = `${qq.id} ${qq.question} ${qq.source}`;
        if (!matchesQuery(hay, q) && q) continue;
        if (!q && typeTag === "all") continue;
        hits.push({
          id: `question:${qq.id}`,
          group: "Questions",
          title: `${qq.id} — ${qq.question.slice(0, 80)}`,
          subtitle: qq.source,
          to: `/questions`,
        });
      }
    }

    return hits.slice(0, 40);
  }, [data, query, typeTag, secondary, tertiary, location.search]);

  const docHits: PaletteHit[] = useMemo(() => {
    if (typeTag !== "all" && typeTag !== "docs") return [];
    return docResults.slice(0, 20).map((r) => ({
      id: `doc:${r.path}`,
      group: "Docs",
      title: stripInlineMarkdown(r.title),
      subtitle: `${r.category} · ${r.path}`,
      to: browsePath(r.path),
    }));
  }, [docResults, typeTag]);

  const allHits = [...entityHits, ...docHits];
  const groups = [...new Set(allHits.map((h) => h.group))];

  const goTo = (to: string) => {
    navigate(to);
    onClose();
  };

  const hasScope = typeTag !== "all" || Boolean(query.trim());

  const tagBar = (
    <div className="border-b border-border/60 px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTypeTag(opt.id)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              typeTag === opt.id ? statusChipClass(opt.id === "all" ? "all" : "selected") : "border-border/60 text-muted-foreground hover:bg-accent"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {secondaryOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">then</span>
          {secondaryOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSecondary(secondary === opt.id ? null : opt.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                secondary === opt.id ? statusChipClass("selected") : "border-border/60 text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
          {secondary && (
            <button
              type="button"
              aria-label="Clear secondary tag"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-accent"
              onClick={() => setSecondary(null)}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {tertiaryOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">area</span>
          {tertiaryOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTertiary(tertiary === opt.id ? null : opt.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                tertiary === opt.id ? statusChipClass("selected") : "border-border/60 text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl sm:max-w-xl">
        <div className="flex items-center border-b border-border/60 px-3" cmdk-input-wrapper="">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={typeTag === "all" ? "Search stories, epics, docs…" : `Search within ${typeTag}…`}
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        {tagBar}
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <CommandList>
            <CommandEmpty>
              {!hasScope ? `Press ${searchShortcutLabel()} anytime · Pick a tag or type to search the War Room…` : "No results found."}
            </CommandEmpty>
            {hasScope &&
              groups.map((group) => (
                <CommandGroup key={group} heading={group}>
                  {allHits
                    .filter((h) => h.group === group)
                    .map((h) => (
                      <CommandItem key={h.id} value={`${h.group} ${h.title} ${h.subtitle} ${h.id}`} onSelect={() => goTo(h.to)}>
                        <div className="font-medium">{inlineMarkdown(h.title)}</div>
                        <div className="text-xs text-muted-foreground">{h.subtitle}</div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function useSearchShortcut(onOpen: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}
