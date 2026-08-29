import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig } from "../config/schema.js";
import { listEnabledModules, resolveModules } from "../config/resolveModules.js";
import { collectDoctorCheckPlan, formatDoctorSummary, formatModuleSectionHeader, formatPresenceCheck, isSoftEmptySummary } from "./doctorChecks.js";

const repoRoot = path.resolve("/repo");

describe("doctorChecks contract", () => {
  it("flat / empty modules uses implicit default planning paths in legacy order", () => {
    const config = defineConfig({});
    const enabled = listEnabledModules(resolveModules(config, repoRoot));
    const plan = collectDoctorCheckPlan(config, repoRoot, enabled);

    expect(plan.modulesMode).toBe(false);
    expect(plan.moduleSections).toEqual([]);
    expect(plan.primaryChecks.map((check) => check.label)).toEqual([
      "docsRoot",
      "projectContext",
      "featureRegistry",
      "intakeIndex",
      "deferredIndex",
      "externalGaps",
      "implementationDir",
      "sprintStatus",
      "epics(numeric)",
    ]);
    expect(plan.primaryChecks.find((check) => check.label === "featureRegistry")?.absPath).toBe(
      path.resolve(repoRoot, "docs/requirements/FEATURE-REGISTRY.md")
    );
  });

  it("optional MISSING summary stays Soft-empty informational, not failure framing", () => {
    const summary = formatDoctorSummary(3);
    expect(summary).toContain("soft-empty");
    expect(summary).toContain("not a crash");
    expect(isSoftEmptySummary(summary)).toBe(true);
    expect(summary.toLowerCase()).not.toContain("broken");
    expect(summary.toLowerCase()).not.toContain("fix required");
  });

  it("non-empty modules scopes planning checks per enabled Module id/label", () => {
    const config = defineConfig({
      modules: [
        {
          id: "heimdall",
          label: "@pocket-dimension/heimdall",
          basePath: "_bmad-output/planning-artifacts/heimdall",
          paths: {
            featureRegistry: "FEATURE-REGISTRY.md",
            epics: [{ path: "epics.md", parser: "bmad-output" }],
          },
        },
        {
          id: "commons",
          label: "@compenly/commons",
          basePath: "commons/_bmad-output",
          paths: {
            intakeIndex: "INTAKE.md",
          },
        },
        {
          id: "off",
          label: "Disabled",
          enabled: false,
          basePath: "pkg/off",
          paths: { featureRegistry: "FEATURE.md" },
        },
      ],
    });

    const enabled = listEnabledModules(resolveModules(config, repoRoot));
    expect(enabled.map((mod) => mod.id)).toEqual(["heimdall", "commons"]);

    const plan = collectDoctorCheckPlan(config, repoRoot, enabled);
    expect(plan.modulesMode).toBe(true);
    expect(plan.primaryChecks.map((check) => check.label)).toEqual(["docsRoot", "projectContext", "implementationDir", "sprintStatus"]);
    expect(plan.primaryChecks.some((check) => check.label === "featureRegistry")).toBe(false);

    const heimdall = plan.moduleSections.find((section) => section.id === "heimdall");
    expect(heimdall).toBeDefined();
    expect(formatModuleSectionHeader(heimdall!)).toContain("@pocket-dimension/heimdall");
    expect(formatModuleSectionHeader(heimdall!)).toContain("(heimdall)");
    expect(heimdall!.checks.map((check) => check.label)).toEqual(["featureRegistry", "epics(bmad-output)"]);
    expect(heimdall!.checks[0]!.absPath).toBe(path.resolve(repoRoot, "_bmad-output/planning-artifacts/heimdall/FEATURE-REGISTRY.md"));

    const commons = plan.moduleSections.find((section) => section.id === "commons");
    expect(commons!.checks.map((check) => check.label)).toEqual(["intakeIndex"]);
    expect(plan.moduleSections.some((section) => section.id === "off")).toBe(false);
  });

  it("escape-hatch and basePath-relative Module paths resolve via resolveModules helpers", () => {
    const config = defineConfig({
      modules: [
        {
          id: "pkg",
          label: "Package",
          basePath: "packages/heimdall",
          paths: {
            featureRegistry: "_bmad-output/planning-artifacts/heimdall/FEATURE-REGISTRY.md",
            epics: [{ path: "docs/planning/epics.md", parser: "numeric" }],
          },
        },
      ],
    });

    const [mod] = listEnabledModules(resolveModules(config, repoRoot));
    const plan = collectDoctorCheckPlan(config, repoRoot, [mod!]);
    const section = plan.moduleSections[0]!;

    expect(section.checks[0]!.absPath).toBe(path.resolve(repoRoot, "_bmad-output/planning-artifacts/heimdall/FEATURE-REGISTRY.md"));
    expect(section.checks[1]!.absPath).toBe(path.resolve(repoRoot, "docs/planning/epics.md"));
  });

  it("omitted optional index keys are not listed; present-but-missing files are MISSING", () => {
    const config = defineConfig({
      modules: [
        {
          id: "sparse",
          label: "Sparse",
          basePath: "pkg/sparse",
          paths: {
            featureRegistry: "FEATURE.md",
          },
        },
      ],
    });

    const enabled = listEnabledModules(resolveModules(config, repoRoot));
    const plan = collectDoctorCheckPlan(config, repoRoot, enabled);
    const section = plan.moduleSections[0]!;

    expect(section.checks.map((check) => check.label)).toEqual(["featureRegistry"]);
    expect(section.checks.some((check) => check.label === "intakeIndex")).toBe(false);

    const missing = formatPresenceCheck(section.checks[0]!, false);
    expect(missing.mark).toBe("MISSING");
    expect(missing.line).toContain("[MISSING]");
    expect(missing.line).toContain("FEATURE.md");
  });
});
