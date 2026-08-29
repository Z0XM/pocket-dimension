import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isBuiltinEpicParser, type HeimdallConfig } from "../src/config/schema.js";
import { listEnabledModules, resolveModules, type ResolvedModule, type ResolvedModulePlanningPaths } from "../src/config/resolveModules.js";
import { parseEpics, storyRouteId } from "./parseEpics.js";
import { bmadEpicId, bmadStoryId, epicSourceSlug, parseBmadOutputEpics, type BmadOutputEpic } from "./parseBmadOutputEpics.js";
import { parseExternalGaps } from "./parseExternalGaps.js";
import { parseFeatureRegistry, featuresByEpic } from "./parseFeatureRegistry.js";
import { parseDeferredItems } from "./parseDeferredItems.js";
import { parseOpenQuestions } from "./parseOpenQuestions.js";
import { parseProjectContext } from "./parseProjectContext.js";
import { findStoryStatusKey, mergeSprintStatus, parseSprintStatusFile, type SprintStatusData } from "./parseSprintStatus.js";
import { loadStoryFiles } from "./parseStoryFiles.js";
import { synthesizeFeaturesFromEpics } from "./synthesizeFeatures.js";
import type {
  DashboardSnapshot,
  DeferredItem,
  EpicRecord,
  EpicStatus,
  ExternalGap,
  FeatureRecord,
  OpenQuestion,
  StoryCounts,
  StoryRecord,
  StoryStatus,
} from "./types.js";

function emptyStoryCounts(): StoryCounts {
  return {
    backlog: 0,
    readyForDev: 0,
    inProgress: 0,
    review: 0,
    blocked: 0,
    done: 0,
    total: 0,
  };
}

function incrementCount(counts: StoryCounts, status: StoryStatus): void {
  counts.total++;
  switch (status) {
    case "backlog":
      counts.backlog++;
      break;
    case "ready-for-dev":
      counts.readyForDev++;
      break;
    case "in-progress":
      counts.inProgress++;
      break;
    case "review":
      counts.review++;
      break;
    case "blocked":
      counts.blocked++;
      break;
    case "done":
      counts.done++;
      break;
  }
}

