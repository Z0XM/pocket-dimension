/**
 * Pocket Dimension monorepo dogfood config — Modules mode.
 * Run from repo root: `bun run heimdall doctor` / `bun run heimdall dev`
 * (CLI walks up to find this file.)
 *
 * Plain .mjs so the CJS CLI can load it without a TS loader.
 *
 * BMAD layout: peer folders under `_bmad-output/` (monorepo + packages + apps).
 * See `_bmad-output/README.md`. Omit FR/epics keys until real SoT files exist.
 */
export default {
  repoRoot: ".",
  branding: { subtitle: "Pocket Dimension" },
  runtime: {
    heimdallPath: "/",
  },
  dev: { apiPort: 5175, uiPort: 5174 },
  synthesizeFeaturesWhenRegistryMissing: false,
  paths: {
    docsRoot: "_bmad-output/pocket-dimension",
    projectContext: "_bmad-output/pocket-dimension/project-context.md",
    sprintStatus: [
      "_bmad-output/pocket-dimension/implementation-artifacts/sprint-status.yaml",
      "_bmad-output/heimdall/implementation-artifacts/heimdall/sprint-status.yaml",
    ],
    implementationDir: "_bmad-output/pocket-dimension/implementation-artifacts",
    testRoots: ["apps/heimdall/src", "apps/heimdall/server", "apps/zeo/src"],
  },
  modules: [
    {
      id: "pocket-dimension",
      label: "Monorepo",
      enabled: true,
      idPrefix: "PD",
      basePath: "_bmad-output/pocket-dimension",
      paths: {
        featureRegistry: "FEATURE-REGISTRY.md",
        epics: [{ path: "planning-artifacts/epics.md", parser: "bmad-output" }],
      },
    },
    {
      id: "shared-utils",
      label: "shared/utils",
      enabled: true,
      idPrefix: "SU",
      basePath: "_bmad-output/shared-utils",
      paths: {
        featureRegistry: "FEATURE-REGISTRY.md",
      },
    },
    {
      id: "shared-db",
      label: "shared/db",
      enabled: true,
      idPrefix: "SD",
      basePath: "_bmad-output/shared-db",
      paths: {
        featureRegistry: "FEATURE-REGISTRY.md",
      },
    },
    {
      id: "shared-auth",
      label: "shared/auth",
      enabled: true,
      idPrefix: "SA",
      basePath: "_bmad-output/shared-auth",
      paths: {
        featureRegistry: "FEATURE-REGISTRY.md",
      },
    },
    {
      id: "watchlist",
      label: "watchlist",
      enabled: true,
      idPrefix: "WL",
      basePath: "_bmad-output/watchlist",
      paths: {
        featureRegistry: "FEATURE-REGISTRY.md",
      },
    },
    {
      id: "heimdall",
      label: "Heimdall",
      enabled: true,
      idPrefix: "H",
      basePath: "_bmad-output/heimdall",
      paths: {
        featureRegistry: "planning-artifacts/heimdall/FEATURE-REGISTRY.md",
        epics: [
          {
            path: "planning-artifacts/heimdall/epics.md",
            parser: "bmad-output",
          },
        ],
      },
    },
    {
      id: "zeo",
      label: "zeo",
      enabled: true,
      idPrefix: "Z",
      basePath: "_bmad-output/zeo",
      paths: {
        // FR not authored — Delivery uses existing epics
        epics: [{ path: "planning-artifacts/epics.md", parser: "bmad-output" }],
      },
    },
    {
      id: "chhan-chhan",
      label: "chhan-chhan",
      enabled: true,
      idPrefix: "CC",
      basePath: "_bmad-output/chhan-chhan",
      paths: {
        featureRegistry: "FEATURE-REGISTRY.md",
      },
    },
  ],
  docs: {
    extraRoots: ["_bmad-output"],
    ignoreGlobs: ["**/node_modules/**"],
  },
  pages: { tests: true, testLevels: ["L1"] },
  links: { apiDocs: null, sample: null },
};
