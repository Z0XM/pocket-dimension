import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "../src/config/schema.js";
import { loadDashboard } from "./loadDashboard.js";

const BMAD_EPICS = `# Module

## Epic 1: First epic

Goal for epic one.

### Story 1.1: First story

As a user,
I want one,
So that tests pass.

**Acceptance Criteria:**

**Given** setup
**When** action
**Then** result
`;

const FR_TABLE = `| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Feature One | SCR-1 | PM | Epic 1 | Live |
`;

const BRIDGE_EPICS = `# Bridge module

## Epic 1: Bridge: Pre-BMAD historical work

Historical planning before BMAD adoption.

### Story 1.1: Legacy story

As a user,
I want history,
So that context is preserved.
`;

function writeModule(root: string, moduleId: string, opts: { epics?: string; featureRegistry?: string }): void {
  const modDir = path.join(root, "modules", moduleId);
  mkdirSync(modDir, { recursive: true });
  if (opts.epics) writeFileSync(path.join(modDir, "epics.md"), opts.epics);
  if (opts.featureRegistry) {
    writeFileSync(path.join(modDir, "FEATURE-REGISTRY.md"), opts.featureRegistry);
  }
}

function twoModuleConfig(root: string, extra?: Record<string, unknown>) {
  return defineConfig({
    repoRoot: root,
    paths: {
      sprintStatus: [],
      epics: [],
      featureRegistry: "missing-features.md",
      intakeIndex: "missing-intake.md",
      deferredIndex: "missing-deferred.md",
      implementationDir: "implementation",
    },
    modules: [
      {
        id: "mod-a",
        label: "Module A",
        basePath: "modules/mod-a",
        paths: {
          epics: [{ path: "epics.md", parser: "bmad-output" }],
          featureRegistry: "FEATURE-REGISTRY.md",
        },
      },
      {
        id: "mod-b",
        label: "Module B",
        basePath: "modules/mod-b",
        paths: {
          epics: [{ path: "epics.md", parser: "bmad-output" }],
          featureRegistry: "FEATURE-REGISTRY.md",
        },
      },
    ],
    ...extra,
  });
}

