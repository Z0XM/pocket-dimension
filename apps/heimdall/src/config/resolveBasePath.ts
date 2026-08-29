import path from "node:path";
import type { HeimdallConfig } from "./schema.js";

/**
 * Resolve the effective public base where Heimdall is served.
 * Priority: explicit override → config.runtime.basePath → env bridge → heimdallPath.
 *
 * Never hardcodes a host env name (e.g. APP_BASE_PATH).
 */
export function resolveEffectiveBasePath(config: HeimdallConfig, options?: { basePath?: string; env?: NodeJS.ProcessEnv }): string {
  const env = options?.env ?? process.env;

  if (options?.basePath != null && options.basePath !== "") {
    return normalizeBase(options.basePath);
  }

  if (config.runtime.basePath != null && config.runtime.basePath !== "") {
    return normalizeBase(config.runtime.basePath);
  }

  const heimdallPath = normalizeBase(config.runtime.heimdallPath || "/heimdall");
  const envName = config.runtime.basePathFromEnv;
  if (envName) {
    const prefix = (env[envName] ?? "").replace(/\/$/, "");
    if (!prefix) return heimdallPath;
    return normalizeBase(`${prefix}${heimdallPath}`);
  }

  return heimdallPath;
}

function normalizeBase(value: string): string {
  if (!value || value === "/") return "";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/$/, "") || "";
}

export function resolveRepoRoot(config: HeimdallConfig, cwd = process.cwd(), configDir?: string): string {
  return path.resolve(configDir ?? cwd, config.repoRoot);
}

export function resolveConfigPath(repoRoot: string, relativePath: string): string {
  return path.resolve(repoRoot, relativePath);
}
