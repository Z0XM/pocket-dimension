import path from "node:path";
import type { HeimdallConfig } from "./schema.js";

/**
 * Resolve the effective public base where Heimdall is served.
 * Priority: explicit override → config.runtime.basePath → env bridge → heimdallPath.
 *
 * Never hardcodes a host env name (e.g. APP_BASE_PATH).
 * Empty string means site root (`/`).
 */
export function resolveEffectiveBasePath(config: HeimdallConfig, options?: { basePath?: string; env?: NodeJS.ProcessEnv }): string {
  const env = options?.env ?? process.env;

  if (options?.basePath != null) {
    return normalizeBase(options.basePath);
  }

  if (config.runtime.basePath != null && config.runtime.basePath !== "") {
    return normalizeBase(config.runtime.basePath);
  }

  const heimdallPath = normalizeBase(config.runtime.heimdallPath ?? "/heimdall");
  const envName = config.runtime.basePathFromEnv;
  if (envName) {
    const prefix = (env[envName] ?? "").replace(/\/$/, "");
    if (!prefix) return heimdallPath;
    return normalizeBase(`${prefix}${heimdallPath || ""}`);
  }

  return heimdallPath;
}

/**
 * Normalize a mount / public base.
 * `"/"` and `""` → `""` (site root). Other values lose a trailing slash.
 */
export function normalizeBase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/$/, "") || "";
}

/** Fastify mount segment; same rules as {@link normalizeBase}. */
export function normalizeMountPath(value: string | undefined | null, fallback = "/heimdall"): string {
  if (value == null) return normalizeBase(fallback);
  return normalizeBase(value);
}

export function joinPublicPath(base: string, suffix: string): string {
  const b = normalizeBase(base);
  const s = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return b ? `${b}${s}` : s;
}

export function resolveRepoRoot(config: HeimdallConfig, cwd = process.cwd(), configDir?: string): string {
  return path.resolve(configDir ?? cwd, config.repoRoot);
}

export function resolveConfigPath(repoRoot: string, relativePath: string): string {
  return path.resolve(repoRoot, relativePath);
}
