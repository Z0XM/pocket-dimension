import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, type HeimdallConfig, type HeimdallConfigInput } from "./schema.js";

const CONFIG_NAMES = ["heimdall.config.ts", "heimdall.config.mjs", "heimdall.config.js"];

export async function loadHeimdallConfig(
  searchFrom = process.cwd()
): Promise<{ config: HeimdallConfig; configPath: string | null; configDir: string }> {
  let dir = path.resolve(searchFrom);
  const { root } = path.parse(dir);

  while (true) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name);
      if (!existsSync(candidate)) continue;
      const config = await importConfigFile(candidate);
      return { config, configPath: candidate, configDir: dir };
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }

  return { config: defineConfig({}), configPath: null, configDir: path.resolve(searchFrom) };
}

async function importConfigFile(filePath: string): Promise<HeimdallConfig> {
  // Prefer heimdall.config.mjs / .js for Node CJS CLI. `.ts` configs need a
  // TS loader (tsx) registered by the host process (e.g. `node --import tsx`).
  const mod = await import(pathToFileURL(filePath).href);
  const raw = (mod.default ?? mod.config ?? mod) as HeimdallConfigInput | HeimdallConfig;
  return defineConfig(raw);
}

export function starterConfigSource(): string {
  return `import { defineConfig } from "@pocket-dimension/heimdall/config";

/**
 * Heimdall product config (not Vite tooling env).
 * Host owns reverse-proxy prefixes; pass effective base via runtime.basePath,
 * registerHeimdall({ basePath }), or optional runtime.basePathFromEnv (consumer-chosen name).
 */
export default defineConfig({
  repoRoot: ".",
  branding: {
    subtitle: "Heimdall",
    // defaultTheme: "light", // omit → dark; valid: "dark" | "light"
  },
  runtime: {
    heimdallPath: "/heimdall",
    // basePath: "/my-app/heimdall",
    // basePathFromEnv: "PUBLIC_BASE_PATH", // host chooses the name; Heimdall does not default it
  },
  dev: { apiPort: 5175, uiPort: 5174 },
  paths: {
    docsRoot: "docs",
    projectContext: "docs/project-context.md",
    sprintStatus: ["docs/implementation/sprint-status.yaml"],
    epics: [{ path: "docs/planning/epics/epics.md", parser: "numeric" }],
    featureRegistry: "docs/requirements/FEATURE-REGISTRY.md",
    intakeIndex: "docs/requirements/INTAKE-INDEX.md",
    deferredIndex: "docs/requirements/DEFERRED-INDEX.md",
    externalGaps: "docs/planning/architecture/EXTERNAL-MODULE-REFERENCE.md",
    implementationDir: "docs/implementation",
    testRoots: ["src", "tests"],
    uiExpectationsDir: "docs/validation/ui-expectations",
    vitestRunsDir: "docs/validation/reports/vitest-runs",
    uiRunsDir: "docs/validation/reports/ui-runs",
  },
  docs: {
    extraRoots: ["_bmad-output"],
    ignoreGlobs: ["**/node_modules/**"],
  },
  pages: {
    tests: false,
    // testLevels: ["L1", "L2", "L3", "L4", "tooling", "L5"], // omit = all
  },
  links: {
    apiDocs: null,
    sample: null,
  },
});
`;
}

export function readTextIfExists(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export { defineConfig } from "./schema.js";
export type { HeimdallConfig, HeimdallConfigInput } from "./schema.js";
