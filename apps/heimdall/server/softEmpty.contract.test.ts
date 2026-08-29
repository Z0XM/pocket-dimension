import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "../src/config/schema.js";
import { loadDashboard } from "./loadDashboard.js";

describe("soft-empty dashboard contract", () => {
  it("loads without crashing when planning artifacts are missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-soft-"));
    mkdirSync(path.join(root, "docs"), { recursive: true });
    writeFileSync(path.join(root, "docs", "README.md"), "# Docs\n");

    const config = defineConfig({
      repoRoot: ".",
      paths: {
        docsRoot: "docs",
        projectContext: "docs/missing-context.md",
        sprintStatus: [],
        epics: [],
        featureRegistry: "docs/missing-features.md",
        intakeIndex: "docs/missing-intake.md",
        deferredIndex: "docs/missing-deferred.md",
        implementationDir: "docs/implementation",
      },
    });

    const snap = loadDashboard(root, config);
    expect(snap.epics).toEqual([]);
    expect(snap.stories).toEqual([]);
    expect(snap.features).toEqual([]);
    expect(snap.summary).toBeDefined();
  });
});
