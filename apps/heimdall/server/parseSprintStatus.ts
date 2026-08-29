import { readFileSync } from "node:fs";
import type { EpicStatus, RetrospectiveRecord, StoryStatus } from "./types.js";

export interface SprintStatusData {
  project: string;
  lastUpdated: string;
  epicStatuses: Map<string, EpicStatus>;
  storyStatuses: Map<string, StoryStatus>;
  retrospectives: RetrospectiveRecord[];
}

const VALID_STORY: StoryStatus[] = ["backlog", "ready-for-dev", "in-progress", "review", "blocked", "done"];

const VALID_EPIC: EpicStatus[] = ["backlog", "in-progress", "done"];

function normalizeStoryStatus(raw: string): StoryStatus {
  if (raw === "drafted") return "ready-for-dev";
  // Course-corrected work is closed, not leftover backlog (same honesty rule as Epic 24).
  if (raw === "superseded") return "done";
  if (VALID_STORY.includes(raw as StoryStatus)) return raw as StoryStatus;
  return "backlog";
}

function normalizeEpicStatus(raw: string): EpicStatus {
  if (raw === "contexted") return "in-progress";
  if (VALID_EPIC.includes(raw as EpicStatus)) return raw as EpicStatus;
  return "backlog";
}

export function parseSprintStatus(content: string): SprintStatusData {
  const epicStatuses = new Map<string, EpicStatus>();
  const storyStatuses = new Map<string, StoryStatus>();
  const retrospectives: RetrospectiveRecord[] = [];

  let project = "project";
  let lastUpdated = "";

  const lines = content.split("\n");
  let inDevStatus = false;

  for (const line of lines) {
    if (line.startsWith("project:")) {
      project = line.replace("project:", "").trim();
    }
    if (line.startsWith("last_updated:")) {
      lastUpdated = line.replace("last_updated:", "").trim();
    }
    if (line.trim() === "development_status:") {
      inDevStatus = true;
      continue;
    }
    if (!inDevStatus) continue;

    const match = line.match(/^  ([^:]+):\s*(.+)$/);
    if (!match) continue;

    const [, key, rawStatus] = match;
    const status = rawStatus.trim();

    if (key.match(/^epic-(?:\d+|c1-\d+|swe-\d+)-retrospective$/)) {
      retrospectives.push({
        epicId: key.replace("-retrospective", ""),
        status: status === "done" ? "done" : "optional",
      });
    } else if (key.match(/^epic-(?:\d+|c1-\d+|swe-\d+)$/)) {
      epicStatuses.set(key, normalizeEpicStatus(status));
    } else {
      storyStatuses.set(key, normalizeStoryStatus(status));
    }
  }

  return { project, lastUpdated, epicStatuses, storyStatuses, retrospectives };
}

export function parseSprintStatusFile(filePath: string): SprintStatusData {
  return parseSprintStatus(readFileSync(filePath, "utf-8"));
}

export function storyKey(epicNumber: number, storyNumber: number): string {
  return `${epicNumber}-${storyNumber}-${""}`.replace(/-$/, "") || `${epicNumber}-${storyNumber}`;
}

export function storySlug(epicNumber: number, storyNumber: number, titleSlug?: string): string {
  if (titleSlug) return `${epicNumber}-${storyNumber}-${titleSlug}`;
  return `${epicNumber}-${storyNumber}`;
}

export function parseStoryId(storyId: string): { epicNumber: number; storyNumber: number } | null {
  const match = storyId.match(/^(\d+)-(\d+)/);
  if (!match) return null;
  return { epicNumber: Number(match[1]), storyNumber: Number(match[2]) };
}

export function findStoryStatusKey(
  epicNumber: number,
  storyNumber: number,
  storyStatuses: Map<string, StoryStatus>,
  /** When set (track/Module source slug), prefer `${sourceSlug}/N-M-…` keys from merged sprint files. */
  sourceSlug?: string
): StoryStatus | undefined {
  const exact = `${epicNumber}-${storyNumber}`;
  const prefix = `${epicNumber}-${storyNumber}-`;

  if (sourceSlug) {
    const scopedExact = `${sourceSlug}/${exact}`;
    const scopedPrefix = `${sourceSlug}/${prefix}`;
    for (const [key, status] of storyStatuses) {
      if (key === scopedExact || key.startsWith(scopedPrefix)) {
        return status;
      }
    }
    // If any project-scoped keys exist, do not fall back to bare N-M (avoids T6/T7 cross-talk).
    for (const key of storyStatuses.keys()) {
      if (key.includes("/")) return undefined;
    }
  }

  for (const [key, status] of storyStatuses) {
    if (key.includes("/")) continue;
    if (key === exact || key.startsWith(prefix)) {
      return status;
    }
  }
  return undefined;
}

/** Match C1 sprint keys like `c1-1-1-rewrite-ad13-...`. */
export function findC1StoryStatusKey(major: number, minor: number, storyStatuses: Map<string, StoryStatus>): StoryStatus | undefined {
  return findPrefixedStoryStatusKey("c1", major, minor, storyStatuses);
}

/** Match SWE sprint keys like `swe-1-1-implement-regenerable-...`. */
export function findSweStoryStatusKey(major: number, minor: number, storyStatuses: Map<string, StoryStatus>): StoryStatus | undefined {
  return findPrefixedStoryStatusKey("swe", major, minor, storyStatuses);
}

function findPrefixedStoryStatusKey(
  prefixToken: string,
  major: number,
  minor: number,
  storyStatuses: Map<string, StoryStatus>
): StoryStatus | undefined {
  const exact = `${prefixToken}-${major}-${minor}`;
  const prefix = `${prefixToken}-${major}-${minor}-`;
  for (const [key, status] of storyStatuses) {
    if (key === exact || key.startsWith(prefix)) {
      return status;
    }
  }
  return undefined;
}

export function mergeSprintStatus(primary: SprintStatusData, secondary: SprintStatusData): SprintStatusData {
  const epicStatuses = new Map(primary.epicStatuses);
  for (const [k, v] of secondary.epicStatuses) {
    epicStatuses.set(k, v);
    if (secondary.project) {
      epicStatuses.set(`${secondary.project}/${k}`, v);
    }
  }

  const storyStatuses = new Map(primary.storyStatuses);
  for (const [k, v] of secondary.storyStatuses) {
    storyStatuses.set(k, v);
    if (secondary.project) {
      storyStatuses.set(`${secondary.project}/${k}`, v);
    }
  }

  const retrospectives = [...primary.retrospectives];
  const seen = new Set(retrospectives.map((r) => r.epicId));
  for (const r of secondary.retrospectives) {
    if (!seen.has(r.epicId)) {
      retrospectives.push(r);
      seen.add(r.epicId);
    }
  }

  const lastUpdated = [primary.lastUpdated, secondary.lastUpdated].filter(Boolean).sort().at(-1) ?? primary.lastUpdated;

  return {
    project: primary.project,
    lastUpdated,
    epicStatuses,
    storyStatuses,
    retrospectives,
  };
}