describe("FR authority and synthesis flag contract", () => {
  it("Modules mode + FR with rows → Features from FR only; no feat-* synthesis", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr-auth-"));
    writeModule(root, "mod-a", { epics: BMAD_EPICS, featureRegistry: FR_TABLE });
    writeModule(root, "mod-b", { epics: BMAD_EPICS });

    const config = twoModuleConfig(root);
    const snap = loadDashboard(root, config, "mod-a");

    expect(snap.features.some((f) => f.id === "mod-a:F-1")).toBe(true);
    expect(snap.features.every((f) => !f.id.startsWith("feat-"))).toBe(true);
    expect(snap.features[0]?.moduleId).toBe("mod-a");
    expect(snap.features[0]?.moduleLabel).toBe("Module A");
  });

  it("synthesizeFeaturesWhenRegistryMissing: false + missing FR → features: []", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr-soft-"));
    writeModule(root, "mod-a", { epics: BMAD_EPICS });

    const config = twoModuleConfig(root, {
      synthesizeFeaturesWhenRegistryMissing: false,
    });
    const snap = loadDashboard(root, config, "mod-a");

    expect(snap.features).toEqual([]);
    expect(snap.epics.length).toBeGreaterThan(0);
  });

  it("flag default true + missing FR + bmad epics → synthesis still produces features", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr-synth-"));
    writeModule(root, "mod-a", { epics: BMAD_EPICS });

    const config = twoModuleConfig(root);
    const snap = loadDashboard(root, config, "mod-a");

    expect(snap.features.some((f) => f.id.startsWith("feat-mod-a-"))).toBe(true);
  });

  it("view-all two Modules with Epic 1 / F-1 → distinct ids; module labels present", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr-collision-"));
    writeModule(root, "mod-a", { epics: BMAD_EPICS, featureRegistry: FR_TABLE });
    writeModule(root, "mod-b", { epics: BMAD_EPICS, featureRegistry: FR_TABLE });

    const config = twoModuleConfig(root);
    const snap = loadDashboard(root, config, "all");

    const epicIds = snap.epics.map((e) => e.id);
    expect(epicIds).toContain("epic-mod-a-1");
    expect(epicIds).toContain("epic-mod-b-1");
    expect(new Set(epicIds).size).toBe(epicIds.length);

    const featureIds = snap.features.map((f) => f.id);
    expect(featureIds).toContain("mod-a:F-1");
    expect(featureIds).toContain("mod-b:F-1");
    expect(new Set(featureIds).size).toBe(featureIds.length);

    const storyIds = snap.stories.map((s) => s.id);
    expect(storyIds).toContain("mod-a-1-1");
    expect(storyIds).toContain("mod-b-1-1");
    expect(new Set(storyIds).size).toBe(storyIds.length);

    expect(snap.epics.every((e) => e.moduleId && e.moduleLabel)).toBe(true);
    expect(snap.stories.every((s) => s.moduleId && s.moduleLabel)).toBe(true);
    expect(snap.features.every((f) => f.moduleId && f.moduleLabel)).toBe(true);
  });

  it("Module A with FR + Module B without FR (flag true) → per-Module synthesis", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr-mixed-"));
    writeModule(root, "mod-a", { epics: BMAD_EPICS, featureRegistry: FR_TABLE });
    writeModule(root, "mod-b", { epics: BMAD_EPICS });

    const config = twoModuleConfig(root);
    const snap = loadDashboard(root, config, "all");

    expect(snap.features.some((f) => f.id === "mod-a:F-1")).toBe(true);
    expect(snap.features.some((f) => f.id.startsWith("feat-mod-b-"))).toBe(true);
    expect(snap.features.every((f) => !f.id.startsWith("feat-mod-a-"))).toBe(true);
  });

  it("Bridge-titled epic with sprint backlog → epic and stories still done; title preserved", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-bridge-"));
    writeModule(root, "mod-a", { epics: BRIDGE_EPICS });
    mkdirSync(path.join(root, "implementation"), { recursive: true });
    writeFileSync(
      path.join(root, "implementation", "sprint-status.yaml"),
      `project: test
last_updated: 2026-08-26
development_status:
  epic-1: backlog
  1-1-legacy-story: backlog
`
    );

    const config = defineConfig({
      repoRoot: root,
      paths: {
        sprintStatus: ["implementation/sprint-status.yaml"],
        epics: [],
        featureRegistry: "missing.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
      modules: [
        {
          id: "mod-a",
          label: "Module A",
          basePath: "modules/mod-a",
          paths: {
            epics: [{ path: "epics.md", parser: "bmad-output" }],
          },
        },
      ],
    });

    const snap = loadDashboard(root, config, "mod-a");
    const bridgeEpic = snap.epics.find((e) => e.title.includes("Bridge:"));
    expect(bridgeEpic).toBeDefined();
    expect(bridgeEpic!.status).toBe("done");
    expect(bridgeEpic!.title).toContain("Bridge:");

    const bridgeStories = snap.stories.filter((s) => s.epicId === bridgeEpic!.id);
    expect(bridgeStories.length).toBeGreaterThan(0);
    expect(bridgeStories.every((s) => s.status === "done")).toBe(true);
  });

  it("Historical: prefix epic forces done status", () => {
    const historicalEpics = `# Module

## Epic 1: Historical: Old planning cycle

Past work archived for reference.

### Story 1.1: Archived story

As a user,
I want archive,
So that history is visible.
`;
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-hist-"));
    writeModule(root, "mod-a", { epics: historicalEpics });

    const config = defineConfig({
      repoRoot: root,
      paths: {
        sprintStatus: [],
        epics: [],
        featureRegistry: "missing.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
      modules: [
        {
          id: "mod-a",
          label: "Module A",
          basePath: "modules/mod-a",
          paths: {
            epics: [{ path: "epics.md", parser: "bmad-output" }],
          },
        },
      ],
    });

    const snap = loadDashboard(root, config, "mod-a");
    const epic = snap.epics.find((e) => e.title.includes("Historical:"));
    expect(epic?.status).toBe("done");
    expect(epic?.title).toContain("Historical:");
  });
});