function readOptional(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function emptySprint(): SprintStatusData {
  return {
    project: "heimdall",
    lastUpdated: "",
    epicStatuses: new Map(),
    storyStatuses: new Map(),
    retrospectives: [],
  };
}

/** Internal epic before status/feature wiring. */
interface LoadedEpic {
  id: string;
  number: number;
  code?: string;
  title: string;
  goal: string;
  isEnabler: boolean;
  approvalTag?: string;
  isSuperseded: boolean;
  /** Sprint yaml key `epic-N` (AD-10). */
  sprintEpicKey: string;
  /** Set for bmad-output sources (Feature Synthesis). */
  sourceSlug?: string;
  stories: {
    id: string;
    epicNumber: number;
    number: number;
    code?: string;
    title: string;
    userStory?: string;
    acceptanceCriteria?: string;
    lookupKey: string;
  }[];
}

interface PlanningSurfaces {
  loadedEpics: LoadedEpic[];
  deliverySlices: { name: string; storyIds: string[] }[];
  features: FeatureRecord[];
  externalGaps: ExternalGap[];
  openQuestions: OpenQuestion[];
  deferredItems: DeferredItem[];
}

function fromNumericParse(
  parsed: ReturnType<typeof parseEpics>,
  moduleId?: string
): { epics: LoadedEpic[]; deliverySlices: { name: string; storyIds: string[] }[] } {
  const epics: LoadedEpic[] = parsed.epics.map((epic) => ({
    id: moduleId ? `epic-${moduleId}-${epic.number}` : `epic-${epic.number}`,
    number: epic.number,
    title: epic.title,
    goal: epic.goal,
    isEnabler: epic.isEnabler,
    approvalTag: epic.approvalTag,
    isSuperseded: epic.isSuperseded,
    sprintEpicKey: `epic-${epic.number}`,
    stories: epic.stories.map((story) => ({
      id: moduleId ? `${moduleId}-${story.epicNumber}-${story.storyNumber}` : storyRouteId(story.epicNumber, story.storyNumber),
      epicNumber: story.epicNumber,
      number: story.storyNumber,
      title: story.title,
      userStory: story.userStory,
      acceptanceCriteria: story.acceptanceCriteria,
      lookupKey: `${story.epicNumber}-${story.storyNumber}`,
    })),
  }));

  const lookupToStoryId = new Map<string, string>();
  for (const epic of epics) {
    for (const story of epic.stories) {
      lookupToStoryId.set(story.lookupKey, story.id);
    }
  }

  const deliverySlices = parsed.deliverySlices.map((slice) => ({
    name: slice.name,
    storyIds: slice.storyIds.map((sid) => lookupToStoryId.get(sid) ?? sid),
  }));

  return { epics, deliverySlices };
}

function fromBmadEpic(epic: BmadOutputEpic): LoadedEpic {
  const id = bmadEpicId(epic.source, epic);
  return {
    id,
    number: epic.number,
    code: epic.code,
    title: epic.title,
    goal: epic.goal,
    isEnabler: epic.isEnabler,
    approvalTag: epic.approvalTag,
    isSuperseded: epic.isSuperseded,
    sprintEpicKey: `epic-${epic.number}`,
    sourceSlug: epic.source,
    stories: epic.stories.map((story) => ({
      id: bmadStoryId(epic.source, epic, story),
      epicNumber: story.epicNumber,
      number: story.storyNumber,
      code: story.code,
      title: story.title,
      userStory: story.userStory,
      acceptanceCriteria: story.acceptanceCriteria,
      lookupKey: epic.code ? `${epic.code.toLowerCase().replace(/\./g, "-")}-${story.storyNumber}` : `${story.epicNumber}-${story.storyNumber}`,
    })),
  };
}

/** Bridge Epic titles force done status (FR-15). */
function isBridgeEpic(title: string): boolean {
  return /\bBridge:|\bHistorical:/.test(title);
}

function isEpicForceDone(epic: LoadedEpic): boolean {
  return epic.isSuperseded || isBridgeEpic(epic.title);
}

function buildEpicIdMap(loadedEpics: LoadedEpic[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const epic of loadedEpics) {
    map.set(`epic-${epic.number}`, epic.id);
    map.set(epic.id, epic.id);
  }
  return map;
}

function namespaceModuleFeatures(features: FeatureRecord[], moduleId: string, moduleLabel: string, epicIdMap: Map<string, string>): FeatureRecord[] {
  return features.map((f) => {
    const isFrRegistryId = /^F-\d+$/.test(f.id);
    if (isFrRegistryId) {
      return {
        ...f,
        id: `${moduleId}:${f.id}`,
        epicId: epicIdMap.get(f.epicId) ?? f.epicId,
        moduleId,
        moduleLabel,
      };
    }
    return { ...f, moduleId, moduleLabel };
  });
}

function attachModuleMeta<T extends { moduleId?: string; moduleLabel?: string; idPrefix?: string }>(
  records: T[],
  moduleId: string,
  moduleLabel: string,
  idPrefix?: string
): T[] {
  return records.map((r) => ({
    ...r,
    moduleId,
    moduleLabel,
    ...(idPrefix ? { idPrefix } : {}),
  }));
}

/** Load planning surfaces from resolved absolute Module paths (no second join with repoRoot). */
function loadPlanningSurfaces(
  planningPaths: ResolvedModulePlanningPaths,
  /** When set (Modules mode), use as bmad-output AD-9 source slug instead of path basename. */
  bmadSourceSlug?: string,
  /** When set (Modules mode), namespace numeric-parser ids. */
  numericModuleId?: string
): PlanningSurfaces {
  const loadedEpics: LoadedEpic[] = [];
  const deliverySlices: { name: string; storyIds: string[] }[] = [];

  for (const source of planningPaths.epics ?? []) {
    if (!isBuiltinEpicParser(source.parser)) {
      console.warn(`[heimdall] unknown epic parser "${source.parser}" for ${source.path} — skipping (soft-empty)`);
      continue;
    }

    if (source.parser === "numeric") {
      const raw = readOptional(source.path);
      if (!raw) continue;
      const parsed = fromNumericParse(parseEpics(raw), numericModuleId);
      loadedEpics.push(...parsed.epics);
      deliverySlices.push(...parsed.deliverySlices);
      continue;
    }

    const raw = readOptional(source.path);
    if (!raw) continue;
    const slug = bmadSourceSlug ?? epicSourceSlug(source.path);
    const parsed = parseBmadOutputEpics(raw, slug);
    for (const epic of parsed.epics) {
      loadedEpics.push(fromBmadEpic(epic));
    }
    deliverySlices.push(...parsed.deliverySlices);
  }

  const featuresRaw = planningPaths.featureRegistry ? readOptional(planningPaths.featureRegistry) : null;
  const features = featuresRaw ? parseFeatureRegistry(featuresRaw) : [];

  const extRaw = planningPaths.externalGaps ? readOptional(planningPaths.externalGaps) : null;
  const externalGaps = extRaw ? parseExternalGaps(extRaw) : [];

  const intakeRaw = planningPaths.intakeIndex ? readOptional(planningPaths.intakeIndex) : null;
  const openQuestions = intakeRaw ? parseOpenQuestions(intakeRaw) : [];

  const deferredRaw = planningPaths.deferredIndex ? readOptional(planningPaths.deferredIndex) : null;
  const deferredItems = deferredRaw ? parseDeferredItems(deferredRaw) : [];

  return { loadedEpics, deliverySlices, features, externalGaps, openQuestions, deferredItems };
}

/** Resolve scope to Enabled Modules to load (unknown/disabled → first Enabled). */
export function resolveScopeModules(scope: string | undefined, config: HeimdallConfig, repoRoot: string): ResolvedModule[] {
  const enabled = listEnabledModules(resolveModules(config, repoRoot));
  if (enabled.length === 0) return [];

  const trimmed = scope?.trim();
  if (trimmed === undefined || trimmed === "") {
    return enabled.length === 1 ? [enabled[0]!] : enabled;
  }

  if (trimmed === "all") return enabled;

  const match = enabled.find((mod) => mod.id === trimmed);
  return match ? [match] : [enabled[0]!];
}

/** Stable cache key for a dashboard scope query (FR-11 / AD-15). */
export function normalizeDashboardScopeKey(scope: string | undefined | null, config: HeimdallConfig, repoRoot: string): string {
  const modules = resolveScopeModules(scope ?? undefined, config, repoRoot);
  if (modules.length === 0) return "__empty__";
  if (modules.length === 1) return modules[0]!.id;
  return "all";
}

/** Enabled Module list for GET /runtime (FR-10, AD-17). */
export function runtimeModuleList(config: HeimdallConfig, repoRoot: string): Array<{ id: string; label: string }> {
  return listEnabledModules(resolveModules(config, repoRoot)).map((mod) => ({
    id: mod.id,
    label: mod.label,
  }));
}

function loadSharedSprint(repoRoot: string, config: HeimdallConfig): SprintStatusData {
  let sprint = emptySprint();
  for (const rel of config.paths.sprintStatus) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) continue;
    sprint = mergeSprintStatus(sprint, parseSprintStatusFile(abs));
  }
  return sprint;
}

