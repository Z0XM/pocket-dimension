import { describe, expect, it } from "bun:test";
import { extractFeatures, filterFeatures } from "./features";
import { slugifyHeading } from "./heading-slug";
import type { ArtifactKind } from "$lib/types";

const META = {
  sourcePath: "planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md",
  sourceTitle: "PRD: Dashboard",
};

const DASHBOARD_STYLE = `
## 4. Features

### 4.1 Catalog of BMAD Trees and Artifacts

#### FR-1: Discover BMAD Trees
Body.

### 4.2 Reader Showcase

#### FR-4: Present Artifact content
`;

const ZEO_STYLE = `
## Functional Requirements

### Reading and discovery

#### FR-1 Access model
Body.

#### FR-3a Room creation role gate
Body.

### Orphan thematic (no FR children)

### Authentication and access

#### FR-G0-1 Authentication required to join
Body.

### Game mode shell

#### FR-GM-10 Auto-split teams
Body.
`;

const CHHAN_STYLE = `
## 4. Features

### 4.1 Multi-account support

#### FR-1: Link accounts
Body.
`;

const NFR_ONLY = `
## Non-Functional Requirements

### NFR-1 Performance
Body.

#### NFR-2 Availability
`;

const UJ_ONLY = `
## Functional Requirements

### UJ-1 Browse flow
Body.
`;

describe("extractFeatures", () => {
  it("extracts numbered Features and FR rows from dashboard-style PRD", () => {
    const rows = extractFeatures(DASHBOARD_STYLE, META);

    expect(rows.some((r) => r.kind === "feature" && r.id === "4.1" && r.name.includes("Catalog"))).toBe(true);
    expect(rows.some((r) => r.kind === "fr" && r.id === "FR-1" && r.name.includes("Discover"))).toBe(true);
    expect(rows.some((r) => r.kind === "fr" && r.id === "FR-4")).toBe(true);
  });

  it("extracts thematic groups and FR rows from zeo-style PRD", () => {
    const rows = extractFeatures(ZEO_STYLE, META);

    expect(rows.some((r) => r.kind === "feature" && r.id === "reading-and-discovery")).toBe(true);
    expect(rows.some((r) => r.kind === "feature" && r.id === "authentication-and-access")).toBe(true);
    expect(rows.some((r) => r.kind === "feature" && r.id === "game-mode-shell")).toBe(true);
    expect(rows.some((r) => r.kind === "fr" && r.id === "FR-3a")).toBe(true);
    expect(rows.some((r) => r.kind === "fr" && r.id === "FR-G0-1")).toBe(true);
    expect(rows.some((r) => r.kind === "fr" && r.id === "FR-GM-10")).toBe(true);
    expect(rows.some((r) => r.id === "orphan-thematic-no-fr-children")).toBe(false);
  });

  it("extracts chhan-style numbered Features and FR rows", () => {
    const rows = extractFeatures(CHHAN_STYLE, META);

    expect(rows).toEqual([
      expect.objectContaining({ kind: "feature", id: "4.1", name: "Multi-account support" }),
      expect.objectContaining({ kind: "fr", id: "FR-1", name: "Link accounts" }),
    ]);
  });

  it("returns empty for NFR-only or UJ-only markdown", () => {
    expect(extractFeatures(NFR_ONLY, META)).toEqual([]);
    expect(extractFeatures(UJ_ONLY, META)).toEqual([]);
    expect(extractFeatures("# Title\n\nNo requirements here.", META)).toEqual([]);
  });

  it("uses headingSlug from shared slugifyHeading on full heading text", () => {
    const rows = extractFeatures("#### FR-1: Discover BMAD Trees\n", META);
    expect(rows[0]?.headingSlug).toBe(slugifyHeading("FR-1: Discover BMAD Trees"));
    expect(rows[0]?.headingSlug).toBe("fr-1-discover-bmad-trees");
  });

  it("keeps separate rows when the same FR id appears in different source files", () => {
    const otherMeta = {
      sourcePath: "planning-artifacts/prds/prd-other/prd.md",
      sourceTitle: "Other PRD",
    };
    const a = extractFeatures("#### FR-1: Alpha\n", META);
    const b = extractFeatures("#### FR-1: Beta\n", otherMeta);
    expect(a[0]?.sourcePath).not.toBe(b[0]?.sourcePath);
    expect(a[0]?.name).toBe("Alpha");
    expect(b[0]?.name).toBe("Beta");
  });
});

describe("filterFeatures", () => {
  const rows = extractFeatures(DASHBOARD_STYLE, META);

  it("matches id or name case-insensitively", () => {
    expect(filterFeatures(rows, "fr-1").some((r) => r.id === "FR-1")).toBe(true);
    expect(filterFeatures(rows, "discover").some((r) => r.name.includes("Discover"))).toBe(true);
  });

  it("returns empty list when nothing matches", () => {
    expect(filterFeatures(rows, "nonsense-query-xyz")).toEqual([]);
  });

  it("returns all rows for empty query", () => {
    expect(filterFeatures(rows, "")).toEqual(rows);
    expect(filterFeatures(rows, "   ")).toEqual(rows);
  });
});

describe("Feature is not ArtifactKind", () => {
  it("never includes feature in ArtifactKind union", () => {
    const kind: ArtifactKind = "prd";
    expect(kind).not.toBe("feature" as ArtifactKind);
  });
});
