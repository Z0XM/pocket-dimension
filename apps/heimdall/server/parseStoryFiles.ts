import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoryStatus, TaskProgress } from "./types.js";

export interface ParsedStoryFile {
  slug: string;
  epicNumber: number;
  storyNumber: number;
  /** Map key for loadStoryFiles (numeric `12-5`, C1 `c1-1-1`, or SWE `swe-1-1`). */
  lookupKey: string;
  title: string;
  status?: StoryStatus;
  blockers: string[];
  taskProgress: TaskProgress;
  blockingSection?: string;
  devNotes?: string;
  rawContent: string;
  filePath: string;
}

function parseTaskProgress(content: string): TaskProgress {
  const checkboxes = content.match(/^(\s*)- \[([ xX])\]/gm) ?? [];
  let completed = 0;
  for (const cb of checkboxes) {
    if (cb.includes("[x]") || cb.includes("[X]")) completed++;
  }
  return { completed, total: checkboxes.length };
}

function parseStatus(content: string): StoryStatus | undefined {
  const match = content.match(/^Status:\s*(.+)$/m);
  if (!match) return undefined;
  const raw = match[1].trim().replace(/^\*\*|\*\*$/g, "");
  if (raw === "drafted") return "ready-for-dev";
  return raw as StoryStatus;
}

function parseTitle(content: string, slug: string): string {
  const h1C1 = content.match(/^#\s+Story\s+C1\.\d+\.\d+:\s*(.+)$/m);
  if (h1C1) return h1C1[1].trim();
  const h1Swe = content.match(/^#\s+Story\s+SWE\.\d+\.\d+:\s*(.+)$/m);
  if (h1Swe) return h1Swe[1].trim();
  const h1 = content.match(/^#\s+Story\s+\d+\.\d+:\s*(.+)$/m);
  if (h1) return h1[1].trim();
  const parts = slug.split("-").slice(2);
  return parts.join(" ").replace(/-/g, " ");
}

function parseBlockers(content: string): { blockers: string[]; blockingSection?: string } {
  const section = content.match(/## (?:Blocking Dependencies|Blockers)([\s\S]*?)(?=\n## |$)/);
  if (!section) return { blockers: [] };

  const blockingSection = section[1].trim();
  const blockers: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    blockers.push(trimmed);
  };

  const tagMatches = blockingSection.match(/\[BLOCKED:\s*(EXT-\d+|Epic\s+\d+[^\]]*|Story\s+\d+\.\d+[^\]]*)\]/g);
  if (tagMatches) {
    for (const m of tagMatches) {
      push(m.replace(/\[BLOCKED:\s*|\]/g, ""));
    }
  }

  const numbered = blockingSection.match(/^\d+\.\s+\*\*\[BLOCKED:[^\]]+\]\*\*\s*(.+)$/gm);
  if (numbered) {
    for (const line of numbered) {
      const m = line.match(/^\d+\.\s+\*\*\[BLOCKED:[^\]]+\]\*\*\s*(.+)$/);
      if (m) push(m[1]);
    }
  }

  return { blockers, blockingSection };
}

function parseDevNotes(content: string): string | undefined {
  const section = content.match(/## Dev Notes([\s\S]*?)(?=\n## |$)/);
  return section?.[1]?.trim();
}

export function parseStoryFileContent(content: string, filePath: string, slug: string): ParsedStoryFile {
  const c1Match = slug.match(/^c1-(\d+)-(\d+)-/);
  const sweMatch = slug.match(/^swe-(\d+)-(\d+)-/);
  const numMatch = slug.match(/^(\d+)-(\d+)-/);
  const epicNumber = c1Match ? Number(c1Match[1]) : sweMatch ? Number(sweMatch[1]) : numMatch ? Number(numMatch[1]) : 0;
  const storyNumber = c1Match ? Number(c1Match[2]) : sweMatch ? Number(sweMatch[2]) : numMatch ? Number(numMatch[2]) : 0;
  const lookupKey = c1Match ? `c1-${epicNumber}-${storyNumber}` : sweMatch ? `swe-${epicNumber}-${storyNumber}` : `${epicNumber}-${storyNumber}`;

  const { blockers, blockingSection } = parseBlockers(content);

  return {
    slug,
    epicNumber,
    storyNumber,
    lookupKey,
    title: parseTitle(content, slug),
    status: parseStatus(content),
    blockers,
    taskProgress: parseTaskProgress(content),
    blockingSection,
    devNotes: parseDevNotes(content),
    rawContent: content,
    filePath,
  };
}

export function loadStoryFiles(implDir: string): Map<string, ParsedStoryFile> {
  const files = new Map<string, ParsedStoryFile>();

  let entries: string[];
  try {
    entries = readdirSync(implDir).filter((f) => f.endsWith(".md"));
  } catch {
    return files;
  }

  for (const entry of entries) {
    const slug = entry.replace(/\.md$/, "");
    // Skip non-story notes (e.g. deferred-work.md)
    if (!/^(\d+-\d+-|c1-\d+-\d+-|swe-\d+-\d+-)/.test(slug)) continue;
    const filePath = join(implDir, entry);
    const content = readFileSync(filePath, "utf-8");
    const parsed = parseStoryFileContent(content, filePath, slug);
    files.set(parsed.lookupKey, parsed);
  }

  return files;
}
