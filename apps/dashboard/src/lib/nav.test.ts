import { describe, expect, it } from "bun:test";
import { FORBIDDEN_NAV_LABELS, isSectionActive, overviewSectionLinks, SECTION_NAV, sectionHref } from "./nav";

describe("SECTION_NAV", () => {
  it("lists exactly five sections in IA order", () => {
    expect(SECTION_NAV).toHaveLength(5);
    expect(SECTION_NAV.map((item) => item.label)).toEqual(["Overview", "Features", "Epics & Stories", "Tests", "Docs"]);
  });

  it("does not include forbidden §6.3 labels", () => {
    const labels = SECTION_NAV.map((item) => item.label);
    for (const forbidden of FORBIDDEN_NAV_LABELS) {
      expect(labels).not.toContain(forbidden);
    }
  });
});

describe("sectionHref", () => {
  it("preserves tree query on section links", () => {
    expect(sectionHref("/features", "zeo")).toBe("/features?tree=zeo");
  });

  it("returns bare href when no tree is selected", () => {
    expect(sectionHref("/delivery", null)).toBe("/delivery");
  });
});

describe("isSectionActive", () => {
  it("matches Overview only on exact `/`", () => {
    expect(isSectionActive("/", "/")).toBe(true);
    expect(isSectionActive("/features", "/")).toBe(false);
  });

  it("matches section paths by prefix", () => {
    expect(isSectionActive("/features", "/features")).toBe(true);
    expect(isSectionActive("/features/detail", "/features")).toBe(true);
    expect(isSectionActive("/docs", "/features")).toBe(false);
  });
});

describe("overviewSectionLinks", () => {
  it("returns four destination links excluding Overview", () => {
    const links = overviewSectionLinks("pocket-dimension");
    expect(links).toHaveLength(4);
    expect(links.every((item) => item.href.includes("tree=pocket-dimension"))).toBe(true);
  });
});
