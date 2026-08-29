import path from "node:path";
import type { HeimdallConfig } from "./schema.js";
import { resolveConfigPath } from "./resolveBasePath.js";

export type ResolvedModulePlanningPaths = {
  featureRegistry?: string;
  epics?: Array<{ path: string; parser: string }>;
  intakeIndex?: string;
  deferredIndex?: string;
  externalGaps?: string;
};

export type ResolvedModule = {
  id: string;
  label: string;
  enabled: boolean;
  /** Display acronym for epic/story labels (optional). */
  idPrefix?: string;
  /** Repo-root-relative Module SoR root (`.` for implicit flat config). */
  basePath: string;
  paths: ResolvedModulePlanningPaths;
};

const ESCAPE_PREFIXES = ["_bmad-output/", "docs/"] as const;

export class ModulePathEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModulePathEscapeError";
  }
}

function isEscapeHatchPath(relativePath: string): boolean {
  return ESCAPE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function assertResolvedUnder(baseDir: string, resolved: string, context: string): void {
  const normalizedBase = path.resolve(baseDir);
  const normalizedResolved = path.resolve(resolved);
  if (normalizedResolved !== normalizedBase && !normalizedResolved.startsWith(`${normalizedBase}${path.sep}`)) {
    throw new ModulePathEscapeError(`Config path "${context}" resolves outside allowed directory "${normalizedBase}"`);
  }
}

/**
 * Resolve a Module planning path relative to repoRoot + Module basePath (AD-13).
 * Escape hatch: `_bmad-output/` or `docs/` prefixes resolve under repoRoot only.
 */
export function resolveModulePlanningPath(repoRoot: string, moduleBasePath: string, relativePath: string, context = relativePath): string {
  const normalizedRepoRoot = path.resolve(repoRoot);

  if (isEscapeHatchPath(relativePath)) {
    const resolved = path.resolve(normalizedRepoRoot, relativePath);
    assertResolvedUnder(normalizedRepoRoot, resolved, context);
    return resolved;
  }

  const moduleRoot = path.resolve(normalizedRepoRoot, moduleBasePath);
  const resolved = path.resolve(moduleRoot, relativePath);
  assertResolvedUnder(moduleRoot, resolved, context);
  return resolved;
}

function resolvePlanningPathsFromFlat(repoRoot: string, config: HeimdallConfig): ResolvedModulePlanningPaths {
  const { paths } = config;
  return {
    featureRegistry: resolveConfigPath(repoRoot, paths.featureRegistry),
    epics: paths.epics.map((epic) => ({
      path: resolveConfigPath(repoRoot, epic.path),
      parser: epic.parser,
    })),
    intakeIndex: resolveConfigPath(repoRoot, paths.intakeIndex),
    deferredIndex: resolveConfigPath(repoRoot, paths.deferredIndex),
    externalGaps: resolveConfigPath(repoRoot, paths.externalGaps),
  };
}

function resolveModulePaths(
  repoRoot: string,
  moduleBasePath: string,
  paths: HeimdallConfig["modules"][number]["paths"]
): ResolvedModulePlanningPaths {
  const resolved: ResolvedModulePlanningPaths = {};

  if (paths.featureRegistry != null) {
    resolved.featureRegistry = resolveModulePlanningPath(
      repoRoot,
      moduleBasePath,
      paths.featureRegistry,
      `featureRegistry: ${paths.featureRegistry}`
    );
  }

  if (paths.epics != null) {
    resolved.epics = paths.epics.map((epic, index) => ({
      path: resolveModulePlanningPath(repoRoot, moduleBasePath, epic.path, `epics[${index}].path: ${epic.path}`),
      parser: epic.parser,
    }));
  }

  if (paths.intakeIndex != null) {
    resolved.intakeIndex = resolveModulePlanningPath(repoRoot, moduleBasePath, paths.intakeIndex, `intakeIndex: ${paths.intakeIndex}`);
  }

  if (paths.deferredIndex != null) {
    resolved.deferredIndex = resolveModulePlanningPath(repoRoot, moduleBasePath, paths.deferredIndex, `deferredIndex: ${paths.deferredIndex}`);
  }

  if (paths.externalGaps != null) {
    resolved.externalGaps = resolveModulePlanningPath(repoRoot, moduleBasePath, paths.externalGaps, `externalGaps: ${paths.externalGaps}`);
  }

  return resolved;
}

function resolveImplicitDefaultModule(repoRoot: string, config: HeimdallConfig): ResolvedModule {
  return {
    id: "default",
    label: config.branding.subtitle,
    enabled: true,
    basePath: ".",
    paths: resolvePlanningPathsFromFlat(repoRoot, config),
  };
}

/**
 * Resolve configured Modules to absolute planning paths (AD-13/AD-14).
 * Empty or omitted modules → single implicit Module id "default".
 */
export function resolveModules(config: HeimdallConfig, repoRoot: string): ResolvedModule[] {
  const normalizedRepoRoot = path.resolve(repoRoot);

  if (config.modules.length === 0) {
    return [resolveImplicitDefaultModule(normalizedRepoRoot, config)];
  }

  return config.modules.map((mod) => ({
    id: mod.id,
    label: mod.label,
    enabled: mod.enabled,
    idPrefix: mod.idPrefix,
    basePath: mod.basePath,
    paths: resolveModulePaths(normalizedRepoRoot, mod.basePath, mod.paths),
  }));
}

/** FR-9 — exclude Modules with enabled === false. */
export function listEnabledModules(modules: ResolvedModule[]): ResolvedModule[] {
  return modules.filter((mod) => mod.enabled !== false);
}
