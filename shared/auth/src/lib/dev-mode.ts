import { resolve } from "node:path";
import { findAllowedAccount, type DevModeConfig } from "./dev-mode-core";

export {
  assertDevModeEnabled,
  buildDevAccountsUrl,
  buildDevSignInUrl,
  findAllowedAccount,
  getDevModeSessionRedirect,
  isDevModeEnabled,
  toPublicAccounts,
  type DevModeAccount,
  type DevModeConfig,
  type DevModePublicAccount,
} from "./dev-mode-core";

/**
 * Absolute path to the gitignored config file.
 * Lives at the `@pocket-dimension/auth` package root: `shared/auth/devMode.config.ts`
 */
export function getDevModeConfigPath(fromDir = import.meta.dir): string {
  // Bundled runtime: shared/auth/dist → ../devMode.config.ts
  // Source runtime: shared/auth/src/lib → ../../devMode.config.ts
  if (fromDir.replaceAll("\\", "/").endsWith("/dist")) {
    return resolve(fromDir, "../devMode.config.ts");
  }
  return resolve(fromDir, "../../devMode.config.ts");
}

let cachedConfig: DevModeConfig | null | undefined;

/**
 * Load gitignored `devMode.config.ts` from the auth package root.
 * Returns null when the file is missing (Dev Mode endpoints should 503 with setup hint).
 */
export async function loadDevModeConfig(options?: { forceReload?: boolean }): Promise<DevModeConfig | null> {
  if (!options?.forceReload && cachedConfig !== undefined) {
    return cachedConfig;
  }

  const candidates = [getDevModeConfigPath(), resolve(import.meta.dir, "../devMode.config.ts"), resolve(import.meta.dir, "../../devMode.config.ts")];
  const uniqueCandidates = [...new Set(candidates)];

  let lastError: unknown;
  for (const configPath of uniqueCandidates) {
    try {
      const mod = await import(configPath);
      const config = (mod.default ?? mod) as DevModeConfig;
      if (!config?.defaultAccount || !Array.isArray(config.allowedAccounts) || config.allowedAccounts.length === 0) {
        console.error("[dev-mode] Invalid config: need defaultAccount and non-empty allowedAccounts");
        cachedConfig = null;
        return null;
      }
      if (!findAllowedAccount(config, config.defaultAccount)) {
        console.error("[dev-mode] defaultAccount is not in allowedAccounts");
        cachedConfig = null;
        return null;
      }
      cachedConfig = config;
      return config;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn(
    `[dev-mode] Could not load devMode.config.ts (tried: ${uniqueCandidates.join(", ")}). Copy shared/auth/devMode.config.example.ts → shared/auth/devMode.config.ts`,
    lastError instanceof Error ? lastError.message : lastError
  );
  cachedConfig = null;
  return null;
}
