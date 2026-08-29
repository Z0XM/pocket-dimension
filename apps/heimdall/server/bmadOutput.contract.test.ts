import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "../src/config/schema.js";
import { loadDashboard } from "./loadDashboard.js";
import { epicSourceSlug, parseBmadOutputEpics, bmadEpicId, bmadFeatureId } from "./parseBmadOutputEpics.js";

const NUMBERED_FIXTURE = `# Sample

## Epic List

### Epic 1: Bring up a composed Sample Database
Platform authors can assemble.

## Epic 1: Bring up a composed Sample Database

Platform authors get one migrated Sample Database.

### Story 1.1: SAMPLE_DATABASE_URL gate and sample CLI scaffold

As a platform author,
I want \`schema sample\` commands to exist,
So that sample work never silently targets a tenant database.

**Acceptance Criteria:**

**Given** schema-core CLI is installed
**When** I run without SAMPLE_DATABASE_URL
**Then** the process exits non-zero

### Story 1.2: schema sample up assemble

As a platform author,
I want assemble + migrate,
So that Live schema matches.

## Epic 2: Load Base seeds and reset Live

Operators get reproducible Base data.

### Story 2.1: Seed Contract documentation

As a schema package author,
I want a documented Seed Contract,
So that owners know where files live.
`;

const LETTER_FIXTURE = `# Heimdall — Epics (lean)

## Epic H.1 — Package spine & CLI

Scaffold \`@pocket-dimension/heimdall\` with config and CLI.

- H.1.1 Config schema + defineConfig + basePath resolution
- H.1.2 CLI commands
- H.1.3 Docs index + SI-shaped planning loaders via config paths

## Epic H.2 — Dogfood & soft-empty

Packages-repo config; planning soft-empty.

- H.2.1 Packages-repo heimdall.config at git root
`;

describe("bmad-output parser", () => {
  it("derives source slug from epics path parent folder", () => {
    expect(epicSourceSlug("_bmad-output/planning-artifacts/sample-lifecycle/epics.md")).toBe("sample-lifecycle");
    expect(epicSourceSlug("_bmad-output/planning-artifacts/heimdall/epics.md")).toBe("heimdall");
  });

  it("parses numbered BMAD Method epics.md (FR3)", () => {
    const { epics } = parseBmadOutputEpics(NUMBERED_FIXTURE, "sample-lifecycle");
    expect(epics.map((e) => e.number)).toEqual([1, 2]);
    expect(epics[0]!.stories.map((s) => `${s.epicNumber}.${s.storyNumber}`)).toEqual(["1.1", "1.2"]);
    expect(bmadEpicId("sample-lifecycle", epics[0]!)).toBe("epic-sample-lifecycle-1");
    expect(bmadFeatureId("sample-lifecycle", epics[0]!)).not.toMatch(/^F-\d+$/);
  });

  it("parses letter-prefixed lean epics.md (FR4)", () => {
    const { epics } = parseBmadOutputEpics(LETTER_FIXTURE, "heimdall");
    expect(epics.map((e) => e.code)).toEqual(["H.1", "H.2"]);
    expect(epics[0]!.stories.map((s) => s.code)).toEqual(["H.1.1", "H.1.2", "H.1.3"]);
    expect(bmadEpicId("heimdall", epics[0]!)).toBe("epic-heimdall-h-1");
  });

  it("does not treat SI numeric headings as required (numeric-only content yields empty)", () => {
    const siOnly = `### Epic 1 — Title\n\n**Story 1.1**\nTitle\n`;
    const { epics } = parseBmadOutputEpics(siOnly, "x");
    expect(epics).toEqual([]);
  });
});

