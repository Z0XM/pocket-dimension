import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileCode, FileText, Folder, FolderOpen } from "lucide-react";
import type { DocRecord } from "@/api/client";
import { inlineMarkdown } from "@/lib/inlineMarkdown";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER = ["project", "requirements", "planning", "implementation"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  project: "Project",
  requirements: "Requirements",
  planning: "Planning",
  implementation: "Implementation",
};

const SECTION_LABELS: Record<string, string> = {
  registry: "Registry",
  intake: "Intake",
  architecture: "Architecture",
  prds: "PRDs",
  ux: "UX",
  epics: "Epics",
};

const SECTION_ORDER: Record<string, string[]> = {
  requirements: ["registry", "intake"],
  planning: ["architecture", "prds", "ux", "epics"],
};

type ExplorerNode = { kind: "folder"; id: string; label: string; children: ExplorerNode[] } | { kind: "file"; doc: DocRecord };

function countFiles(node: ExplorerNode): number {
  if (node.kind === "file") return 1;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function sortNodes(nodes: ExplorerNode[], category?: string): ExplorerNode[] {
  const folders = nodes.filter((n): n is Extract<ExplorerNode, { kind: "folder" }> => n.kind === "folder");
  const files = nodes.filter((n): n is Extract<ExplorerNode, { kind: "file" }> => n.kind === "file");

  const sectionOrder = category ? SECTION_ORDER[category] : undefined;
  folders.sort((a, b) => {
    if (sectionOrder) {
      const ai = sectionOrder.indexOf(a.id.split("/")[1] ?? "");
      const bi = sectionOrder.indexOf(b.id.split("/")[1] ?? "");
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    return a.label.localeCompare(b.label);
  });

  files.sort((a, b) => a.doc.title.localeCompare(b.doc.title));

  return [...folders.map((f) => ({ ...f, children: sortNodes(f.children, f.id.split("/")[0]) })), ...files];
}

function buildExplorerTree(groups: Map<string, DocRecord[]>): ExplorerNode[] {
  const categories = new Map<string, Extract<ExplorerNode, { kind: "folder" }>>();

  for (const [key, docs] of groups) {
    const [category, section] = key.split("/");

    if (!categories.has(category)) {
      categories.set(category, {
        kind: "folder",
        id: category,
        label: CATEGORY_LABELS[category] ?? category,
        children: [],
      });
    }
    const categoryFolder = categories.get(category)!;

    if (section) {
      categoryFolder.children.push({
        kind: "folder",
        id: key,
        label: SECTION_LABELS[section] ?? section,
        children: docs.map((doc) => ({ kind: "file" as const, doc })),
      });
    } else {
      for (const doc of docs) {
        categoryFolder.children.push({ kind: "file", doc });
      }
    }
  }

  return CATEGORY_ORDER.filter((cat) => categories.has(cat)).map((cat) => {
    const folder = categories.get(cat)!;
    return { ...folder, children: sortNodes(folder.children, cat) };
  });
}

function folderIdsForDoc(groups: Map<string, DocRecord[]>, selectedPath: string): string[] {
  for (const [key, docs] of groups) {
    if (!docs.some((d) => d.path === selectedPath)) continue;
    const [category] = key.split("/");
    return key.includes("/") ? [category, key] : [category];
  }
  return [];
}

interface DocExplorerProps {
  groups: Map<string, DocRecord[]>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function DocExplorer({ groups, selectedPath, onSelect }: DocExplorerProps) {
  const tree = useMemo(() => buildExplorerTree(groups), [groups]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selectedPath) return;
    const ids = folderIdsForDoc(groups, selectedPath);
    if (ids.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, [selectedPath, groups]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-0.5 p-2">
      {tree.map((node) => (
        <ExplorerNodeView
          key={node.kind === "folder" ? node.id : node.doc.path}
          node={node}
          depth={0}
          expanded={expanded}
          selectedPath={selectedPath}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ExplorerNodeView({
  node,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
}: {
  node: ExplorerNode;
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (id: string) => void;
  onSelect: (path: string) => void;
}) {
  if (node.kind === "file") {
    return <FileRow doc={node.doc} depth={depth} isSelected={selectedPath === node.doc.path} onSelect={onSelect} />;
  }

  const isOpen = expanded.has(node.id);
  const pad = 6 + depth * 12;

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-1.5 text-left transition-colors hover:bg-accent/50"
        style={{ paddingLeft: pad }}
        aria-expanded={isOpen}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150", isOpen && "rotate-90")} />
        {isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-heading/75" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/90">{node.label}</span>
        <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6rem] tabular-nums text-muted-foreground">
          {countFiles(node)}
        </span>
      </button>

      {isOpen &&
        node.children.map((child) => (
          <ExplorerNodeView
            key={child.kind === "file" ? child.doc.path : child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function FileRow({ doc, depth, isSelected, onSelect }: { doc: DocRecord; depth: number; isSelected: boolean; onSelect: (path: string) => void }) {
  const isYaml = doc.path.endsWith(".yaml") || doc.path.endsWith(".yml");
  const FileIcon = isYaml ? FileCode : FileText;
  const pad = 6 + depth * 12 + 18;

  return (
    <button
      type="button"
      title={doc.path}
      onClick={() => onSelect(doc.path)}
      className={cn(
        "flex w-full min-w-0 items-start gap-1.5 rounded-md py-1 pr-1.5 text-left transition-colors hover:bg-accent/50",
        isSelected && "bg-accent text-foreground"
      )}
      style={{ paddingLeft: pad }}
    >
      <FileIcon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isSelected ? "text-heading" : "text-muted-foreground/70")} />
      <span className={cn("truncate text-xs leading-snug", isSelected ? "text-foreground" : "text-muted-foreground")}>
        {inlineMarkdown(doc.title)}
      </span>
    </button>
  );
}
