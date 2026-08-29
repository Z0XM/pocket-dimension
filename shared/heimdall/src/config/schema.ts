import { z } from "zod";
import { CONFIG_TEST_LEVELS } from "./testLevels.js";

/** Built-in epic Parser Ids (AD-7). Unknown strings soft-skip at load time. */
export const BUILTIN_EPIC_PARSERS = ["numeric", "bmad-output"] as const;
export type BuiltinEpicParser = (typeof BUILTIN_EPIC_PARSERS)[number];

export function isBuiltinEpicParser(parser: string): parser is BuiltinEpicParser {
  return (BUILTIN_EPIC_PARSERS as readonly string[]).includes(parser);
}

export const epicSourceSchema = z.object({
  path: z.string(),
  /** Built-ins: numeric | bmad-output. Other strings are skipped (soft-empty). */
  parser: z.string().default("numeric"),
});

/** Module planning paths — no SI defaults; omit keys when not authored (AD-13). */
export const modulePlanningPathsSchema = z.object({
  featureRegistry: z.string().optional(),
  epics: z.array(epicSourceSchema).optional(),
  intakeIndex: z.string().optional(),
  deferredIndex: z.string().optional(),
  externalGaps: z.string().optional(),
});

export const moduleSchema = z.object({
  id: z.string(),
  label: z.string(),
  enabled: z.boolean().default(true),
  /** Repo-root-relative BMAD SoR root (filesystem — not HTTP mount basePath). */
  basePath: z.string(),
  /**
   * Optional display acronym for epic/story labels (e.g. `H` → `H1` / `H1.1`).
   * Display-time only — does not rewrite BMAD docs.
   */
  idPrefix: z.string().trim().min(1).optional(),
  paths: modulePlanningPathsSchema.default({}),
});

export const heimdallConfigSchema = z.object({
  repoRoot: z.string().default("."),
  branding: z
    .object({
      subtitle: z.string().default("Heimdall"),
      defaultTheme: z.enum(["dark", "light"]).default("dark"),
    })
    .default({}),
  runtime: z
    .object({
      /** Explicit effective public base (wins over env bridge when set). */
      basePath: z.string().optional(),
      /** Mount segment joined with env prefix when using basePathFromEnv. Default /heimdall */
      heimdallPath: z.string().default("/heimdall"),
      /**
       * Consumer-chosen env var name whose value is an app prefix.
       * Heimdall does NOT default this to APP_BASE_PATH — host must set the string.
       */
      basePathFromEnv: z.string().optional(),
      /**
       * Prefix for browser localStorage / session keys (sidebar collapse, etc.).
       * Keys are `${uiStoragePrefix}-…`. Default `heimdall`.
       */
      uiStoragePrefix: z.string().trim().min(1).default("heimdall"),
    })
    .default({}),
  dev: z
    .object({
      apiPort: z.number().int().positive().default(5175),
      uiPort: z.number().int().positive().default(5174),
    })
    .default({}),
  paths: z
    .object({
      docsRoot: z.string().default("docs"),
      projectContext: z.string().default("docs/project-context.md"),
      sprintStatus: z.array(z.string()).default(["docs/implementation/sprint-status.yaml"]),
      epics: z.array(epicSourceSchema).default([{ path: "docs/planning/epics/epics.md", parser: "numeric" }]),
      featureRegistry: z.string().default("docs/requirements/FEATURE-REGISTRY.md"),
      intakeIndex: z.string().default("docs/requirements/INTAKE-INDEX.md"),
      deferredIndex: z.string().default("docs/requirements/DEFERRED-INDEX.md"),
      externalGaps: z.string().default("docs/planning/architecture/EXTERNAL-MODULE-REFERENCE.md"),
      implementationDir: z.string().default("docs/implementation"),
      testRoots: z.array(z.string()).default(["src", "tests"]),
      uiExpectationsDir: z.string().default("docs/validation/ui-expectations"),
      vitestRunsDir: z.string().default("docs/validation/reports/vitest-runs"),
      uiRunsDir: z.string().default("docs/validation/reports/ui-runs"),
    })
    .default({}),
  docs: z
    .object({
      extraRoots: z.array(z.string()).default([]),
      ignoreGlobs: z.array(z.string()).default(["**/node_modules/**"]),
    })
    .default({}),
  pages: z
    .object({
      tests: z.boolean().default(false),
      /**
       * Which Tests page levels to show when `tests` is true.
       * Omit = all (L1–L4, tooling, L5). L5 is UI expectations (Playwright), not Vitest.
       */
      testLevels: z.array(z.enum(CONFIG_TEST_LEVELS)).optional(),
    })
    .default({}),
  links: z
    .object({
      apiDocs: z.string().nullable().default(null),
      sample: z.string().nullable().default(null),
    })
    .default({}),
  /** When omitted or empty, top-level paths form a single implicit Module (AD-14). */
  modules: z.array(moduleSchema).default([]),
  /** FR-13 / AD-16 — behavior gated in loadDashboard (Story 2.3); schema-only here. */
  synthesizeFeaturesWhenRegistryMissing: z.boolean().default(true),
});

export type ModulePlanningPaths = z.output<typeof modulePlanningPathsSchema>;
export type ModuleConfig = z.output<typeof moduleSchema>;
export type HeimdallConfigInput = z.input<typeof heimdallConfigSchema>;
export type HeimdallConfig = z.output<typeof heimdallConfigSchema>;

export { CONFIG_TEST_LEVELS, resolveEnabledTestLevels, isConfigTestLevelEnabled } from "./testLevels.js";
export type { ConfigTestLevel } from "./testLevels.js";

export function defineConfig(config: HeimdallConfigInput): HeimdallConfig {
  return heimdallConfigSchema.parse(config);
}