describe("bmad-output loadDashboard dispatch", () => {
  it("accepts parser bmad-output in config and defaults numeric (FR1, FR10)", () => {
    const cfg = defineConfig({
      paths: {
        epics: [{ path: "x.md", parser: "bmad-output" }],
      },
    });
    expect(cfg.paths.epics[0]!.parser).toBe("bmad-output");
    const def = defineConfig({
      paths: { epics: [{ path: "docs/planning/epics/epics.md" }] },
    });
    expect(def.paths.epics[0]!.parser).toBe("numeric");
  });

  it("skips unknown parser without throwing (FR2)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-unk-"));
    mkdirSync(path.join(root, "docs"), { recursive: true });
    writeFileSync(path.join(root, "docs", "epics.md"), NUMBERED_FIXTURE);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = defineConfig({
      paths: {
        sprintStatus: [],
        epics: [{ path: "docs/epics.md", parser: "not-a-parser" }],
        featureRegistry: "docs/missing.md",
        intakeIndex: "docs/missing.md",
        deferredIndex: "docs/missing.md",
        implementationDir: "docs/implementation",
      },
    });

    const snap = loadDashboard(root, config);
    expect(snap.epics).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("loads numbered bmad-output epics with source-scoped ids (FR3, AD-9)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-num-"));
    const epicDir = path.join(root, "planning", "sample-lifecycle");
    mkdirSync(epicDir, { recursive: true });
    writeFileSync(path.join(epicDir, "epics.md"), NUMBERED_FIXTURE);

    const config = defineConfig({
      paths: {
        sprintStatus: [],
        epics: [
          {
            path: "planning/sample-lifecycle/epics.md",
            parser: "bmad-output",
          },
        ],
        featureRegistry: "missing-features.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
    });

    const snap = loadDashboard(root, config);
    expect(snap.epics.length).toBeGreaterThanOrEqual(2);
    expect(snap.epics[0]!.id).toBe("epic-sample-lifecycle-1");
    expect(snap.stories.some((s) => s.id === "sample-lifecycle-1-1")).toBe(true);
    expect(snap.features.length).toBeGreaterThan(0);
    expect(snap.features[0]!.id).toMatch(/^feat-sample-lifecycle-/);
    expect(snap.features[0]!.id).not.toMatch(/^F-\d+$/);
  });

  it("loads letter-prefixed epics alongside numbered without id collision (FR4)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-both-"));
    mkdirSync(path.join(root, "planning", "sample-lifecycle"), { recursive: true });
    mkdirSync(path.join(root, "planning", "heimdall"), { recursive: true });
    writeFileSync(path.join(root, "planning", "sample-lifecycle", "epics.md"), NUMBERED_FIXTURE);
    writeFileSync(path.join(root, "planning", "heimdall", "epics.md"), LETTER_FIXTURE);

    const config = defineConfig({
      paths: {
        sprintStatus: [],
        epics: [
          { path: "planning/sample-lifecycle/epics.md", parser: "bmad-output" },
          { path: "planning/heimdall/epics.md", parser: "bmad-output" },
        ],
        featureRegistry: "missing.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
    });

    const snap = loadDashboard(root, config);
    const ids = snap.epics.map((e) => e.id);
    expect(ids).toContain("epic-sample-lifecycle-1");
    expect(ids).toContain("epic-heimdall-h-1");
    expect(snap.epics.find((e) => e.id === "epic-heimdall-h-1")?.code).toBe("H.1");
  });

  it("overlays sprint-status and attaches N-M story files (FR5, FR6)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-spr-"));
    mkdirSync(path.join(root, "planning", "sample-lifecycle"), { recursive: true });
    mkdirSync(path.join(root, "implementation"), { recursive: true });
    writeFileSync(path.join(root, "planning", "sample-lifecycle", "epics.md"), NUMBERED_FIXTURE);
    writeFileSync(
      path.join(root, "implementation", "sprint-status.yaml"),
      `project: sample-lifecycle
last_updated: 2026-08-26
development_status:
  epic-1: done
  1-1-sample-database-url-gate-and-sample-cli-scaffold: done
  1-2-schema-sample-up: backlog
`
    );
    writeFileSync(
      path.join(root, "implementation", "1-1-sample-database-url-gate-and-sample-cli-scaffold.md"),
      `# Story 1.1: From file

Status: done

## Tasks
- [x] Gate
`
    );

    const config = defineConfig({
      paths: {
        sprintStatus: ["implementation/sprint-status.yaml"],
        epics: [{ path: "planning/sample-lifecycle/epics.md", parser: "bmad-output" }],
        featureRegistry: "missing.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
    });

    const snap = loadDashboard(root, config);
    const epic1 = snap.epics.find((e) => e.id === "epic-sample-lifecycle-1");
    expect(epic1?.status).toBe("done");
    const s11 = snap.stories.find((s) => s.id === "sample-lifecycle-1-1");
    expect(s11?.status).toBe("done");
    expect(s11?.hasImplementationFile).toBe(true);
    expect(s11?.title).toBe("From file");
  });

  it("uses Feature Registry when present instead of synthesis (AD-11)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr-"));
    mkdirSync(path.join(root, "planning", "sample-lifecycle"), { recursive: true });
    mkdirSync(path.join(root, "docs"), { recursive: true });
    writeFileSync(path.join(root, "planning", "sample-lifecycle", "epics.md"), NUMBERED_FIXTURE);
    writeFileSync(
      path.join(root, "docs", "FEATURE-REGISTRY.md"),
      `| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Plans list | SCR-1 | PM | Epic 1 | Live |
`
    );

    const config = defineConfig({
      paths: {
        sprintStatus: [],
        epics: [{ path: "planning/sample-lifecycle/epics.md", parser: "bmad-output" }],
        featureRegistry: "docs/FEATURE-REGISTRY.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
    });

    const snap = loadDashboard(root, config);
    expect(snap.features.some((f) => f.id === "F-1")).toBe(true);
    expect(snap.features.every((f) => !f.id.startsWith("feat-"))).toBe(true);
  });

  it("missing epics.md soft-empties that source without crash (FR3)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-miss-"));
    const config = defineConfig({
      paths: {
        sprintStatus: [],
        epics: [{ path: "missing/epics.md", parser: "bmad-output" }],
        featureRegistry: "missing.md",
        intakeIndex: "missing.md",
        deferredIndex: "missing.md",
        implementationDir: "implementation",
      },
    });
    const snap = loadDashboard(root, config);
    expect(snap.epics).toEqual([]);
  });
});
