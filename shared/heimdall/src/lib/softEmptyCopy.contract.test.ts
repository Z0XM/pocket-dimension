import { describe, expect, it } from "vitest";
import { getDocsEmptyBoardCopy, getSoftEmptyCopy, isBridgeTitle, showModuleLabelChip, type SoftEmptyKind } from "./softEmptyCopy";

const SOFT_EMPTY_KINDS: SoftEmptyKind[] = [
  "feature-registry",
  "optional-intake",
  "optional-deferred",
  "optional-external",
  "delivery-epics",
  "planning",
];

const FORBIDDEN_PHRASES = ["Sales Incentives", "failed to load"];

function fullCopyText(kind: SoftEmptyKind): string {
  const copy = getSoftEmptyCopy(kind);
  return `${copy.title} ${copy.description}`;
}

describe("softEmptyCopy", () => {
  it("feature-registry copy uses process-gap voice, not failed to load", () => {
    const copy = getSoftEmptyCopy("feature-registry");
    expect(copy.title).toContain("No feature registry");
    expect(copy.title).toContain("Module Scope");
    expect(copy.title.toLowerCase()).not.toContain("failed");
    expect(copy.description.toLowerCase()).not.toContain("failed to load");
    expect(copy.description).toContain("heimdall doctor");
    expect(copy.description).toContain("Module Scope");
  });

  it("optional-intake copy matches optional-index voice", () => {
    const copy = getSoftEmptyCopy("optional-intake");
    expect(copy.title).toBe("Optional intake not configured");
    expect(copy.description.toLowerCase()).not.toContain("failed");
    expect(copy.description).toContain("Module Scope");
  });

  it("optional-deferred copy matches optional-index voice", () => {
    const copy = getSoftEmptyCopy("optional-deferred");
    expect(copy.title).toBe("Optional deferred index not configured");
    expect(copy.description).toContain("Module Scope");
  });

  it("optional-external copy matches optional-index voice", () => {
    const copy = getSoftEmptyCopy("optional-external");
    expect(copy.title).toBe("Optional external gaps not configured");
    expect(copy.title.toLowerCase()).not.toContain("loaded");
    expect(copy.description).toContain("heimdall doctor");
    expect(copy.description).toContain("Module Scope");
  });

  it.each(SOFT_EMPTY_KINDS)("modules-aware copy for %s avoids forbidden phrasing", (kind) => {
    const text = fullCopyText(kind);
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text).not.toContain(phrase);
    }
    expect(text.toLowerCase()).not.toContain("this module");
  });

  it.each(SOFT_EMPTY_KINDS)("modules-aware copy for %s mentions Module Scope or configured paths", (kind) => {
    const text = fullCopyText(kind);
    expect(text).toMatch(/Module Scope|configured/i);
  });

  it("delivery-epics and planning remain honest soft-empty regression copy", () => {
    const delivery = getSoftEmptyCopy("delivery-epics");
    const planning = getSoftEmptyCopy("planning");
    expect(delivery.title).toContain("Module Scope");
    expect(planning.title).toContain("Module Scope");
    expect(delivery.description).toContain("heimdall doctor");
    expect(planning.description).toContain("configured BMAD paths");
  });
});

describe("getDocsEmptyBoardCopy", () => {
  it("mentions configured doc roots, not legacy /docs-only phrasing", () => {
    const copy = getDocsEmptyBoardCopy();
    expect(copy.description).toContain("paths.docsRoot");
    expect(copy.description).toContain("docs.extraRoots");
    expect(copy.description).toContain("configured");
    expect(copy.description).toContain("heimdall doctor");
    expect(copy.description).not.toMatch(/\bonly\s+\/docs\b/i);
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(`${copy.title} ${copy.description}`).not.toContain(phrase);
    }
  });
});

describe("showModuleLabelChip", () => {
  it("shows chip only when scope is all and label present", () => {
    expect(showModuleLabelChip("all", "Divinity")).toBe(true);
    expect(showModuleLabelChip("divinity", "Divinity")).toBe(false);
    expect(showModuleLabelChip("all", undefined)).toBe(false);
    expect(showModuleLabelChip("all", "")).toBe(false);
  });
});

describe("isBridgeTitle", () => {
  it("matches Bridge and Historical prefixes like server isBridgeEpic", () => {
    expect(isBridgeTitle("Epic 1: Bridge: Pre-BMAD historical work")).toBe(true);
    expect(isBridgeTitle("Historical: Legacy migration")).toBe(true);
    expect(isBridgeTitle("Epic 2: Active sprint work")).toBe(false);
  });
});
