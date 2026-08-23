import { describe, expect, it } from "bun:test";
import { resolveLink, resolveRelativeTreePath } from "./resolve-link";

const TREE = "pocket-dimension" as const;
const SOURCE = "planning-artifacts/epics-dashboard.md";

describe("resolveRelativeTreePath", () => {
  it("resolves sibling paths", () => {
    expect(resolveRelativeTreePath("planning-artifacts", "architecture-dashboard.md")).toBe("planning-artifacts/architecture-dashboard.md");
  });

  it("resolves parent-relative paths within tree", () => {
    expect(resolveRelativeTreePath("planning-artifacts/prds/foo", "../../epics-dashboard.md")).toBe("planning-artifacts/epics-dashboard.md");
  });

  it("returns null when escaping tree root", () => {
    expect(resolveRelativeTreePath("planning-artifacts", "../../outside.md")).toBeNull();
  });
});

describe("resolveLink", () => {
  it("resolves sibling .md to Reader URL with tree param", () => {
    const result = resolveLink({
      href: "./architecture-dashboard.md",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/docs/planning-artifacts/architecture-dashboard.md?tree=pocket-dimension",
    });
  });

  it("resolves ../ within tree to epic slug route", () => {
    const result = resolveLink({
      href: "../../epics-dashboard.md",
      sourcePath: "planning-artifacts/prds/foo/prd.md",
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/epics/planning-artifacts--epics-dashboard?tree=pocket-dimension",
    });
  });

  it("marks tree-root escape as unresolved", () => {
    const result = resolveLink({
      href: "../../../../outside.md",
      sourcePath: "planning-artifacts/prds/foo/prd.md",
      tree: TREE,
    });
    expect(result).toEqual({ unresolved: true, reason: "path escapes tree root" });
  });

  it("marks missing file as unresolved when exists returns false", () => {
    const result = resolveLink({
      href: "missing.md",
      sourcePath: SOURCE,
      tree: TREE,
      exists: () => false,
    });
    expect(result).toEqual({ unresolved: true, reason: "target missing" });
  });

  it("resolves when exists returns true", () => {
    const result = resolveLink({
      href: "architecture-dashboard.md",
      sourcePath: SOURCE,
      tree: TREE,
      exists: (path) => path === "planning-artifacts/architecture-dashboard.md",
    });
    expect(result).toMatchObject({ kind: "reader" });
  });

  it("preserves hash-only links", () => {
    const result = resolveLink({
      href: "#section",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({ kind: "hash", href: "#section" });
  });

  it("keeps https external links unchanged", () => {
    const result = resolveLink({
      href: "https://example.com/docs",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({ kind: "external", href: "https://example.com/docs" });
  });

  it("marks javascript: as unresolved", () => {
    const result = resolveLink({
      href: "javascript:alert(1)",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({ unresolved: true, reason: "disallowed scheme" });
  });

  it("marks empty href as unresolved", () => {
    expect(resolveLink({ href: "", sourcePath: SOURCE, tree: TREE })).toEqual({
      unresolved: true,
      reason: "empty href",
    });
    expect(resolveLink({ href: "   ", sourcePath: SOURCE, tree: TREE })).toEqual({
      unresolved: true,
      reason: "empty href",
    });
  });

  it("preserves query and hash on relative links", () => {
    const result = resolveLink({
      href: "architecture-dashboard.md?ref=1#intro",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/docs/planning-artifacts/architecture-dashboard.md?tree=pocket-dimension&ref=1#intro",
    });
  });

  it("routes epic links to /epics slug URL", () => {
    const result = resolveLink({
      href: "../../epics-dashboard.md",
      sourcePath: "planning-artifacts/prds/foo/prd.md",
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/epics/planning-artifacts--epics-dashboard?tree=pocket-dimension",
    });
  });

  it("routes story links to /stories slug URL", () => {
    const result = resolveLink({
      href: "../implementation-artifacts/3-1-browse-features-extracted-from-planning-artifacts.md",
      sourcePath: "planning-artifacts/epics-dashboard.md",
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/stories/implementation-artifacts--3-1-browse-features-extracted-from-planning-artifacts?tree=pocket-dimension",
    });
  });

  it("resolves directory-style relative paths", () => {
    const result = resolveLink({
      href: "../../ux-designs/ux-dashboard-2026-08-23/DESIGN.md",
      sourcePath: "planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md",
      tree: TREE,
    });
    expect(result).toMatchObject({
      kind: "reader",
      href: "/docs/planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md?tree=pocket-dimension",
    });
  });

  it("normalizes Windows-style backslashes", () => {
    const result = resolveLink({
      href: ".\\architecture-dashboard.md",
      sourcePath: "planning-artifacts\\epics-dashboard.md",
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/docs/planning-artifacts/architecture-dashboard.md?tree=pocket-dimension",
    });
  });

  it("decodes URL-encoded path segments", () => {
    const result = resolveLink({
      href: "my%20doc.md",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({
      kind: "reader",
      href: "/docs/planning-artifacts/my%20doc.md?tree=pocket-dimension",
    });
  });

  it("marks data: scheme as unresolved", () => {
    const result = resolveLink({
      href: "data:text/html,evil",
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(result).toEqual({ unresolved: true, reason: "disallowed scheme" });
  });
});