function buildEmptyDashboard(sprint: SprintStatusData, projectContext: { moduleName: string; projectName: string }): DashboardSnapshot {
  return {
    meta: {
      project: sprint.project || "heimdall",
      moduleName: projectContext.moduleName,
      projectName: projectContext.projectName,
      lastUpdated: sprint.lastUpdated,
      generatedAt: new Date().toISOString(),
    },
    summary: {
      epics: { backlog: 0, "in-progress": 0, done: 0 },
      stories: {
        backlog: 0,
        "ready-for-dev": 0,
        "in-progress": 0,
        review: 0,
        blocked: 0,
        done: 0,
      },
      storyCompletionPct: 0,
      openBlockers: 0,
      openQuestions: 0,
      openExtGaps: 0,
      deferredItems: 0,
    },
    epics: [],
    stories: [],
    deliverySlices: [],
    features: [],
    externalGaps: [],
    openQuestions: [],
    deferredItems: [],
    retrospectives: sprint.retrospectives,
  };
}

function buildDashboardSnapshot(
  repoRoot: string,
  config: HeimdallConfig,
  modulesToLoad: ResolvedModule[],
  sprint: SprintStatusData,
  projectContext: { moduleName: string; projectName: string }
): DashboardSnapshot {
  const implDir = join(repoRoot, config.paths.implementationDir);
  const storyFiles = existsSync(implDir) ? loadStoryFiles(implDir) : new Map();
  const modulesMode = config.modules.length > 0;

  const epics: EpicRecord[] = [];
  const stories: StoryRecord[] = [];
  const deliverySlices: { name: string; storyIds: string[] }[] = [];
  let features: FeatureRecord[] = [];
  let externalGaps: ExternalGap[] = [];
  let openQuestions: OpenQuestion[] = [];
  let deferredItems: DeferredItem[] = [];

  for (const mod of modulesToLoad) {
    // Prefer AD-9 path slug (parent of epics.md) so multi-track Modules (T6/T7) keep unique epic ids.
    // Still namespace numeric-parser ids by Module id in Modules mode.
    const surfaces = loadPlanningSurfaces(mod.paths, undefined, modulesMode ? mod.id : undefined);

    let moduleFeatures = surfaces.features;
    const frPresentWithRows = moduleFeatures.length > 0;

    const moduleStories: StoryRecord[] = [];
    for (const epic of surfaces.loadedEpics) {
      for (const story of epic.stories) {
        const impl = storyFiles.get(story.lookupKey);
        const forceDone = isEpicForceDone(epic);

        const status: StoryStatus = forceDone
          ? "done"
          : (findStoryStatusKey(story.epicNumber, story.number, sprint.storyStatuses, epic.sourceSlug) ?? impl?.status ?? "backlog");

        moduleStories.push({
          id: story.id,
          epicId: epic.id,
          epicNumber: story.epicNumber,
          number: story.number,
          code: story.code,
          title: impl?.title ?? story.title,
          status,
          userStory: story.userStory,
          acceptanceCriteria: story.acceptanceCriteria,
          hasImplementationFile: Boolean(impl),
          implementationPath: impl?.filePath,
          taskProgress: impl?.taskProgress,
          blockers: impl?.blockers ?? [],
          featureIds: [],
        });
      }
    }

    const moduleEpics: EpicRecord[] = surfaces.loadedEpics.map((epic) => {
      const epicStories = moduleStories.filter((s) => s.epicId === epic.id);
      const storyCounts = emptyStoryCounts();
      for (const s of epicStories) incrementCount(storyCounts, s.status);

      const forceDone = isEpicForceDone(epic);
      const scopedEpicKey = epic.sourceSlug ? `${epic.sourceSlug}/${epic.sprintEpicKey}` : epic.sprintEpicKey;
      const status: EpicStatus = forceDone
        ? "done"
        : (sprint.epicStatuses.get(scopedEpicKey) ??
          (epic.sourceSlug && [...sprint.epicStatuses.keys()].some((k) => k.includes("/"))
            ? undefined
            : sprint.epicStatuses.get(epic.sprintEpicKey)) ??
          "backlog");

      return {
        id: epic.id,
        number: epic.number,
        code: epic.code,
        title: epic.title,
        goal: epic.goal,
        status,
        storyCounts,
        featureIds: [],
        isEnabler: epic.isEnabler,
        approvalTag: epic.approvalTag,
      };
    });

    if (!frPresentWithRows) {
      if (config.synthesizeFeaturesWhenRegistryMissing) {
        const bmadSourceByEpicId = new Map<string, string>();
        for (const e of surfaces.loadedEpics) {
          if (e.sourceSlug) bmadSourceByEpicId.set(e.id, e.sourceSlug);
        }
        if (bmadSourceByEpicId.size > 0) {
          moduleFeatures = synthesizeFeaturesFromEpics(moduleEpics, moduleStories, bmadSourceByEpicId);
        } else {
          moduleFeatures = [];
        }
      } else {
        moduleFeatures = [];
      }
    }

    const epicIdMap = buildEpicIdMap(surfaces.loadedEpics);
    if (modulesMode) {
      moduleFeatures = namespaceModuleFeatures(moduleFeatures, mod.id, mod.label, epicIdMap);
    }

    const epicFeatures = featuresByEpic(moduleFeatures);
    for (const epic of moduleEpics) {
      const list = epicFeatures.get(epic.id) ?? epicFeatures.get(`epic-${epic.number}`) ?? [];
      epic.featureIds = list.map((f) => f.id);
    }
    for (const story of moduleStories) {
      const list = epicFeatures.get(story.epicId) ?? [];
      story.featureIds = list.map((f) => f.id);
    }

    if (modulesMode) {
      epics.push(...attachModuleMeta(moduleEpics, mod.id, mod.label, mod.idPrefix));
      stories.push(...attachModuleMeta(moduleStories, mod.id, mod.label, mod.idPrefix));
    } else {
      epics.push(...moduleEpics);
      stories.push(...moduleStories);
    }

    deliverySlices.push(...surfaces.deliverySlices);
    features.push(...moduleFeatures);
    externalGaps.push(...surfaces.externalGaps);
    openQuestions.push(...surfaces.openQuestions);
    deferredItems.push(...surfaces.deferredItems);
  }

  const epicSummary: Record<EpicStatus, number> = {
    backlog: 0,
    "in-progress": 0,
    done: 0,
  };
  for (const e of epics) epicSummary[e.status]++;

  const storySummary: Record<StoryStatus, number> = {
    backlog: 0,
    "ready-for-dev": 0,
    "in-progress": 0,
    review: 0,
    blocked: 0,
    done: 0,
  };
  for (const s of stories) storySummary[s.status]++;

  const doneCount = storySummary.done;
  const totalStories = stories.length;

  return {
    meta: {
      project: sprint.project || "heimdall",
      moduleName: projectContext.moduleName,
      projectName: projectContext.projectName,
      lastUpdated: sprint.lastUpdated,
      generatedAt: new Date().toISOString(),
    },
    summary: {
      epics: epicSummary,
      stories: storySummary,
      storyCompletionPct: totalStories ? Math.round((doneCount / totalStories) * 100) : 0,
      openBlockers: storySummary.blocked,
      openQuestions: openQuestions.length,
      openExtGaps: externalGaps.filter((g) => g.status !== "closed").length,
      deferredItems: deferredItems.length,
    },
    epics,
    stories,
    deliverySlices,
    features,
    externalGaps,
    openQuestions,
    deferredItems,
    retrospectives: sprint.retrospectives,
  };
}

