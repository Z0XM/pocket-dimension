import type { EpicRecord, StoryRecord, StoryStatus } from "./types.js";

export type TimelineFilter = "all" | "active" | "remaining" | "done";
export type SliceProcessStatus = "done" | "in-progress" | "backlog";

/** Matches Overview "Active now": in-progress + review only. */
export const ACTIVE_STORY_STATUSES = new Set<StoryStatus>(["in-progress", "review"]);

/** Not yet done — full unfinished queue for process view. */
export const REMAINING_STORY_STATUSES = new Set<StoryStatus>(["backlog", "ready-for-dev", "in-progress", "review", "blocked"]);

export function epicMatchesFilter(epic: EpicRecord, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return epic.status === "in-progress";
  if (filter === "done") return epic.status === "done";
  return epic.status !== "done";
}

export function storyMatchesFilter(story: StoryRecord, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return ACTIVE_STORY_STATUSES.has(story.status);
  if (filter === "done") return story.status === "done";
  return REMAINING_STORY_STATUSES.has(story.status);
}

export function sliceStatus(stories: StoryRecord[]): SliceProcessStatus {
  if (stories.length === 0) return "backlog";
  if (stories.every((s) => s.status === "done")) return "done";
  if (stories.some((s) => s.status !== "backlog")) return "in-progress";
  return "backlog";
}

export function currentEpicId(epics: EpicRecord[]): string | undefined {
  return epics.find((e) => e.status === "in-progress")?.id ?? epics.find((e) => e.status === "backlog")?.id;
}

/** First in-progress slice, else first backlog slice (frontier fallback). */
export function currentSliceIndex(slices: { storyIds: string[] }[], storyMap: Map<string, StoryRecord>): number {
  const statuses = slices.map((slice) => sliceStatus(slice.storyIds.map((id) => storyMap.get(id)).filter((s): s is StoryRecord => Boolean(s))));
  const inProgress = statuses.findIndex((s) => s === "in-progress");
  if (inProgress >= 0) return inProgress;
  return statuses.findIndex((s) => s === "backlog");
}

export function resolveSliceStories(storyIds: string[], storyMap: Map<string, StoryRecord>): { stories: StoryRecord[]; missingIds: string[] } {
  const stories: StoryRecord[] = [];
  const missingIds: string[] = [];
  for (const id of storyIds) {
    const story = storyMap.get(id);
    if (story) stories.push(story);
    else missingIds.push(id);
  }
  return { stories, missingIds };
}

export function storiesOutsideSlices(stories: StoryRecord[], slices: { storyIds: string[] }[]): StoryRecord[] {
  const inSlice = new Set(slices.flatMap((s) => s.storyIds));
  return stories.filter((s) => !inSlice.has(s.id)).sort((a, b) => a.epicNumber - b.epicNumber || a.number - b.number);
}
