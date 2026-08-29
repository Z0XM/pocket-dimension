import type { FeatureRecord, StoryRecord } from "@/types/dashboard";
import { areaDescription, displayAreaLabel, sortAreaIds } from "../../server/featureAreas";
import { summarizeAreaStatus, type AreaStatusSummary } from "@/lib/featureStatus";
import type { RuntimeModule } from "@/lib/moduleScope";
import { shouldShowModuleScopeControl } from "@/lib/moduleScope";

export type AreaGroup = {
  id: string;
  label: string;
  blurb: string;
  count: number;
  features: FeatureRecord[];
  status: AreaStatusSummary;
};

export type ModuleAreaGroup = {
  moduleId: string;
  moduleLabel: string;
  areas: AreaGroup[];
  featureCount: number;
  status: AreaStatusSummary;
};

/** Nested Project areas only for multi-Module view-all. */
export function shouldNestFeaturesByModule(modules: RuntimeModule[], moduleScope: string): boolean {
  return shouldShowModuleScopeControl(modules) && moduleScope === "all";
}

export function areaFilterKey(moduleId: string | undefined, areaId: string): string {
  return moduleId ? `${moduleId}::${areaId}` : areaId;
}

export function parseAreaFilterKey(key: string): { moduleId?: string; areaId: string } {
  const sep = key.indexOf("::");
  if (sep <= 0) return { areaId: key };
  return { moduleId: key.slice(0, sep), areaId: key.slice(sep + 2) };
}

function buildAreaGroup(areaId: string, features: FeatureRecord[], storiesByEpic: Map<string, StoryRecord[]>): AreaGroup {
  return {
    id: areaId,
    label: displayAreaLabel(
      areaId,
      features.map((f) => f.area)
    ),
    blurb: areaDescription(areaId),
    count: features.length,
    features,
    status: summarizeAreaStatus(features, storiesByEpic),
  };
}

/** Flat area list (single Module / flat mode). */
export function groupFeaturesByArea(features: FeatureRecord[], storiesByEpic: Map<string, StoryRecord[]>): AreaGroup[] {
  const present = new Map<string, FeatureRecord[]>();
  for (const f of features) {
    const list = present.get(f.areaId) ?? [];
    list.push(f);
    present.set(f.areaId, list);
  }
  return sortAreaIds(present.keys()).map((id) => buildAreaGroup(id, present.get(id)!, storiesByEpic));
}

/**
 * Enabled Modules (config order) → areas under each.
 * Modules with no matching features still appear (empty areas).
 */
export function groupFeaturesByModuleThenArea(
  features: FeatureRecord[],
  modules: RuntimeModule[],
  storiesByEpic: Map<string, StoryRecord[]>
): ModuleAreaGroup[] {
  const byModule = new Map<string, FeatureRecord[]>();
  for (const f of features) {
    const mid = f.moduleId ?? "unknown";
    const list = byModule.get(mid) ?? [];
    list.push(f);
    byModule.set(mid, list);
  }

  return modules.map((mod) => {
    const modFeatures = byModule.get(mod.id) ?? [];
    const areas = groupFeaturesByArea(modFeatures, storiesByEpic);
    return {
      moduleId: mod.id,
      moduleLabel: mod.label,
      areas,
      featureCount: modFeatures.length,
      status: summarizeAreaStatus(modFeatures, storiesByEpic),
    };
  });
}

export function featureMatchesAreaFilter(feature: FeatureRecord, activeArea: string | "all", nested: boolean): boolean {
  if (activeArea === "all") return true;
  if (!nested) return feature.areaId === activeArea;
  const { moduleId, areaId } = parseAreaFilterKey(activeArea);
  if (moduleId && feature.moduleId !== moduleId) return false;
  return feature.areaId === areaId;
}
