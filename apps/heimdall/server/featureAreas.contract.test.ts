import { describe, expect, it } from "vitest";
import { displayAreaLabel, resolveFeatureArea, resolveFeatureAreaId, slugifyArea, sortAreaIds } from "./featureAreas.js";
import { parseFeatureRegistry } from "./parseFeatureRegistry.js";

describe("featureAreas — FR Area authority", () => {
  it("FR Area is slugified and keeps display label", () => {
    const resolved = resolveFeatureArea("F-1", "cli");
    expect(resolved).toEqual({ id: "cli", label: "cli" });
    expect(resolveFeatureAreaId("F-1", "cli")).toBe("cli");
  });

  it("unknown freeform Area slugifies and keeps label", () => {
    expect(resolveFeatureArea("F-99", "root-dx")).toEqual({
      id: "root-dx",
      label: "root-dx",
    });
    expect(resolveFeatureArea("F-99", "Root DX")).toEqual({
      id: "root-dx",
      label: "Root DX",
    });
  });

  it("whitespace-only Area is other", () => {
    expect(resolveFeatureArea("F-1", "  ")).toEqual({ id: "other", label: "Other" });
  });

  it("missing Area → other (no id-map)", () => {
    expect(resolveFeatureArea("F-1")).toEqual({ id: "other", label: "Other" });
    expect(resolveFeatureArea("F-999")).toEqual({ id: "other", label: "Other" });
  });

  it("slugifyArea normalizes spaced labels", () => {
    expect(slugifyArea("Root DX")).toBe("root-dx");
    expect(slugifyArea("  ")).toBe("other");
  });

  it("sortAreaIds is alpha with other last", () => {
    expect(sortAreaIds(["other", "ui", "cli", "host"])).toEqual(["cli", "host", "ui", "other"]);
  });

  it("displayAreaLabel prefers lex-first candidate", () => {
    expect(displayAreaLabel("cli", ["CLI", "cli"])).toBe("cli");
    expect(displayAreaLabel("other", [])).toBe("Other");
  });
});

describe("parseFeatureRegistry — Area wiring", () => {
  const sample = `# Feature Registry

## Capability map

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Config schema and CLI | overview | package | Epic 1 | Live |
| F-2 | Dogfood loaders | docs | package | Epic 2 | Live |

## Feature details

### F-1 — Config schema and CLI

- **Goal:** Scaffold CLI.
- **Area:** cli

### F-2 — Dogfood loaders

- **Goal:** Soft-empty loaders.
- **Area:** loaders
`;

  it("parses freeform FR Areas", () => {
    const features = parseFeatureRegistry(sample);
    expect(features).toHaveLength(2);
    expect(features[0]).toMatchObject({ id: "F-1", areaId: "cli", area: "cli" });
    expect(features[1]).toMatchObject({ id: "F-2", areaId: "loaders", area: "loaders" });
  });

  it("omitted Area is other", () => {
    const md = `# Feature Registry

## Capability map

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Something | overview | package | Epic 1 | Live |

## Feature details

### F-1 — Something

- **Goal:** No area field.
`;
    const [feature] = parseFeatureRegistry(md);
    expect(feature).toMatchObject({
      areaId: "other",
      area: "Other",
    });
  });
});
