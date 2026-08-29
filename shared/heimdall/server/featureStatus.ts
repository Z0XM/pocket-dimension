import type { FeatureRecord, StoryRecord } from "./types.js";

export type FeatureDeliveryStatus = "complete" | "in-progress" | "blocked" | "confirmed" | "pending";

export type FeatureStatusFilter = "all" | FeatureDeliveryStatus | "deferred";

export type AreaHealth = "all-complete" | "in-progress" | "blocked" | "confirmed" | "mixed";

export interface StoryProgress {
  done: number;
  total: number;
  blocked: boolean;
  active: boolean;
  allDone: boolean;
}

export interface AreaStatusSummary {
  health: AreaHealth;
  complete: number;
  inProgress: number;
  blocked: number;
  confirmed: number;
  pending: number;
  deferred: number;
  total: number;
}

const ACTIVE_STORY_STATUSES = new Set(["in-progress", "review"]);

export function storyProgress(stories: StoryRecord[]): StoryProgress {
  const total = stories.length;
  const done = stories.filter((s) => s.status === "done").length;
  return {
    done,
    total,
    blocked: stories.some((s) => s.status === "blocked"),
    active: stories.some((s) => ACTIVE_STORY_STATUSES.has(s.status)),
    allDone: total > 0 && done === total,
  };
}

export function deriveFeatureDeliveryStatus(feature: FeatureRecord, stories: StoryRecord[]): FeatureDeliveryStatus {
  const progress = storyProgress(stories);
  const registry = feature.status.trim().toLowerCase();

  if (progress.blocked) return "blocked";
  if (progress.active) return "in-progress";
  if (progress.total > 0 && !progress.allDone) {
    // Amendment features still delivering — not yet fully implemented.
    if (registry === "confirmed") return "confirmed";
    return "in-progress";
  }
  if (registry === "complete" || registry === "confirmed" || registry === "live") {
    return "complete";
  }

  return "pending";
}

export function featureHasDeferred(feature: FeatureRecord): boolean {
  return feature.deferred.length > 0;
}

export function featureMatchesStatusFilter(feature: FeatureRecord, stories: StoryRecord[], filter: FeatureStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "deferred") return featureHasDeferred(feature);
  return deriveFeatureDeliveryStatus(feature, stories) === filter;
}

export function deliveryStatusLabel(status: FeatureDeliveryStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "in-progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "confirmed":
      return "Confirmed (in flight)";
    case "pending":
      return "Pending";
  }
}

export function deliveryStatusBadgeVariant(status: FeatureDeliveryStatus): "done" | "in-progress" | "blocked" | "ready-for-dev" | "backlog" {
  switch (status) {
    case "complete":
      return "done";
    case "in-progress":
      return "in-progress";
    case "blocked":
      return "blocked";
    case "confirmed":
      return "ready-for-dev";
    case "pending":
      return "backlog";
  }
}

export function summarizeAreaStatus(features: FeatureRecord[], storiesByEpic: Map<string, StoryRecord[]>): AreaStatusSummary {
  const counts = {
    complete: 0,
    inProgress: 0,
    blocked: 0,
    confirmed: 0,
    pending: 0,
    deferred: 0,
  };

  for (const feature of features) {
    const stories = storiesByEpic.get(feature.epicId) ?? [];
    const status = deriveFeatureDeliveryStatus(feature, stories);
    counts[status === "in-progress" ? "inProgress" : status]++;
    if (featureHasDeferred(feature)) counts.deferred++;
  }

  const total = features.length;
  let health: AreaHealth = "mixed";

  if (total === 0) {
    health = "mixed";
  } else if (counts.blocked > 0) {
    health = "blocked";
  } else if (counts.inProgress > 0 || counts.pending > 0) {
    health = "in-progress";
  } else if (counts.confirmed > 0 && counts.complete === 0) {
    health = "confirmed";
  } else if (counts.complete === total) {
    health = "all-complete";
  } else if (counts.complete + counts.confirmed === total) {
    health = "confirmed";
  }

  return { health, ...counts, total };
}

export function areaHealthTitle(summary: AreaStatusSummary): string {
  const parts: string[] = [];
  if (summary.complete > 0) parts.push(`${summary.complete} complete`);
  if (summary.inProgress > 0) parts.push(`${summary.inProgress} in progress`);
  if (summary.blocked > 0) parts.push(`${summary.blocked} blocked`);
  if (summary.confirmed > 0) parts.push(`${summary.confirmed} in flight`);
  if (summary.pending > 0) parts.push(`${summary.pending} pending`);
  if (summary.deferred > 0) parts.push(`${summary.deferred} with deferred items`);
  return parts.join(" · ") || "No features";
}
