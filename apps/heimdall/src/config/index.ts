export {
  defineConfig,
  heimdallConfigSchema,
  BUILTIN_EPIC_PARSERS,
  isBuiltinEpicParser,
  moduleSchema,
  modulePlanningPathsSchema,
  epicSourceSchema,
} from "./schema.js";
export type { HeimdallConfig, HeimdallConfigInput, BuiltinEpicParser, ModuleConfig, ModulePlanningPaths } from "./schema.js";
export { loadHeimdallConfig, starterConfigSource, readTextIfExists } from "./load.js";
export {
  resolveEffectiveBasePath,
  resolveRepoRoot,
  resolveConfigPath,
  normalizeBase,
  normalizeMountPath,
  joinPublicPath,
} from "./resolveBasePath.js";
export { resolveModules, resolveModulePlanningPath, listEnabledModules, ModulePathEscapeError } from "./resolveModules.js";
export type { ResolvedModule, ResolvedModulePlanningPaths } from "./resolveModules.js";