export function loadDashboard(repoRoot: string, config: HeimdallConfig, scope?: string): DashboardSnapshot {
  const modulesToLoad = resolveScopeModules(scope, config, repoRoot);
  const sprint = loadSharedSprint(repoRoot, config);

  const projectContextRaw = readOptional(join(repoRoot, config.paths.projectContext));
  const projectContext = projectContextRaw ? parseProjectContext(projectContextRaw) : { moduleName: "Project", projectName: "Project" };

  if (modulesToLoad.length === 0) {
    return buildEmptyDashboard(sprint, projectContext);
  }

  return buildDashboardSnapshot(repoRoot, config, modulesToLoad, sprint, projectContext);
}

export function loadStoryDetail(repoRoot: string, storyId: string, snapshot: DashboardSnapshot, config: HeimdallConfig) {
  const story = snapshot.stories.find((s) => s.id === storyId || s.id.startsWith(`${storyId}-`));
  if (!story) return null;

  const epic = snapshot.epics.find((e) => e.id === story.epicId);
  const implDir = join(repoRoot, config.paths.implementationDir);
  const storyFiles = existsSync(implDir) ? loadStoryFiles(implDir) : new Map();
  const lookupKey = `${story.epicNumber}-${story.number}`;
  const impl = storyFiles.get(lookupKey);

  return {
    ...story,
    epicTitle: epic?.title,
    blockingSection: impl?.blockingSection,
    devNotes: impl?.devNotes,
    rawImplementation: impl?.rawContent,
  };
}
