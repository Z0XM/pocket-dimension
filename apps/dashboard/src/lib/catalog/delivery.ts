import { mapStatusLabel, type StoryStatus } from "$lib/catalog/status";
import type { ArtifactRef } from "$lib/types";

export type DeliveryView = "board" | "table" | "timeline";

export type DeliveryItem = {
  id: string;
  title: string;
  kind: "epic" | "story";
  sourcePath: string;
  status: StoryStatus;
  statusLabel: string;
  epicNumber: number | null;
};

export type DeliveryTimelineGroup = {
  epicNumber: number | null;
  epics: DeliveryItem[];
  stories: DeliveryItem[];
};

const VALID_VIEWS = new Set<DeliveryView>(["board", "table", "timeline"]);
const STORY_EPIC_NUMBER = /^(\d+)-\d+-/;
const EPIC_NUMBER_PREFIX = /^(\d+)-epic-/i;
const EPIC_NUMBER_TOKEN = /epic-(\d+)/i;
const PACK_EPIC_BASENAME = /^(epics\.md|epics-.*\.md)$/i;

/** Parse development_status map; null if missing/unparseable. Never invent keys. */
export function parseSprintStatusYaml(text: string): Map<string, string> | null {
  try {
    const parsed = Bun.YAML.parse(text) as Record<string, unknown>;
    const developmentStatus = parsed?.development_status;

    if (!developmentStatus || typeof developmentStatus !== "object" || Array.isArray(developmentStatus)) {
      return null;
    }

    const map = new Map<string, string>();
    for (const [key, value] of Object.entries(developmentStatus as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim().length > 0) {
        map.set(key, value.trim());
      }
    }

    return map;
  } catch {
    return null;
  }
}

/** Match sprint-status key → ArtifactRef (story stem or epic-N). */
export function sprintStatusKeyForArtifact(artifact: Pick<ArtifactRef, "artifactKind" | "sourcePath">): string | null {
  const basename = basenameFromPath(artifact.sourcePath);
  const stem = stripExtension(basename);

  if (artifact.artifactKind === "story") {
    return stem;
  }

  if (artifact.artifactKind === "epic") {
    if (PACK_EPIC_BASENAME.test(basename)) {
      return null;
    }

    const prefixMatch = stem.match(EPIC_NUMBER_PREFIX);
    if (prefixMatch) {
      return `epic-${prefixMatch[1]}`;
    }

    const tokenMatch = stem.match(EPIC_NUMBER_TOKEN);
    if (tokenMatch) {
      return `epic-${tokenMatch[1]}`;
    }
  }

  return null;
}

/** Precedence: sprint map → Status: fields on ref → unknown. */
export function resolveItemStatus(artifact: ArtifactRef, sprintMap: Map<string, string> | null): { status: StoryStatus; statusLabel: string } {
  if (sprintMap) {
    const key = sprintStatusKeyForArtifact(artifact);
    if (key) {
      const raw = sprintMap.get(key);
      if (raw && raw.trim().length > 0) {
        return mapStatusLabel(raw);
      }
    }
  }

  if (artifact.status && artifact.statusLabel) {
    return { status: artifact.status, statusLabel: artifact.statusLabel };
  }

  if (artifact.statusLabel) {
    return mapStatusLabel(artifact.statusLabel);
  }

  return { status: "unknown", statusLabel: "unknown" };
}

/** One projection: epic + story Kind only; omit unclassified/docs/prd/…. */
export function projectDelivery(artifacts: ArtifactRef[], sprintMap: Map<string, string> | null): DeliveryItem[] {
  const deliveryArtifacts = artifacts.filter(
    (artifact): artifact is ArtifactRef & { artifactKind: "epic" | "story" } => artifact.artifactKind === "epic" || artifact.artifactKind === "story"
  );

  return deliveryArtifacts.map((artifact) => {
    const resolved = resolveItemStatus(artifact, sprintMap);
    return {
      id: artifact.id,
      title: artifact.title,
      kind: artifact.artifactKind,
      sourcePath: artifact.sourcePath,
      status: resolved.status,
      statusLabel: resolved.statusLabel,
      epicNumber: epicNumberFromArtifact(artifact),
    };
  });
}

export function parseDeliveryView(raw: string | null): DeliveryView {
  if (raw && VALID_VIEWS.has(raw as DeliveryView)) {
    return raw as DeliveryView;
  }

  return "board";
}

/** Board column order for Delivery views. */
export const DELIVERY_BOARD_COLUMNS: readonly StoryStatus[] = ["backlog", "in-progress", "done", "unknown"] as const;

/** Group items for Timeline: numbered epics first, then unnumbered. */
export function groupDeliveryForTimeline(items: DeliveryItem[]): DeliveryTimelineGroup[] {
  const byNumber = new Map<number | "other", DeliveryTimelineGroup>();

  for (const item of items) {
    const key = item.epicNumber ?? "other";
    let group = byNumber.get(key);
    if (!group) {
      group = { epicNumber: item.epicNumber, epics: [], stories: [] };
      byNumber.set(key, group);
    }

    if (item.kind === "epic") {
      group.epics.push(item);
    } else {
      group.stories.push(item);
    }
  }

  for (const group of byNumber.values()) {
    group.epics.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
    group.stories.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  }

  const numbered = [...byNumber.entries()]
    .filter(([key]) => key !== "other")
    .sort(([a], [b]) => (a as number) - (b as number))
    .map(([, group]) => group);

  const other = byNumber.get("other");
  if (other && (other.epics.length > 0 || other.stories.length > 0)) {
    numbered.push(other);
  }

  return numbered;
}

function epicNumberFromArtifact(artifact: ArtifactRef): number | null {
  const basename = basenameFromPath(artifact.sourcePath);
  const stem = stripExtension(basename);

  if (artifact.artifactKind === "story") {
    const match = stem.match(STORY_EPIC_NUMBER);
    return match ? Number.parseInt(match[1]!, 10) : null;
  }

  if (artifact.artifactKind === "epic") {
    const prefixMatch = stem.match(EPIC_NUMBER_PREFIX);
    if (prefixMatch) {
      return Number.parseInt(prefixMatch[1]!, 10);
    }

    const tokenMatch = stem.match(EPIC_NUMBER_TOKEN);
    if (tokenMatch) {
      return Number.parseInt(tokenMatch[1]!, 10);
    }
  }

  return null;
}

function basenameFromPath(sourcePath: string): string {
  return sourcePath.split("/").pop() ?? sourcePath;
}

function stripExtension(basename: string): string {
  return basename.replace(/\.(md|ya?ml)$/i, "");
}
