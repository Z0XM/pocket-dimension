import type { EpicRecord, FeatureRecord, StoryRecord } from "./types.js";
import { bmadFeatureId } from "./parseBmadOutputEpics.js";

/**
 * AD-11: when Feature Registry is missing/empty and bmad-output epics loaded,
 * synthesize one feature per epic. Ids must not look like SI F-N (AD-9).
 */
export function synthesizeFeaturesFromEpics(epics: EpicRecord[], stories: StoryRecord[], sourceByEpicId: Map<string, string>): FeatureRecord[] {
  const features: FeatureRecord[] = [];

  for (const epic of epics) {
    const source = sourceByEpicId.get(epic.id);
    if (!source) continue;

    const epicStories = stories.filter((s) => s.epicId === epic.id);
    const id = bmadFeatureId(source, { number: epic.number, code: epic.code });

    features.push({
      id,
      name: epic.title,
      epicId: epic.id,
      screens: [],
      status: epic.status,
      goal: epic.goal || undefined,
      includes: epicStories.map((s) => s.title),
      deferred: [],
      seeAlso: [],
      outOfScope: [],
      areaId: source,
      area: source,
    });
  }

  return features;
}
