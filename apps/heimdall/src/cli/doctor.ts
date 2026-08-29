import { existsSync } from "node:fs";
import { isBuiltinEpicParser, BUILTIN_EPIC_PARSERS } from "../config/schema.js";
import { loadHeimdallConfig } from "../config/load.js";
import { resolveEffectiveBasePath, resolveRepoRoot } from "../config/resolveBasePath.js";
import { listEnabledModules, ModulePathEscapeError, resolveModules } from "../config/resolveModules.js";
import { collectDoctorCheckPlan, formatDoctorSummary, formatModuleSectionHeader, formatPresenceCheck } from "./doctorChecks.js";

export async function runDoctor(): Promise<number> {
  const { config, configPath, configDir } = await loadHeimdallConfig();
  const repoRoot = resolveRepoRoot(config, process.cwd(), configDir);
  const basePath = resolveEffectiveBasePath(config);

  console.log(`[heimdall doctor]`);
  console.log(`  config:   ${configPath ?? "(defaults — no heimdall.config.* found)"}`);
  console.log(`  repoRoot: ${repoRoot}`);
  console.log(`  basePath: ${basePath || "(empty)"}`);
  console.log(`  heimdallPath: ${config.runtime.heimdallPath}`);
  if (config.runtime.basePathFromEnv) {
    console.log(`  basePathFromEnv: ${config.runtime.basePathFromEnv} (consumer-named)`);
  }

  let enabledModules;
  try {
    enabledModules = listEnabledModules(resolveModules(config, repoRoot));
  } catch (err) {
    if (err instanceof ModulePathEscapeError) {
      console.log(`  [WARN] ${err.message}`);
      console.log("\nConfig path resolution failed — fix Module path config before relying on doctor presence checks.");
      return 0;
    }
    throw err;
  }

  const plan = collectDoctorCheckPlan(config, repoRoot, enabledModules);
  let warnings = 0;

  for (const check of plan.primaryChecks) {
    const result = formatPresenceCheck(check, existsSync(check.absPath));
    if (result.isMissing) warnings++;
    console.log(result.line);
  }

  for (const section of plan.moduleSections) {
    console.log(formatModuleSectionHeader(section));
    for (const check of section.checks) {
      const result = formatPresenceCheck(check, existsSync(check.absPath));
      if (result.isMissing) warnings++;
      console.log(result.line);
    }
    for (const epic of section.epicSources) {
      if (!isBuiltinEpicParser(epic.parser)) {
        warnings++;
        console.log(
          `  [WARN] unknown epic parser "${epic.parser}" for ${epic.displayPath} — skipped at load (built-ins: ${BUILTIN_EPIC_PARSERS.join(", ")})`
        );
      }
    }
  }

  if (!plan.modulesMode) {
    for (const epic of config.paths.epics) {
      if (!isBuiltinEpicParser(epic.parser)) {
        warnings++;
        console.log(
          `  [WARN] unknown epic parser "${epic.parser}" for ${epic.path} — skipped at load (built-ins: ${BUILTIN_EPIC_PARSERS.join(", ")})`
        );
      }
    }
  }

  console.log(formatDoctorSummary(warnings));

  if (config.pages.tests) {
    console.log(
      "Note: pages.tests=true — Tests UI enabled. Standalone `heimdall dev` uses the dogfood Vitest RunnerAdapter; host embeds still need registerHeimdall({ runners })."
    );
  }

  if (config.links.sample) {
    console.log(`Note: links.sample=${config.links.sample} — Sample sidebar deep-link enabled.`);
  }

  return 0;
}
