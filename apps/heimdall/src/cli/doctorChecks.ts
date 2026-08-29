import type { HeimdallConfig, ModulePlanningPaths } from "../config/schema.js";
import type { ResolvedModule } from "../config/resolveModules.js";
import { resolveConfigPath } from "../config/resolveBasePath.js";

export type DoctorPathCheck = {
  label: string;
  displayPath: string;
  absPath: string;
};

export type DoctorModuleSection = {
  id: string;
  label: string;
  checks: DoctorPathCheck[];
  epicSources: Array<{ parser: string; displayPath: string }>;
};

export type DoctorCheckPlan = {
  /** Flat mode: all checks in legacy display order. Modules mode: shared runtime paths only. */
  primaryChecks: DoctorPathCheck[];
  moduleSections: DoctorModuleSection[];
  modulesMode: boolean;
};

function collectPlanningChecksFromSource(
  sourcePaths: ModulePlanningPaths,
  resolvedPaths: ResolvedModule["paths"]
): { checks: DoctorPathCheck[]; epicSources: DoctorModuleSection["epicSources"] } {
  const checks: DoctorPathCheck[] = [];
  const epicSources: DoctorModuleSection["epicSources"] = [];

  if (sourcePaths.featureRegistry != null && resolvedPaths.featureRegistry != null) {
    checks.push({
      label: "featureRegistry",
      displayPath: sourcePaths.featureRegistry,
      absPath: resolvedPaths.featureRegistry,
    });
  }
  if (sourcePaths.intakeIndex != null && resolvedPaths.intakeIndex != null) {
    checks.push({
      label: "intakeIndex",
      displayPath: sourcePaths.intakeIndex,
      absPath: resolvedPaths.intakeIndex,
    });
  }
  if (sourcePaths.deferredIndex != null && resolvedPaths.deferredIndex != null) {
    checks.push({
      label: "deferredIndex",
      displayPath: sourcePaths.deferredIndex,
      absPath: resolvedPaths.deferredIndex,
    });
  }
  if (sourcePaths.externalGaps != null && resolvedPaths.externalGaps != null) {
    checks.push({
      label: "externalGaps",
      displayPath: sourcePaths.externalGaps,
      absPath: resolvedPaths.externalGaps,
    });
  }
  if (sourcePaths.epics != null && resolvedPaths.epics != null) {
    for (let i = 0; i < sourcePaths.epics.length; i++) {
      const epic = sourcePaths.epics[i]!;
      const resolved = resolvedPaths.epics[i]!;
      checks.push({
        label: `epics(${epic.parser})`,
        displayPath: epic.path,
        absPath: resolved.path,
      });
      epicSources.push({ parser: epic.parser, displayPath: epic.path });
    }
  }

  return { checks, epicSources };
}

function collectSharedRuntimeChecks(config: HeimdallConfig, repoRoot: string): DoctorPathCheck[] {
  const checks: DoctorPathCheck[] = [
    {
      label: "docsRoot",
      displayPath: config.paths.docsRoot,
      absPath: resolveConfigPath(repoRoot, config.paths.docsRoot),
    },
    {
      label: "projectContext",
      displayPath: config.paths.projectContext,
      absPath: resolveConfigPath(repoRoot, config.paths.projectContext),
    },
    {
      label: "implementationDir",
      displayPath: config.paths.implementationDir,
      absPath: resolveConfigPath(repoRoot, config.paths.implementationDir),
    },
  ];
  for (const sprint of config.paths.sprintStatus) {
    checks.push({
      label: "sprintStatus",
      displayPath: sprint,
      absPath: resolveConfigPath(repoRoot, sprint),
    });
  }
  for (const root of config.docs.extraRoots) {
    checks.push({
      label: "extraRoot",
      displayPath: root,
      absPath: resolveConfigPath(repoRoot, root),
    });
  }
  return checks;
}

