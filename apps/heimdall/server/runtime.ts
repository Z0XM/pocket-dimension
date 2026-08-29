import type { HeimdallConfig } from "../src/config/schema.js";
import { resolveEffectiveBasePath, resolveRepoRoot } from "../src/config/resolveBasePath.js";
import { loadHeimdallConfig } from "../src/config/load.js";

let cachedConfig: HeimdallConfig | null = null;
let cachedRepoRoot: string | null = null;
let cachedBasePath: string | null = null;
let explicitBasePath: string | undefined;

export async function initHeimdallRuntime(options?: {
  basePath?: string;
  cwd?: string;
}): Promise<{ config: HeimdallConfig; repoRoot: string; basePath: string }> {
  const { config, configDir } = await loadHeimdallConfig(options?.cwd);
  cachedConfig = config;
  cachedRepoRoot = resolveRepoRoot(config, options?.cwd, configDir);
  explicitBasePath = options?.basePath;
  cachedBasePath = resolveEffectiveBasePath(config, { basePath: options?.basePath });
  return { config, repoRoot: cachedRepoRoot, basePath: cachedBasePath };
}

export function getHeimdallConfig(): HeimdallConfig {
  if (!cachedConfig) {
    throw new Error("Heimdall runtime not initialized — call initHeimdallRuntime first");
  }
  return cachedConfig;
}

export function getRepoRoot(): string {
  if (process.env.HEIMDALL_REPO_ROOT) return process.env.HEIMDALL_REPO_ROOT;
  if (cachedRepoRoot) return cachedRepoRoot;
  throw new Error("Heimdall runtime not initialized");
}

export function getEffectiveBasePath(): string {
  if (process.env.HEIMDALL_BASE_PATH != null && process.env.HEIMDALL_BASE_PATH !== "") {
    return process.env.HEIMDALL_BASE_PATH.replace(/\/$/, "");
  }
  if (cachedBasePath != null) return cachedBasePath;
  if (cachedConfig) {
    return resolveEffectiveBasePath(cachedConfig, { basePath: explicitBasePath });
  }
  return "/heimdall";
}

export function tryGetConfig(): HeimdallConfig | null {
  return cachedConfig;
}