function collectFlatModeChecks(config: HeimdallConfig, repoRoot: string, defaultModule: ResolvedModule): DoctorPathCheck[] {
  const sourcePaths: ModulePlanningPaths = {
    featureRegistry: config.paths.featureRegistry,
    epics: config.paths.epics,
    intakeIndex: config.paths.intakeIndex,
    deferredIndex: config.paths.deferredIndex,
    externalGaps: config.paths.externalGaps,
  };
  const { checks: planningChecks } = collectPlanningChecksFromSource(sourcePaths, defaultModule.paths);
  const nonEpicPlanning = planningChecks.filter((check) => !check.label.startsWith("epics("));
  const epicPlanning = planningChecks.filter((check) => check.label.startsWith("epics("));

  const checks: DoctorPathCheck[] = [
    {
      label: "docsRoot",
      displayPath: config.paths.docsRoot,
      absPath: resolveConfigPath(repoRoot, config.paths.docsRoot),
    },
    {
      label: "projectContext",
      displayPath: config.paths.projectContext,
      absPath: resolveConfigPath(repoRoot, config.paths.projectContext),
    },
  ];
  checks.push(...nonEpicPlanning);
  checks.push({
    label: "implementationDir",
    displayPath: config.paths.implementationDir,
    absPath: resolveConfigPath(repoRoot, config.paths.implementationDir),
  });
  for (const sprint of config.paths.sprintStatus) {
    checks.push({
      label: "sprintStatus",
      displayPath: sprint,
      absPath: resolveConfigPath(repoRoot, sprint),
    });
  }
  checks.push(...epicPlanning);
  for (const root of config.docs.extraRoots) {
    checks.push({
      label: "extraRoot",
      displayPath: root,
      absPath: resolveConfigPath(repoRoot, root),
    });
  }
  return checks;
}

function collectModuleSection(config: HeimdallConfig, resolved: ResolvedModule): DoctorModuleSection {
  const modConfig = config.modules.find((mod) => mod.id === resolved.id);
  const sourcePaths = modConfig?.paths ?? {};
  const { checks, epicSources } = collectPlanningChecksFromSource(sourcePaths, resolved.paths);
  return {
    id: resolved.id,
    label: resolved.label,
    checks,
    epicSources,
  };
}

/** Build doctor presence checks using the same resolveModules output as dashboard load (AD-13). */
export function collectDoctorCheckPlan(config: HeimdallConfig, repoRoot: string, enabledModules: ResolvedModule[]): DoctorCheckPlan {
  const modulesMode = config.modules.length > 0;

  if (!modulesMode) {
    const defaultModule = enabledModules[0]!;
    return {
      primaryChecks: collectFlatModeChecks(config, repoRoot, defaultModule),
      moduleSections: [],
      modulesMode: false,
    };
  }

  return {
    primaryChecks: collectSharedRuntimeChecks(config, repoRoot),
    moduleSections: enabledModules.map((resolved) => collectModuleSection(config, resolved)),
    modulesMode: true,
  };
}

export type PresenceResult = {
  mark: "ok" | "MISSING";
  line: string;
  isMissing: boolean;
};

export function formatPresenceCheck(check: DoctorPathCheck, exists: boolean): PresenceResult {
  const mark = exists ? "ok" : "MISSING";
  return {
    mark,
    line: `  [${mark}] ${check.label}: ${check.displayPath}`,
    isMissing: !exists,
  };
}

export function formatModuleSectionHeader(section: DoctorModuleSection): string {
  const idSuffix = section.label !== section.id ? ` (${section.id})` : "";
  return `\n  Module: ${section.label}${idSuffix}`;
}

export function formatDoctorSummary(warningCount: number): string {
  if (warningCount > 0) {
    return `\n${warningCount} warning(s) — War Room will soft-empty affected surfaces (not a crash).`;
  }
  return "\nAll configured paths present.";
}

export function isSoftEmptySummary(summary: string): boolean {
  return summary.includes("soft-empty") && !summary.toLowerCase().includes("broken");
}
